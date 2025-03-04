# Milagro Universe Backend API 🚀

Welcome to the Milagro Universe B2B Platform backend service! This API powers the mobile application for Milagro Universe, a leading provider of tiles, bathroom fixtures, and toilet accessories.

## 📋 Table of Contents
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Authentication](#authentication)
- [User Roles](#user-roles)
- [API Documentation](#api-documentation)
- [Security](#security)
- [Testing](#testing)
- [Deployment](#deployment)
- [Support](#support)

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have:
- Node.js (version 18 or higher)
- npm (comes with Node.js)
- A Supabase account
- Postman (for API testing)

### Installation

1. Clone the repository:
   ```bash
   git clone [repository-url]
   cd milagro-universe-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory
   - Copy contents from `.env.example`
   - Update with your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your-supabase-url
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

## 🏗️ Project Structure

```
src/
├── config/          # Configuration files
│   ├── supabase.js  # Database configuration
│   ├── auth.js      # Authentication config
│   └── logger.js    # Logging configuration
├── middleware/      # Express middleware
│   ├── auth.js      # Authentication middleware
│   ├── rbac.js      # Role-based access control
│   └── security.js  # Security middleware
├── routes/          # API routes
│   ├── auth.js      # Authentication routes
│   ├── products.js  # Product routes
│   ├── orders.js    # Order routes
│   └── catalog.js   # Catalog routes
└── index.js         # Application entry point
```

## 🔐 Authentication

The API uses JWT-based authentication. To access protected endpoints:

1. Register a new account
2. Verify your email (OTP)
3. Wait for admin approval
4. Login to get your access token
5. Use the token in your requests:
   ```
   Authorization: Bearer your-access-token
   ```

### User Registration Flow

1. Submit registration:
   ```http
   POST /api/auth/register
   ```

2. Verify email with OTP:
   ```http
   POST /api/auth/verify-otp
   ```

3. Wait for admin approval

4. Login after approval:
   ```http
   POST /api/auth/login
   ```

## 👥 User Roles

The platform supports multiple user types:

1. **Builder** 🏗️
   - Can view products
   - Place orders
   - Manage cart

2. **Architect** 📐
   - Can view products
   - Place orders
   - Manage cart

3. **Dealer** 🏪
   - Can view products
   - Place and manage orders
   - Manage cart

4. **Salesperson** 👔
   - Can view products
   - View orders

5. **Admin** 👑
   - Full access to all features
   - Manage users, products, orders
   - Approve new registrations

## 📦 Features

### Product Management
- Comprehensive product catalog
- Category-based organization
- Advanced filtering and search
- Featured products showcase

### Order Processing
- Shopping cart functionality
- Order tracking
- Order history
- Admin approval system

### User Management
- Role-based access control
- Admin approval system
- Profile management
- Password reset functionality

## 🔒 Security

The API implements multiple security measures:

1. **Authentication & Authorization**
   - JWT-based authentication
   - Role-based access control
   - Session management

2. **Data Protection**
   - Input validation
   - XSS protection
   - SQL injection prevention
   - CORS protection

3. **Rate Limiting**
   - API request limits
   - Login attempt limits
   - Password reset limits

4. **Logging & Monitoring**
   - Error logging
   - Activity tracking
   - Security event monitoring

## 🧪 Testing

Run the test suite:
```bash
npm test
```

### Running Tests with Postman

1. Import the Postman collection
2. Set up environment variables
3. Run the test suite

## 📦 Deployment

1. Build the application:
   ```bash
   npm run build
   ```

2. Start in production:
   ```bash
   npm start
   ```

## 🆘 Support

Need help? Contact us:
- Email: support@milagrouniverse.com
- Create an issue in the repository
- Documentation: [API Documentation](./APIS.md)

## 📄 License

This project is licensed under the MIT License.#   a p p - b a c k e n d  
 