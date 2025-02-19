const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { body, validationResult } = require('express-validator');

// Helper function to calculate required tile quantity
const calculateTileQuantity = (length, width, coverage, boxMoq = 1) => {
  // Convert mm to m² and then to sq ft
  const tileArea = (length * width) / (1000 * 1000) * 10.764;
  const piecesNeeded = Math.ceil(coverage / tileArea);
  // Round up to nearest box MOQ if specified
  return boxMoq > 1 ? Math.ceil(piecesNeeded / boxMoq) * boxMoq : piecesNeeded;
};

// Validation middleware for orders
const validateOrder = [
  body('items').isArray().notEmpty(),
  body('items.*.product_id').isUUID(),
  body('items.*.quantity').isInt({ min: 1 }),
  body('items.*.coverage').optional().isFloat({ min: 0 }), // Optional coverage in square feet
  body('totalAmount').isFloat({ min: 0 }),
  body('shippingAddress').isObject(),
  body('shippingAddress.street').notEmpty(),
  body('shippingAddress.city').notEmpty(),
  body('shippingAddress.state').notEmpty(),
  body('shippingAddress.zipCode').notEmpty()
];

// Create new order
router.post('/',
  auth,
  checkPermission('orders', 'create'),
  validateOrder,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { items, totalAmount, shippingAddress } = req.body;
      const userId = req.user.id;

      // Fetch product details for quantity calculation
      const productIds = items.map(item => item.product_id);
      const { data: products, error: productError } = await supabase
        .from('products')
        .select('id, length_mm, width_mm, box_moq')
        .in('id', productIds);

      if (productError) throw productError;

      // Calculate actual quantities based on coverage if provided
      const adjustedItems = items.map(item => {
        const product = products.find(p => p.id === item.product_id);
        if (product && item.coverage && product.length_mm && product.width_mm) {
          return {
            ...item,
            quantity: calculateTileQuantity(
              product.length_mm,
              product.width_mm,
              item.coverage,
              product.box_moq
            )
          };
        }
        return item;
      });

      // Start a Supabase transaction
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([
          {
            user_id: userId,
            items: adjustedItems,
            total_amount: totalAmount,
            shipping_address: shippingAddress,
            status: 'pending',
            payment_status: 'pending'
          }
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      // Update product stock
      for (const item of adjustedItems) {
        const { error: stockError } = await supabase.rpc('update_product_stock', {
          p_product_id: item.product_id,
          p_quantity: item.quantity
        });

        if (stockError) {
          // If stock update fails, cancel the order
          await supabase
            .from('orders')
            .update({ status: 'cancelled', payment_status: 'cancelled' })
            .eq('id', order.id);

          throw new Error('Failed to update product stock');
        }
      }

      // Create admin notification
      await supabase
        .from('admin_notifications')
        .insert([
          {
            type: 'new_order',
            user_id: userId,
            content: `New order #${order.id} created`,
            status: 'unread'
          }
        ]);

      res.status(201).json({
        message: 'Order created successfully',
        data: {
          ...order,
          items: adjustedItems // Return adjusted quantities
        }
      });
    } catch (error) {
      res.status(500).json({
        error: 'Error creating order',
        details: error.message,
        retry: true
      });
    }
});

// Get user's orders
router.get('/my-orders',
  auth,
  checkPermission('orders', 'read'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { page = 1, limit = 20 } = req.query;
      const from = (page - 1) * limit;
      const to = from + limit - 1;

      const { data, error, count } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      res.json({
        data,
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        total_pages: Math.ceil(count / limit)
      });
    } catch (error) {
      res.status(500).json({
        error: 'Error fetching orders',
        details: error.message
      });
    }
});

// Admin: Get all orders
router.get('/admin/orders',
  auth,
  checkPermission('orders', 'read'),
  async (req, res) => {
    try {
      const {
        page = 1,
        limit = 20,
        status,
        fromDate,
        toDate,
        userId
      } = req.query;

      const from = (page - 1) * limit;
      const to = from + limit - 1;

      let query = supabase
        .from('orders')
        .select(`
          *,
          user:user_profiles(
            id,
            first_name,
            last_name,
            email,
            user_type
          )
        `, { count: 'exact' });

      if (status) {
        query = query.eq('status', status);
      }

      if (fromDate) {
        query = query.gte('created_at', fromDate);
      }

      if (toDate) {
        query = query.lte('created_at', toDate);
      }

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) throw error;

      res.json({
        data,
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        total_pages: Math.ceil(count / limit)
      });
    } catch (error) {
      res.status(500).json({
        error: 'Error fetching orders',
        details: error.message
      });
    }
});

// Admin: Update order status
router.patch('/admin/orders/:id',
  auth,
  checkPermission('orders', 'update'),
  [
    body('status').isIn(['pending', 'approved', 'rejected', 'processing', 'shipped', 'delivered', 'cancelled']),
    body('notes').optional().isString()
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const { status, notes } = req.body;

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .update({
          status,
          admin_notes: notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (orderError) throw orderError;

      // Notify user about order status change
      const { data: userData } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('user_id', order.user_id)
        .single();

      if (userData) {
        // Send email notification (implement this based on your email service)
        // await sendOrderStatusEmail(userData.email, order.id, status);
      }

      res.json({
        message: 'Order status updated successfully',
        data: order
      });
    } catch (error) {
      res.status(500).json({
        error: 'Error updating order status',
        details: error.message
      });
    }
});

// Get order status
router.get('/:orderId/status',
  auth,
  checkPermission('orders', 'read'),
  async (req, res) => {
    try {
      const { orderId } = req.params;
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, payment_status, updated_at')
        .eq('id', orderId)
        .single();

      if (error) throw error;

      if (!data) {
        return res.status(404).json({
          error: 'Order not found',
          details: 'The requested order does not exist'
        });
      }

      res.json(data);
    } catch (error) {
      res.status(500).json({
        error: 'Error fetching order status',
        details: error.message
      });
    }
});

module.exports = router;