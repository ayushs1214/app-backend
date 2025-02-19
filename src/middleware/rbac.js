const { supabase } = require('../config/supabase');

// Role permissions mapping
const ROLE_PERMISSIONS = {
  builder: {
    products: ['read'],
    orders: ['create', 'read'],
    cart: ['create', 'read', 'update', 'delete']
  },
  architect: {
    products: ['read'],
    orders: ['create', 'read'],
    cart: ['create', 'read', 'update', 'delete']
  },
  dealer: {
    products: ['read'],
    orders: ['create', 'read', 'update'],
    cart: ['create', 'read', 'update', 'delete']
  },
  salesperson: {
    products: ['read'],
    orders: ['read'],
    cart: ['read']
  },
  admin: {
    products: ['create', 'read', 'update', 'delete'],
    orders: ['create', 'read', 'update', 'delete'],
    cart: ['create', 'read', 'update', 'delete'],
    users: ['create', 'read', 'update', 'delete']
  }
};

// Check if user has required permission
const hasPermission = (userType, resource, action) => {
  const rolePermissions = ROLE_PERMISSIONS[userType];
  if (!rolePermissions) return false;

  const resourcePermissions = rolePermissions[resource];
  if (!resourcePermissions) return false;

  return resourcePermissions.includes(action);
};

// RBAC middleware
const checkPermission = (resource, action) => async (req, res, next) => {
  try {
    const { data: user, error } = await supabase
      .from('user_profiles')
      .select('user_type')
      .eq('user_id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(403).json({
        error: 'Access denied',
        details: 'User profile not found'
      });
    }

    if (!hasPermission(user.user_type, resource, action)) {
      return res.status(403).json({
        error: 'Access denied',
        details: `Insufficient permissions for ${action} on ${resource}`
      });
    }

    req.userType = user.user_type;
    next();
  } catch (error) {
    res.status(500).json({
      error: 'Authorization check failed',
      details: error.message
    });
  }
};

module.exports = {
  checkPermission,
  hasPermission
};