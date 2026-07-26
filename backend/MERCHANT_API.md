# Merchant Dashboard API Documentation

Complete API reference for merchant dashboard endpoints.

## Authentication

All merchant endpoints require JWT token in Authorization header:

```
Authorization: Bearer <merchant_token>
```

Obtain token via:
```
POST /api/auth/merchant/login
{
  "email": "merchant@example.com",
  "password": "password"
}
```

---

## Product Management

### Get All Products

```
GET /api/merchant/products?page=1&limit=20&search=query&categoryId=uuid
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 20)
- `search` (optional): Search by name, SKU, or barcode
- `categoryId` (optional): Filter by category

**Response:**
```json
{
  "success": true,
  "products": [
    {
      "id": "uuid",
      "name": "Product Name",
      "sku": "SKU123",
      "barcode": "1234567890",
      "price": "29.99",
      "cost": "15.00",
      "stock": 100,
      "isTaxable": true,
      "category": {
        "id": "uuid",
        "name": "Category Name"
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20
  }
}
```

### Get Product Details

```
GET /api/merchant/products/:productId
Authorization: Bearer <token>
```

### Create Product

```
POST /api/merchant/products
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "New Product",
  "price": 29.99,
  "categoryId": "uuid",
  "sku": "SKU123",
  "barcode": "1234567890",
  "cost": 15.00,
  "stock": 100,
  "isTaxable": true,
  "description": "Product description",
  "imageUrl": "https://example.com/image.jpg"
}
```

**Required Fields:**
- `name`: Product name
- `price`: Selling price

**Optional Fields:**
- `categoryId`: Category ID
- `sku`: Stock keeping unit
- `barcode`: Product barcode (EAN-13, UPC-A)
- `cost`: Cost price
- `stock`: Initial stock quantity
- `isTaxable`: Whether product is taxable (default: true)
- `description`: Product description
- `imageUrl`: Product image URL

### Update Product

```
PUT /api/merchant/products/:productId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Name",
  "price": 34.99,
  "stock": 150
}
```

### Delete Product

```
DELETE /api/merchant/products/:productId
Authorization: Bearer <token>
```

### Update Stock

```
PUT /api/merchant/products/:productId/stock
Authorization: Bearer <token>
Content-Type: application/json

{
  "quantity": 250
}
```

### Get Low Stock Products

```
GET /api/merchant/products/low-stock
Authorization: Bearer <token>
```

Returns products where stock is below the low stock threshold.

### Get Product Statistics

```
GET /api/merchant/products/statistics
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "statistics": {
    "totalProducts": 150,
    "totalStock": 5000,
    "lowStockCount": 12,
    "totalInventoryValue": 75000.00
  }
}
```

---

## Category Management

### Get All Categories

```
GET /api/merchant/categories
Authorization: Bearer <token>
```

### Create Category

```
POST /api/merchant/categories
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Electronics",
  "description": "Electronic devices",
  "color": "#FF5733"
}
```

### Update Category

```
PUT /api/merchant/categories/:categoryId
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Updated Category",
  "color": "#33FF57"
}
```

### Delete Category

```
DELETE /api/merchant/categories/:categoryId
Authorization: Bearer <token>
```

Note: Cannot delete category if it has products.

---

## Order Management

### Get All Orders

```
GET /api/merchant/orders?page=1&limit=20&status=completed&startDate=2025-01-01&endDate=2025-12-31
Authorization: Bearer <token>
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Items per page
- `status` (optional): Filter by status (pending, completed, cancelled)
- `startDate` (optional): Filter by start date (ISO format)
- `endDate` (optional): Filter by end date (ISO format)

### Get Order Details

```
GET /api/merchant/orders/:orderId
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "orderNumber": "ORD-1720000000-ABC123",
    "status": "completed",
    "subtotal": "100.00",
    "taxAmount": "10.00",
    "discountAmount": "5.00",
    "total": "105.00",
    "paymentMethod": "card",
    "paymentStatus": "completed",
    "items": [
      {
        "id": "uuid",
        "product": {
          "id": "uuid",
          "name": "Product Name",
          "sku": "SKU123"
        },
        "quantity": 2,
        "unitPrice": "50.00",
        "totalPrice": "100.00"
      }
    ],
    "customer": {
      "id": "uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    "createdAt": "2025-07-11T10:00:00Z",
    "completedAt": "2025-07-11T10:15:00Z"
  }
}
```

### Create Order

```
POST /api/merchant/orders
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    {
      "productId": "uuid",
      "quantity": 2,
      "unitPrice": 50.00
    }
  ],
  "customerId": "uuid",
  "orderType": "pos",
  "paymentMethod": "card",
  "discountAmount": 5.00,
  "notes": "Special order"
}
```

**Required Fields:**
- `items`: Array of order items

**Item Fields:**
- `productId`: Product ID
- `quantity`: Quantity ordered
- `unitPrice`: Unit price

### Update Order Status

```
PUT /api/merchant/orders/:orderId/status
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "completed"
}
```

**Status Options:** `pending`, `completed`, `cancelled`

### Cancel Order

```
POST /api/merchant/orders/:orderId/cancel
Authorization: Bearer <token>
```

Cancelling an order will restore stock quantities.

---

## Customer Management

### Get All Customers

```
GET /api/merchant/customers?page=1&limit=20&search=query
Authorization: Bearer <token>
```

### Create Customer

```
POST /api/merchant/customers
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": "customer@example.com",
  "phone": "+1234567890",
  "firstName": "John",
  "lastName": "Doe"
}
```

### Get Customer Details

```
GET /api/merchant/customers/:customerId
Authorization: Bearer <token>
```

---

## Settings & Configuration

### Get Merchant Settings

```
GET /api/merchant/settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "settings": {
    "id": "uuid",
    "name": "Business Name",
    "email": "merchant@example.com",
    "phone": "+1234567890",
    "address": "123 Main St",
    "city": "New York",
    "country": "USA",
    "businessLicense": "LIC123",
    "vatNumber": "VAT123",
    "vatRate": "10.00",
    "status": "active",
    "subscriptionPlan": "professional"
  }
}
```

### Update Merchant Settings

```
PUT /api/merchant/settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "phone": "+1234567890",
  "address": "456 Oak Ave",
  "city": "Boston",
  "vatRate": 12.5
}
```

### Get VAT Settings

```
GET /api/merchant/vat-settings
Authorization: Bearer <token>
```

**Response:**
```json
{
  "success": true,
  "vatSettings": [
    {
      "id": "uuid",
      "country": "USA",
      "vatRate": "10.00",
      "taxId": "TAX123",
      "isDefault": true
    }
  ]
}
```

### Create VAT Setting

```
POST /api/merchant/vat-settings
Authorization: Bearer <token>
Content-Type: application/json

{
  "country": "USA",
  "vatRate": 10.00,
  "taxId": "TAX123",
  "isDefault": true
}
```

### Update VAT Setting

```
PUT /api/merchant/vat-settings/:vatSettingId
Authorization: Bearer <token>
Content-Type: application/json

{
  "vatRate": 12.5,
  "isDefault": true
}
```

### Delete VAT Setting

```
DELETE /api/merchant/vat-settings/:vatSettingId
Authorization: Bearer <token>
```

---

## Error Responses

All endpoints return error responses in this format:

```json
{
  "error": "Error message describing what went wrong"
}
```

**Common HTTP Status Codes:**
- `400`: Bad Request (validation error)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `404`: Not Found (resource doesn't exist)
- `500`: Internal Server Error

---

## Pagination

List endpoints support pagination via query parameters:

```
GET /api/merchant/products?page=2&limit=50
```

**Parameters:**
- `page`: Page number (1-indexed, default: 1)
- `limit`: Items per page (default: 20, max: 100)

---

## SDK Examples

### JavaScript/Node.js

```javascript
const axios = require('axios');

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Get all products
const products = await api.get('/merchant/products?limit=50');

// Create product
const newProduct = await api.post('/merchant/products', {
  name: 'New Product',
  price: 29.99,
  stock: 100
});

// Create order
const order = await api.post('/merchant/orders', {
  items: [
    { productId: 'uuid', quantity: 2, unitPrice: 50 }
  ],
  paymentMethod: 'card'
});
```

### Python

```python
import requests

headers = {
    'Authorization': f'Bearer {token}'
}

# Get all customers
response = requests.get(
    'http://localhost:3000/api/merchant/customers',
    headers=headers
)
customers = response.json()

# Create category
response = requests.post(
    'http://localhost:3000/api/merchant/categories',
    headers=headers,
    json={
        'name': 'Electronics',
        'color': '#FF5733'
    }
)
category = response.json()
```

---

**Version:** 1.0.0  
**Last Updated:** 2026-07-11
