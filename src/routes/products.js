const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { supabase } = require('../config/supabase');
const auth = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const NodeCache = require('node-cache');

// Initialize cache with 5 minutes TTL
const productCache = new NodeCache({ stdTTL: 300 });

// Validation middleware for product data
const validateProduct = [
  body('name').notEmpty().trim(),
  body('description').notEmpty().trim(),
  body('category_id').isUUID(),
  body('price').isFloat({ min: 0 }),
  body('stock').isInt({ min: 0 }),
  body('specifications').optional().isObject()
];

// Cache middleware
const cacheProducts = async (req, res, next) => {
  const cacheKey = `products:${JSON.stringify(req.query)}`;
  const cachedData = productCache.get(cacheKey);

  if (cachedData) {
    return res.json(cachedData);
  }

  res.sendResponse = res.json;
  res.json = (data) => {
    productCache.set(cacheKey, data);
    res.sendResponse(data);
  };
  next();
};

// Get all products with optional filters
router.get('/',
  auth,
  checkPermission('products', 'read'),
  cacheProducts,
  async (req, res) => {
    try {
      const { 
        category_id, 
        search, 
        min_price, 
        max_price,
        sort_by = 'created_at',
        sort_order = 'desc',
        page = 1,
        limit = 20,
        in_stock = null
      } = req.query;

      let query = supabase
        .from('products')
        .select(`
          *,
          category:categories(id, name, description)
        `, { count: 'exact' });

      // Apply filters
      if (category_id) {
        query = query.eq('category_id', category_id);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (min_price) {
        query = query.gte('price', min_price);
      }

      if (max_price) {
        query = query.lte('price', max_price);
      }

      if (in_stock !== null) {
        query = query.gt('stock', 0);
      }

      // Apply pagination
      const from = (page - 1) * limit;
      const to = from + limit - 1;
      
      query = query
        .order(sort_by, { ascending: sort_order === 'asc' })
        .range(from, to);

      const { data, error, count } = await query;

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
        error: 'Error fetching products',
        details: error.message
      });
    }
});

// Add new product (admin only)
router.post('/',
  auth,
  checkPermission('products', 'create'),
  validateProduct,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        name,
        description,
        category_id,
        price,
        stock,
        specifications,
        is_featured
      } = req.body;

      const { data, error } = await supabase
        .from('products')
        .insert([{
          name,
          description,
          category_id,
          price,
          stock,
          specifications,
          is_featured: is_featured || false
        }])
        .select();

      if (error) throw error;

      // Clear cache
      productCache.flushAll();

      res.status(201).json({
        message: 'Product created successfully',
        data: data[0]
      });
    } catch (error) {
      res.status(500).json({
        error: 'Error creating product',
        details: error.message
      });
    }
});

// Update product (admin only)
router.put('/:id',
  auth,
  checkPermission('products', 'update'),
  validateProduct,
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const {
        name,
        description,
        category_id,
        price,
        stock,
        specifications,
        is_featured
      } = req.body;

      const { data, error } = await supabase
        .from('products')
        .update({
          name,
          description,
          category_id,
          price,
          stock,
          specifications,
          is_featured
        })
        .eq('id', id)
        .select();

      if (error) throw error;

      if (!data || data.length === 0) {
        return res.status(404).json({
          error: 'Product not found',
          details: 'The requested product does not exist'
        });
      }

      // Clear cache
      productCache.flushAll();

      res.json({
        message: 'Product updated successfully',
        data: data[0]
      });
    } catch (error) {
      res.status(500).json({
        error: 'Error updating product',
        details: error.message
      });
    }
});

// Delete product (admin only)
router.delete('/:id',
  auth,
  checkPermission('products', 'delete'),
  async (req, res) => {
    try {
      const { id } = req.params;

      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Clear cache
      productCache.flushAll();

      res.json({
        message: 'Product deleted successfully'
      });
    } catch (error) {
      res.status(500).json({
        error: 'Error deleting product',
        details: error.message
      });
    }
});

// Get product by ID
router.get('/:id',
  auth,
  checkPermission('products', 'read'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const cacheKey = `product:${id}`;
      
      // Check cache
      const cachedProduct = productCache.get(cacheKey);
      if (cachedProduct) {
        return res.json(cachedProduct);
      }
      
      // Get main product with category
      const { data: product, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          category:categories(*)
        `)
        .eq('id', id)
        .single();

      if (productError) throw productError;

      if (!product) {
        return res.status(404).json({
          error: 'Product not found',
          details: 'The requested product does not exist'
        });
      }

      // Get related products from same category
      const { data: relatedProducts, error: relatedError } = await supabase
        .from('products')
        .select('id, name, price, images')
        .eq('category_id', product.category_id)
        .neq('id', id)
        .limit(5);

      if (relatedError) throw relatedError;

      const response = {
        ...product,
        related_products: relatedProducts
      };

      // Cache the response
      productCache.set(cacheKey, response);

      res.json(response);
    } catch (error) {
      res.status(500).json({
        error: 'Error fetching product',
        details: error.message
      });
    }
});

module.exports = router;