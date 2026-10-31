# MediFlow AI — API reference

Base URL: `http://127.0.0.1:5000/api`

All request and response bodies are JSON (`Content-Type: application/json`). Dates
use `YYYY-MM-DD`; timestamps use ISO-8601. Money is returned as a JSON number with
two decimals.

## Authentication

Every endpoint except `GET /health`, `POST /auth/login` and `POST /auth/register`
requires a bearer token:

```
Authorization: Bearer <token>
```

The token is returned by login/register, expires after `JWT_ACCESS_TOKEN_HOURS`
(default 12) and is revoked by `POST /auth/logout`. Passwords are hashed with
Werkzeug; plaintext passwords are never stored or returned.

## Errors

Every error uses the same shape, which the frontend reads directly:

```json
{
  "message": "Only 40 units of Paracetamol 500 mg are in stock.",
  "status": 422,
  "errors": { "items": "At least one item is required." }
}
```

`errors` is optional and is usually keyed by field name.

| Status | Meaning |
| --- | --- |
| `200` | OK |
| `201` | Created |
| `401` | Missing, invalid, expired or revoked token; wrong login credentials |
| `403` | Authenticated but not allowed (role, permission, or self-registration disabled) |
| `404` | Resource not found, or hidden from a retailer because it belongs to another retailer |
| `409` | Conflict (duplicate email) |
| `422` | Validation or business-rule failure (bad status transition, oversell, negative stock) |
| `500` | Unexpected server error (details are logged, not returned) |

## Roles

| Role | Permissions |
| --- | --- |
| `admin` | `catalog:write`, `inventory:write`, `orders:approve`, `reports:view`, `settings:write`, invoice access |
| `distributor` | `catalog:write`, `inventory:write`, `orders:approve`, `reports:view`, invoice access |
| `retailer` | `orders:create`, `reports:view` (dashboard/reports, scoped to own retailer) |

Retailers only see their own orders and dashboard/report rows. Invoice endpoints are
limited to admins and distributors, matching the UI. The API derives the retailer
from the authenticated user; it never accepts a retailer ID in the order payload.

## Health

### `GET /health`

No authentication.

```json
{
  "status": "ok",
  "service": "mediflow-api",
  "time": "2026-10-31T09:15:04.221+00:00"
}
```

## Auth

### `POST /auth/login`

```json
{
  "email": "admin@mediflow.demo",
  "password": "admin123",
  "role": "admin"
}
```

`role` is optional; when present it must match the account role or the API returns
`403`. Response:

```json
{
  "user": {
    "id": "USR-01",
    "name": "Ananya Krishnan",
    "email": "admin@mediflow.demo",
    "role": "admin",
    "title": "Administrator",
    "initials": "AK",
    "permissions": ["catalog:write", "inventory:write", "orders:approve", "reports:view", "settings:write"],
    "retailerId": null
  },
  "token": "<jwt>",
  "issuedAt": 1793429811000
}
```

### `POST /auth/register`

```json
{
  "name": "Meera Sundar",
  "email": "meera@newpharmacy.dev",
  "password": "strongpass123",
  "organisation": "New Pharmacy",
  "role": "retailer",
  "city": "Chennai",
  "phone": "+91 98400 00000"
}
```

Returns `201` with the same session shape as login. For a retailer registration the
API reuses a retailer with the same organisation name or creates one. Self-service
roles are limited by `REGISTRATION_ALLOWED_ROLES`; the default allows all three,
but a locked-down deployment should allow only `retailer`.

### `GET /auth/profile`

Returns `{ "user": { ... } }` for the current token.

### `PATCH /auth/profile`

```json
{ "name": "Ananya Rao", "title": "Operations Lead" }
```

Both fields are optional. `name` must be at least 3 characters. Initials are
recomputed server-side. Returns `{ "user": { ... } }`.

### `POST /auth/password`

```json
{ "currentPassword": "admin123", "newPassword": "newpassword1" }
```

Returns `{ "ok": true }`. The current password must match and the new password
must be at least 8 characters and different from the old one.

### `POST /auth/logout`

Revokes the current token (its `jti` is stored in `revoked_tokens`). Returns
`{ "ok": true }`.

## Medicines

Read endpoints require a valid token. Writes require `catalog:write`
(admin/distributor).

### `GET /medicines`

Returns an array of medicines. Only active catalog entries are included.

```json
[
  {
    "id": "MED-001",
    "name": "Paracetamol",
    "brand": "Panadol",
    "strength": "500 mg",
    "dosageForm": "Tablet",
    "packSize": "10 tablets x 10 strips",
    "category": "Analgesic",
    "unitPrice": 1.85,
    "supplier": "MedCore Distributors",
    "reorderLevel": 120,
    "batches": [
      {
        "id": "BATCH-4200",
        "batchNumber": "MF2401",
        "expiryDate": "2027-04-30",
        "quantity": 180,
        "supplier": "MedCore Distributors",
        "receivedDate": "2026-02-14",
        "costPrice": 1.45,
        "warehouse": "Chennai Central WH"
      }
    ],
    "availableQuantity": 180,
    "primaryExpiryDate": "2027-04-30",
    "requiresPrescription": false,
    "isSample": false,
    "availability": "In stock"
  }
]
```

`availability` is one of `In stock`, `Low stock`, `Out of stock`.
`availableQuantity` is computed from batch inventory.

### `GET /medicines/:id`

Returns one medicine in the same shape, or `404` if it is missing/archived.

### `POST /medicines`

```json
{
  "name": "Cetirizine",
  "brand": "Zyrtec",
  "strength": "10 mg",
  "dosageForm": "Tablet",
  "packSize": "10 tablets x 10 strips",
  "category": "Antihistamine",
  "supplier": "Vertex Generics",
  "unitPrice": 3.5,
  "reorderLevel": 20,
  "batchNumber": "MF900",
  "expiryDate": "2027-10-31",
  "quantity": 25,
  "costPrice": 2.5,
  "warehouse": "Chennai Central WH"
}
```

Required: `name`, `brand`, `strength`, `packSize`, `unitPrice` (> 0).
`batchNumber`/`expiryDate` are optional; when `batchNumber` is present an opening
batch and inventory row are created. `quantity` must be ≥ 0. If `costPrice` is
omitted it defaults to 78% of `unitPrice`. Returns `201` with the new medicine.

### `PUT /medicines/:id`

Partial update. Accepted fields: `name`, `brand`, `strength`, `dosageForm`,
`packSize`, `category`, `supplier`, `unitPrice`, `reorderLevel`,
`requiresPrescription`. Returns the updated medicine.

### `DELETE /medicines/:id`

Soft-deletes the catalog entry (`is_active = false`) so historical orders and
invoices stay readable. Returns `{ "ok": true }`.

## Inventory

### `GET /inventory`

Returns one row per batch:

```json
[
  {
    "id": "BATCH-4200",
    "medicineId": "MED-001",
    "medicine": "Paracetamol 500 mg",
    "brand": "Panadol",
    "batchNumber": "MF2401",
    "quantity": 180,
    "reorderLevel": 120,
    "expiryDate": "2027-04-30",
    "daysToExpiry": 181,
    "supplier": "MedCore Distributors",
    "costPrice": 1.45,
    "stockValue": 261.0,
    "retailValue": 333.0,
    "status": "Healthy",
    "canAdjust": true,
    "warehouse": "Chennai Central WH"
  }
]
```

`status` is one of `Healthy`, `Low stock`, `Near expiry` (≤ 90 days),
`Out of stock`.

### `GET /inventory/summary`

```json
{
  "totalBatches": 92,
  "totalUnits": 18450,
  "inventoryValue": 912345.67,
  "lowStockCount": 10,
  "nearExpiryCount": 13,
  "outOfStockCount": 0
}
```

### `GET /inventory/movements`

Latest 200 stock movements, newest first:

```json
[
  {
    "id": "MOV-1200",
    "date": "2026-10-31",
    "medicineId": "MED-001",
    "medicine": "Paracetamol 500 mg",
    "type": "Outbound",
    "quantity": -20,
    "reference": "ORD-2041",
    "user": "System (order fulfilment)"
  }
]
```

Movement types include `Inbound`, `Outbound`, `Adjustment`, `Return`. Quantities
are signed (negative for outbound).

### `POST /inventory/batches/:batchId/adjust`

Requires `inventory:write`.

```json
{ "delta": 5, "reason": "Cycle count" }
```

`delta` must be non-zero. The resulting quantity cannot be negative; a violation
returns `422` and changes nothing. Returns the full inventory row array.

## Orders

### `GET /orders`

Returns orders newest first. Admins/distributors see all orders; retailers see only
their own.

```json
[
  {
    "id": "ORD-2041",
    "retailerId": "RTL-01",
    "retailer": "Apex Medical Retail",
    "orderDate": "2026-10-30",
    "status": "Pending",
    "items": [
      {
        "id": "ITM-2041-1",
        "medicineId": "MED-001",
        "name": "Paracetamol 500 mg",
        "brand": "Panadol",
        "packSize": "10 tablets x 10 strips",
        "quantity": 40,
        "unitPrice": 1.85,
        "lineTotal": 74.0
      }
    ],
    "itemCount": 1,
    "totalQuantity": 40,
    "totalAmount": 74.0,
    "paymentTerms": "Net 30",
    "warehouse": "Chennai Central WH",
    "timeline": [
      { "label": "Order placed", "timestamp": "2026-10-30T09:12:00", "done": true }
    ]
  }
]
```

### `GET /orders/:id`

Same shape. Retailers receive `404` for orders belonging to another retailer.

### `POST /orders`

Requires `orders:create` (retailer only) and a retailer profile linked to the
account.

```json
{
  "items": [
    { "medicineId": "MED-001", "quantity": 40 },
    { "medicineId": "MED-002", "quantity": 5 }
  ],
  "warehouse": "Chennai Central WH"
}
```

- `items` must contain 1–100 lines; duplicate medicine IDs are combined.
- Quantities must be integers ≥ 1.
- Prices and line totals are computed from the catalog. Any `unitPrice` or
  `lineTotal` sent by the client is ignored.
- Stock is allocated FEFO (earliest expiry first), preferring the requested
  warehouse and falling back to other warehouses. Expired batches are excluded.
- The order, items, allocations, outbound movements and invoice are written in one
  transaction. If the total cannot be fulfilled, the request returns `422` and
  nothing is committed.
- PostgreSQL row locks prevent concurrent orders from overselling the same stock.

Returns `201` with the order. The invoice is created immediately with
`paymentStatus: "Pending"`, `taxAmount` = 5% of the order total, and
`grandTotal` = total + tax.

### `PATCH /orders/:id/status`

```json
{ "status": "Approved" }
```

Admins/distributors may move any order; retailers may only cancel their own
`Pending`/`Approved` orders. Allowed transitions:

```
Pending    -> Approved | Cancelled
Approved   -> Processing | Cancelled
Processing -> Shipped
Shipped    -> Delivered
Delivered  -> (terminal)
Cancelled  -> (terminal)
```

Any other transition returns `422`. Cancelling restores allocated quantities,
writes `Return` movements and marks the invoice `Cancelled`.

## Retailers

### `GET /retailers`

Returns retailer records. Retailers receive only their own record.

```json
[
  {
    "id": "RTL-01",
    "name": "Apex Medical Retail",
    "city": "Chennai",
    "contact": "S. Balaji",
    "phone": "+91 98400 11223"
  }
]
```

## Invoices

All invoice endpoints require an admin or distributor token. Retailers receive
`403`.

### `GET /invoices`

```json
[
  {
    "id": "INV-9025",
    "invoiceNumber": "MF/25-26/01291",
    "orderId": "ORD-2041",
    "retailer": "Apex Medical Retail",
    "invoiceDate": "2026-10-30",
    "dueDate": "2026-11-29",
    "totalAmount": 74.0,
    "taxAmount": 3.7,
    "grandTotal": 77.7,
    "paymentStatus": "Pending",
    "paidOn": null
  }
]
```

### `GET /invoices/:id`

The list shape plus `items`, `retailerRecord` and `warehouse`.

### `POST /invoices/:id/payment`

Marks the invoice `Paid` and sets `paidOn` to today. Already-paid invoices are
returned unchanged (idempotent). Cancelled invoices return `422`.

## Analytics

All analytics endpoints require `reports:view`. Retailer results are scoped to
their own orders.

### `GET /analytics/dashboard`

```json
{
  "stats": {
    "totalMedicines": 40,
    "pendingOrders": 2,
    "lowStockMedicines": 10,
    "nearExpiryBatches": 13
  },
  "sales": { "7d": [], "30d": [], "90d": [] },
  "recentOrders": [],
  "lowStock": [],
  "insights": { "recommendations": [] },
  "activity": [],
  "notifications": []
}
```

Each `sales` series has one entry per day:
`{ "date": "2026-10-31", "revenue": 1200.0, "orders": 3, "units": 42 }`.

### `GET /analytics/reports`

```json
{
  "salesTrend": [],
  "orderVolume": [],
  "topSelling": [],
  "inventoryValuation": {},
  "stockMovement": [],
  "expiryRisk": {},
  "kpis": {
    "orders30d": 0,
    "units30d": 0,
    "revenue30d": 0,
    "avgOrderValue": 0
  }
}
```

All aggregates are computed in SQL/PostgreSQL or from current database rows; none
are accepted from the client.

### `GET /analytics/forecast?horizon=7`

`horizon` is clamped to 1–90 (default 7). Returns a moving-average rule-engine
projection, not a trained ML model:

```json
{
  "isDemo": false,
  "disclaimer": "Rule-based projection for planning only; not predictions from a trained model.",
  "horizon": 7,
  "model": { "name": "Moving-average rule engine", "sampleSize": 30 },
  "monthlyForecast": [],
  "demandForecast": [],
  "recommendations": [],
  "expiryRisk": []
}
```

`demandForecast` rows contain `medicineId`, `label`, `predicted` (units over the
horizon) and `actual` (units issued recently). Recommendations include
`suggestedQuantity`, `urgency` and a human-readable reason.

## Frontend mapping

The React services call exactly these paths:

| Service | Calls |
| --- | --- |
| `authService` | `POST /auth/login`, `POST /auth/register`, `POST /auth/logout`, `GET/PATCH /auth/profile`, `POST /auth/password` |
| `medicineService` | `GET/POST /medicines`, `GET/PUT/DELETE /medicines/:id` |
| `inventoryService` | `GET /inventory`, `GET /inventory/summary`, `GET /inventory/movements`, `POST /inventory/batches/:id/adjust` |
| `orderService` | `GET/POST /orders`, `GET /orders/:id`, `PATCH /orders/:id/status`, `GET /retailers` |
| `analyticsService` | `GET /invoices`, `GET /invoices/:id`, `POST /invoices/:id/payment`, `GET /analytics/dashboard`, `GET /analytics/reports`, `GET /analytics/forecast` |

When any protected call returns `401`, the frontend clears its stored token/session
and redirects to `/login`.
