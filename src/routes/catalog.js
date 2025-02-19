const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const auth = require('../middleware/auth');

// Get catalog categories
router.get('/categories', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Error fetching categories',
      details: error.message
    });
  }
});

// Get featured products
router.get('/featured', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_featured', true)
      .limit(10);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Error fetching featured products',
      details: error.message
    });
  }
});

// Get new arrivals
router.get('/new-arrivals', auth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    res.status(500).json({
      error: 'Error fetching new arrivals',
      details: error.message
    });
  }
});

module.exports = router;