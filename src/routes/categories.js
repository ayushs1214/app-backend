const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const auth = require('../middleware/auth');

// Get all categories with product counts
router.get('/', auth, async (req, res) => {
  try {
    const { data: categories, error: categoryError } = await supabase
      .from('categories')
      .select(`
        *,
        products:products(count)
      `)
      .order('name');

    if (categoryError) throw categoryError;

    // Transform the response to include product count
    const transformedCategories = categories.map(category => ({
      ...category,
      product_count: category.products?.length || 0,
      products: undefined // Remove the products array
    }));

    res.json(transformedCategories);
  } catch (error) {
    res.status(500).json({
      error: 'Error fetching categories',
      details: error.message
    });
  }
});

// Get category by ID with its products and stats
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Get category details
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (categoryError) throw categoryError;

    if (!category) {
      return res.status(404).json({
        error: 'Category not found'
      });
    }

    // Get paginated products
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    const { data: products, error: productsError, count } = await supabase
      .from('products')
      .select('*', { count: 'exact' })
      .eq('category_id', id)
      .range(from, to);

    if (productsError) throw productsError;

    // Get category statistics
    const { data: stats, error: statsError } = await supabase
      .from('products')
      .select('price, stock')
      .eq('category_id', id);

    if (statsError) throw statsError;

    // Calculate category statistics
    const categoryStats = stats.reduce((acc, product) => {
      acc.total_products++;
      acc.total_stock += product.stock;
      acc.min_price = Math.min(acc.min_price, product.price);
      acc.max_price = Math.max(acc.max_price, product.price);
      acc.avg_price += product.price;
      return acc;
    }, {
      total_products: 0,
      total_stock: 0,
      min_price: Infinity,
      max_price: -Infinity,
      avg_price: 0
    });

    if (categoryStats.total_products > 0) {
      categoryStats.avg_price = categoryStats.avg_price / categoryStats.total_products;
    }

    // If no products found, reset min/max price
    if (categoryStats.min_price === Infinity) categoryStats.min_price = 0;
    if (categoryStats.max_price === -Infinity) categoryStats.max_price = 0;

    res.json({
      ...category,
      products,
      stats: categoryStats,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        total_pages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error fetching category',
      details: error.message
    });
  }
});

// Get category statistics
router.get('/:id/stats', auth, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: products, error } = await supabase
      .from('products')
      .select('price, stock, is_featured')
      .eq('category_id', id);

    if (error) throw error;

    const stats = {
      total_products: products.length,
      total_stock: 0,
      out_of_stock: 0,
      featured_products: 0,
      min_price: Infinity,
      max_price: -Infinity,
      avg_price: 0
    };

    products.forEach(product => {
      stats.total_stock += product.stock;
      if (product.stock === 0) stats.out_of_stock++;
      if (product.is_featured) stats.featured_products++;
      if (product.price < stats.min_price) stats.min_price = product.price;
      if (product.price > stats.max_price) stats.max_price = product.price;
      stats.avg_price += product.price;
    });

    if (stats.total_products > 0) {
      stats.avg_price = stats.avg_price / stats.total_products;
    }

    // Reset min/max price if no products
    if (stats.min_price === Infinity) stats.min_price = 0;
    if (stats.max_price === -Infinity) stats.max_price = 0;

    res.json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Error fetching category statistics',
      details: error.message
    });
  }
});

module.exports = router;