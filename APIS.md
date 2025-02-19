# Milagro Universe API Documentation

Welcome to the Milagro Universe API documentation. This guide will help you understand and interact with our API endpoints.

## 🌐 Base URL
```
http://localhost:3000/api
```

For production:
```
https://api.milagrouniverse.com
```

## 🔐 Authentication

### Register New User

Create a new user account in the system.

```http
POST /auth/register
```

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "userType": "builder",      // Required: "builder", "architect", "dealer", or "salesperson"
  "firstName": "John",        // Required: First name
  "lastName": "Doe",          // Required: Last name
  "email": "john@email.com",  // Required: Valid email address
  "mobileNumber": "1234567890", // Required: 10-digit mobile number
  "password": "securepass123",  // Required: Minimum 8 characters
  "acceptedTerms": true         // Required: Must be true
}
```

**Successful Response (201):**
```json
{
  "message": "Registration successful. Waiting for admin approval.",
  "data": {
    "user": {
      "id": "uuid-string",
      "user_type": "builder",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@email.com",
      "mobile_number": "1234567890",
      "is_approved": false,
      "approval_status": "pending"
    }
  }
}
```

### Login

Authenticate a user and get access token.

```http
POST /auth/login
```

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "john@email.com",
  "password": "securepass123"
}
```

**Successful Response (200):**
```json
{
  "message": "Login successful",
  "data": {
    "session": {
      "access_token": "eyJhbGciOiJIUzI1...",
      "token_type": "bearer",
      "expires_in": 3600
    },
    "user": {
      "id": "uuid-string",
      "user_type": "builder",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@email.com",
      "is_approved": true
    }
  }
}
```

## 📦 Products

### Get All Products

Retrieve a list of products with optional filtering.

```http
GET /products
```

**Request Headers:**
```
Authorization: Bearer your-access-token
```

**Query Parameters:**
| Parameter   | Type    | Description                           | Example               |
|------------|---------|---------------------------------------|----------------------|
| category_id| string  | Filter by category UUID               | 123e4567-e89b...    |
| search     | string  | Search in name and description        | "ceramic tiles"      |
| min_price  | number  | Minimum price filter                  | 100                  |
| max_price  | number  | Maximum price filter                  | 1000                 |
| sort_by    | string  | Field to sort by                      | "price"              |
| sort_order | string  | Sort direction ("asc" or "desc")      | "desc"               |
| page       | number  | Page number for pagination            | 1                    |
| limit      | number  | Items per page                        | 20                   |
| in_stock   | boolean | Filter for in-stock items only        | true                 |

**Example Request:**
```
GET /products?category_id=123e4567-e89b&min_price=100&max_price=1000&page=1&limit=20
```

**Successful Response (200):**
```json
{
  "data": [
    {
      "id": "uuid-string",
      "name": "Ceramic Floor Tile",
      "description": "Premium ceramic floor tile...",
      "price": 299.99,
      "stock": 150,
      "category": {
        "id": "uuid-string",
        "name": "Floor Tiles",
        "description": "High-quality floor tiles"
      }
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 100,
  "total_pages": 5
}
```

## 🛒 Orders

### Create New Order

Place a new order in the system.

```http
POST /orders
```

**Request Headers:**
```
Authorization: Bearer your-access-token
Content-Type: application/json
```

**Request Body:**
```json
{
  "items": [
    {
      "product_id": "uuid-string",
      "quantity": 5
    }
  ],
  "totalAmount": 1499.95,
  "shippingAddress": {
    "street": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "zipCode": "400001"
  }
}
```

**Successful Response (201):**
```json
{
  "message": "Order created successfully",
  "data": {
    "id": "uuid-string",
    "user_id": "uuid-string",
    "items": [
      {
        "product_id": "uuid-string",
        "quantity": 5
      }
    ],
    "total_amount": 1499.95,
    "status": "pending",
    "created_at": "2025-02-18T17:07:57.000Z"
  }
}
```

## 📊 Categories

### Get All Categories

Retrieve all product categories with their statistics.

```http
GET /categories
```

**Request Headers:**
```
Authorization: Bearer your-access-token
```

**Successful Response (200):**
```json
[
  {
    "id": "uuid-string",
    "name": "Floor Tiles",
    "description": "Premium floor tiles collection",
    "product_count": 50
  }
]
```

## ❌ Error Responses

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": [
    "Email is required",
    "Password must be at least 8 characters"
  ]
}
```

### 401 Unauthorized
```json
{
  "error": "Authentication failed",
  "details": "Invalid credentials"
}
```

### 403 Forbidden
```json
{
  "error": "Access denied",
  "details": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found",
  "details": "Product not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "details": "Database connection failed"
}
```

## 🔧 Testing the API

### Using Postman

1. **Set Up Environment:**
   - Create a new environment in Postman
   - Add variables:
     - `base_url`: `http://localhost:3000/api`
     - `token`: (to be filled after login)

2. **Register a User:**
   - Create a new POST request
   - URL: `{{base_url}}/auth/register`
   - Body: Raw JSON with registration details
   - Send request

3. **Login:**
   - Create a new POST request
   - URL: `{{base_url}}/auth/login`
   - Body: Raw JSON with email and password
   - After successful login, copy the access_token
   - Set the `token` environment variable

4. **Making Authenticated Requests:**
   - For all other endpoints, add header:
     ```
     Authorization: Bearer {{token}}
     ```

### Common Testing Scenarios

1. **Product Browsing:**
   ```http
   GET {{base_url}}/products?category_id=uuid&page=1&limit=20
   ```

2. **Product Search:**
   ```http
   GET {{base_url}}/products?search=ceramic&min_price=100&max_price=1000
   ```

3. **Creating an Order:**
   ```http
   POST {{base_url}}/orders
   ```
   With JSON body containing order details

4. **Checking Order Status:**
   ```http
   GET {{base_url}}/orders/{{order_id}}/status
   ```

## 📱 Mobile App Integration

When integrating with a React Native mobile app:

1. **API Client Setup:**
   ```javascript
   const API_BASE_URL = 'http://localhost:3000/api';
   
   const apiClient = axios.create({
     baseURL: API_BASE_URL,
     timeout: 10000,
     headers: {
       'Content-Type': 'application/json'
     }
   });
   ```

2. **Authentication Header:**
   ```javascript
   apiClient.interceptors.request.use(config => {
     const token = // Get token from secure storage
     if (token) {
       config.headers.Authorization = `Bearer ${token}`;
     }
     return config;
   });
   ```

3. **Error Handling:**
   ```javascript
   apiClient.interceptors.response.use(
     response => response,
     error => {
       if (error.response.status === 401) {
         // Handle unauthorized access
       }
       return Promise.reject(error);
     }
   );
   ```