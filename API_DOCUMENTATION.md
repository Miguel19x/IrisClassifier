# IrisClassifier - API Documentation

Base URL: `http://localhost:8000/api/v1`

---

## Authentication

All endpoints (except health check) require JWT authentication.

```
Authorization: Bearer <token>
```

### Login

#### `POST /auth/login`

```json
// Request
{
  "email": "admin@iris.com",
  "password": "admin123"
}

// Response
{
  "access_token": "eyJ...",
  "token_type": "bearer"
}
```

---

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| General API | 60 requests | 1 minute |
| File Upload | 10 requests | 1 minute |
| Gemini AI | 10 requests | 1 minute |

Response headers:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Price Lists

### List Price Lists

#### `GET /lists`

Get all price lists for the authenticated user.

**Query Parameters**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | - | Filter: `pending`, `processing`, `completed`, `failed` |
| `page` | integer | No | 1 | Page number |
| `page_size` | integer | No | 20 | Items per page (max: 100) |

**Response** `200 OK`
```json
{
  "lists": [
    {
      "id": 1,
      "name": "Lista Proveedor A",
      "source_file": "lista_precios.pdf",
      "file_type": "application/pdf",
      "file_size_bytes": 1048576,
      "status": "completed",
      "product_count": 150,
      "created_at": "2024-01-15T10:30:00Z",
      "processed_at": "2024-01-15T10:32:45Z"
    }
  ],
  "total": 25,
  "page": 1,
  "page_size": 20
}
```

---

### Get Price List

#### `GET /lists/{list_id}`

Get a single price list by ID.

**Response** `200 OK`
```json
{
  "id": 1,
  "name": "Lista Proveedor A",
  "source_file": "lista_precios.pdf",
  "status": "completed",
  "product_count": 150,
  "created_at": "2024-01-15T10:30:00Z"
}
```

---

### Upload Price List

#### `POST /lists/upload`

Upload a file for processing with ETL Intelligent.

**Supported Formats**: PDF, XLSX, XLS, PNG, JPG

**Processing Pipeline**:
1. File extraction (Gemini 2.5 Flash / Excel parser)
2. ETL Layer 1: Structural Analysis
3. ETL Layer 2: Historical Validation (Code Registry)
4. ETL Layer 3: Sanitization & Review Flag
5. Save to master_products table

**Request**
```bash
curl -X POST "http://localhost:8000/api/v1/lists/upload" \
  -H "Authorization: Bearer <token>" \
  -F "file=@lista_precios.pdf"
```

**Response** `202 Accepted`
```json
{
  "list_id": 1,
  "message": "Procesamiento iniciado",
  "status": "processing"
}
```

---

### Delete Price List

#### `DELETE /lists/{list_id}`

Delete a price list and all associated products.

**Response** `200 OK`
```json
{
  "message": "Lista eliminada exitosamente",
  "list_id": 1
}
```

---

## Products

### List Products

#### `GET /products`

Get products with optional filters.

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `list_id` | integer | Filter by price list ID |
| `price_range_id` | integer | Filter by price range |
| `min_price` | float | Minimum price |
| `max_price` | float | Maximum price |
| `page` | integer | Page number |
| `page_size` | integer | Items per page |

**Response** `200 OK`
```json
{
  "products": [
    {
      "id": 1,
      "list_id": 1,
      "code": "90915-YZZE1",
      "name": "Filtro de Aceite Toyota",
      "brand": "TOYOTA",
      "price": 12.50,
      "currency": "USD",
      "confidence_score": 0.95,
      "classification_method": "ai"
    }
  ],
  "total": 150,
  "page": 1,
  "page_size": 50
}
```

---

### Update Product

#### `PATCH /products/{product_id}`

Update product fields.

**Request Body**
```json
{
  "name": "Nombre actualizado",
  "price": 15.99,
  "price_range_id": 2
}
```

---

## Master Table (Gestión Listados)

The Master Table consolidates all products from all price lists into a unified view with intelligent code normalization.

### List Master Products

#### `GET /master-products`

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `view_mode` | string | `enterprise` or `client` |
| `sort_by` | string | `alphabetical`, `brand`, `description`, `price` |
| `brand_filter` | string | Filter by brand |
| `review_status_filter` | string | `pending`, `confirmed`, `rejected` |
| `page` | integer | Page number |
| `limit` | integer | Items per page |

**Response** `200 OK`
```json
{
  "products": [
    {
      "id": 1,
      "index_number": 1,
      "clean_code": "90915-YZZE1",
      "description": "Filtro de Aceite Toyota",
      "brand": "TOYOTA",
      "price_usd": 12.50,
      "review_status": "confirmed",
      "confidence_score": 0.95,
      "source_list_id": 1,
      "original_list_name": "Lista Proveedor A",
      "margin_percentage": 15.0,
      "final_price": 14.38
    }
  ],
  "total": 500,
  "page": 1,
  "limit": 50,
  "has_next": true,
  "has_prev": false
}
```

---

### Get Price Statistics

#### `GET /master-products/stats`

Get price statistics for heatmap percentile calculation.

**Response** `200 OK`
```json
{
  "min_price": 5.00,
  "max_price": 500.00,
  "p25": 25.00,
  "p50": 75.00,
  "p75": 150.00
}
```

---

### Export Master Products

#### `GET /master-products/export`

Export master products to PDF or Excel.

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `format` | string | `excel` or `pdf` |
| `view_mode` | string | `enterprise` or `client` |
| `sort_by` | string | Sort order |
| `brand_filter` | string | Filter by brand |
| `review_status_filter` | string | Filter by review status |

**Response**: File download

---

### Update Margin

#### `PATCH /master-products/{product_id}/margin`

Update margin percentage (Enterprise View).

**Request Body**
```json
{
  "margin_percentage": 15.0
}
```

**Response** `200 OK`
```json
{
  "status": "success",
  "final_price": 14.38
}
```

---

### Update Final Price

#### `PATCH /master-products/{product_id}/final-price`

Update final price (Client View).

**Request Body**
```json
{
  "final_price": 15.00
}
```

**Response** `200 OK`
```json
{
  "status": "success",
  "margin_percentage": 20.0
}
```

---

### Update Review Status

#### `PATCH /master-products/{product_id}/review-status`

Confirm or reject a product with low confidence.

**Query Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | `confirmed` or `rejected` |

---

## Price Ranges

### List Price Ranges

#### `GET /price-ranges`

**Response** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Barato",
    "min_price": 0,
    "max_price": 50,
    "color": "#22c55e",
    "display_order": 1
  },
  {
    "id": 2,
    "name": "Mediano",
    "min_price": 50,
    "max_price": 200,
    "color": "#eab308",
    "display_order": 2
  },
  {
    "id": 3,
    "name": "Caro",
    "min_price": 200,
    "max_price": null,
    "color": "#ef4444",
    "display_order": 3
  }
]
```

---

### Create Price Range

#### `POST /price-ranges`

**Request Body**
```json
{
  "name": "Premium",
  "min_price": 500,
  "max_price": null,
  "color": "#8b5cf6",
  "display_order": 4
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 422 | Invalid request data |
| `NOT_FOUND` | 404 | Resource not found |
| `UNAUTHORIZED` | 401 | Invalid or missing token |
| `RATE_LIMITED` | 429 | Too many requests |
| `FILE_TOO_LARGE` | 413 | File exceeds limit |
| `PROCESSING_ERROR` | 500 | Processing failed |

---

## Health Check

#### `GET /health`

```json
{
  "status": "healthy",
  "version": "1.0.0",
  "database": "connected"
}
```
