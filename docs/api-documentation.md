# RTO Sentinel — API Documentation

**Version:** 1.0  
**Backend:** Node.js + Express.js  
**AI Service:** Python + FastAPI  
**Frontend:** React + Vite

---

## 1. Overview

RTO Sentinel is an AI-powered Cash on Delivery (COD) risk management platform designed to identify potentially high-risk orders before shipment.

The platform uses a three-tier architecture:

| Service | Technology | Port |
|---|---|---:|
| Frontend | React + Vite | 3000 |
| Backend API | Node.js + Express.js | 4000 |
| AI/ML Service | Python + FastAPI | 8000 |

The Express backend acts as the central transaction layer. It communicates with the FastAPI service for machine-learning predictions and address validation.

## 2. Base URLs

### Express Backend

```text
http://localhost:4000
```

### FastAPI ML Service

```text
http://localhost:8000
```

### Frontend Application

```text
http://localhost:3000
```

## 3. Authentication and Demo Mode

### Instant Demo Mode

RTO Sentinel currently runs in **Instant Demo Mode**.

When the application is opened, the user is already logged in and is taken directly to the dashboard.

- No login screen is displayed.
- No manual login is required.
- No registration is required.
- The user can directly explore the available dashboard features.
- The demo provides an immediately accessible application experience.

**Important clarification:** The absence of a login screen in the demo experience should not be interpreted as a statement that every API request automatically receives administrator privileges. The frontend demo experience and backend API authentication behavior are separate concerns.

For a production deployment, proper authentication, authorization, session management, and role-based access control should be configured.

## 4. API Communication

The frontend communicates with the Express backend using HTTP REST requests.

The backend communicates with the FastAPI service internally.

### Request format

```http
Content-Type: application/json
```

### Response format

Responses use JSON.

### Example request

```http
GET /api/v1/orders
Host: localhost:4000
Accept: application/json
```

## 5. Express Backend API

The Express backend is responsible for:

- Order management
- Risk decision processing
- Financial calculations
- WhatsApp simulation
- Analytics and backtesting
- Application settings
- Communication with the AI service

### 5.1 Orders

The Orders module provides access to historical and evaluated COD orders.

**Example request**

```http
GET /api/v1/orders
```

**Purpose**

Retrieve orders for the order management dashboard.

Typical order information includes:

| Field | Description |
|---|---|
| orderId | Unique order identifier |
| customerName | Customer name |
| phone | Customer contact number |
| city | Delivery city |
| pincode | Delivery postal code |
| paymentMode | COD or prepaid |
| orderValue | Order amount |
| riskScore | Operational risk score |
| decision | Recommended business action |
| orderStatus | Current order status |

**Example response structure**

```json
{
  "success": true,
  "data": {
    "orders": [],
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

The values shown above are illustrative placeholders, not live database counts.

### 5.2 Risk Analysis

The Risk Analysis module evaluates an order and generates a risk assessment.

**Purpose**

- Evaluate order information.
- Obtain an ML prediction.
- Consider address quality.
- Calculate an operational risk score.
- Assign a decision category.

The risk assessment distinguishes the following concepts:

| Field | Meaning |
|---|---|
| ml_raw_score | Raw model output |
| ml_calibrated_probability | Calibrated ML probability |
| address_quality_score | Address quality assessment |
| operational_risk_score | Operational risk assessment |
| riskScore | Final 0–100 risk score |
| decision | Recommended operational action |

**Decision categories**

| Decision | Risk score | Recommended action |
|---|---:|---|
| SHIP_AS_IS | 0–29 | Proceed with fulfilment |
| SHIP_AFTER_CONFIRMATION | 30–54 | Request customer confirmation |
| NUDGE_TO_PREPAID | 55–74 | Encourage prepaid payment |
| HOLD_CANCEL | 75–100 | Hold for manual review |

**Important:** HOLD_CANCEL represents a hold and review recommendation. It should not be interpreted as unconditional automatic cancellation.

### 5.3 WhatsApp Simulator

The WhatsApp Simulator demonstrates customer interaction workflows.

It includes:

- Order confirmation messages
- Customer response simulation
- Confirmation and rejection handling
- Virtual clock functionality
- Timeout handling
- Order state transitions

The simulator is intended to demonstrate how customer confirmation can support COD risk management.

### 5.4 Analytics and Backtesting

The Analytics module provides insights into historical order outcomes and policy performance.

It supports analysis such as:

- Delivered versus RTO orders
- RTO percentage
- City-wise risk distribution
- Order risk categories
- Policy comparison
- Historical backtesting
- Financial contribution comparison

Backtesting results represent historical or simulated policy outcomes and should not be interpreted as guaranteed future savings.

### 5.5 Settings

The Settings module provides configuration for business rules and operational thresholds.

Relevant configuration areas include:

- Risk thresholds
- Unit economics
- Shipping costs
- Reverse logistics costs
- Packaging costs
- Business decision parameters

The actual configuration values are maintained in the application's configuration files.

## 6. FastAPI ML Service

The Python FastAPI service provides machine-learning inference and address validation.

**Base URL**

```text
http://localhost:8000
```

The service is responsible for:

- Loading trained ML artifacts
- Preparing input features
- Generating RTO predictions
- Applying probability calibration
- Assessing address quality
- Returning prediction results

### 6.1 Health Check

```http
GET /health
```

**Purpose:** Check whether the AI service is available.

### 6.2 RTO Prediction

```http
POST /predict
```

**Purpose:** Generate an RTO prediction using the trained machine-learning pipeline.

The service uses the trained Logistic Regression model and its associated preprocessing and calibration components.

### 6.3 Address Validation

```http
POST /validate-address
```

**Purpose:** Evaluate the quality of a customer's delivery address.

Address validation uses deterministic heuristics and can integrate with Google Gemini when the required API key is configured.

If Gemini is unavailable or not configured, the rule-based fallback is used.

**Note:** These paths describe the FastAPI service interface. Confirm the exact route prefixes and request schemas in the deployed FastAPI router.

## 7. Risk Scoring Logic

RTO Sentinel uses four operational decision categories.

| Risk score | Decision |
|---:|---|
| 0–29 | SHIP_AS_IS |
| 30–54 | SHIP_AFTER_CONFIRMATION |
| 55–74 | NUDGE_TO_PREPAID |
| 75–100 | HOLD_CANCEL |

The scoring pipeline distinguishes the model's raw output, calibrated probability, address quality assessment, and final operational score.

The calibrated ML probability and operational risk score are not interchangeable.

### Financial assumptions

The current financial model uses:

| Parameter | Value |
|---|---:|
| Average order value | ₹649 |
| Gross margin | 62% |
| Delivered gross contribution | ₹402.38 |
| Expected RTO cost | ₹169.40 |
| Mathematical break-even probability | 70.37% |

The break-even probability is a financial calculation based on the assumed delivered contribution and RTO cost. It should not be treated as the same thing as the operational risk score.

## 8. Error Handling

The API uses JSON responses for request failures and validation errors.

A typical error response may follow this structure:

```json
{
  "success": false,
  "message": "An error occurred while processing the request."
}
```

Possible error conditions include:

| HTTP status | Meaning |
|---|---|
| 400 | Invalid request or validation failure |
| 401 | Authentication required, where applicable |
| 403 | Access denied, where applicable |
| 404 | Resource not found |
| 500 | Internal server error |
| 503 | Dependent service unavailable |

The exact status codes depend on the individual route and its error-handling implementation.

## 9. Service Communication Flow

The application follows this communication sequence:

1. The user opens the React application.
2. The application loads directly into the dashboard in Instant Demo Mode.
3. The frontend sends API requests to the Express backend.
4. The backend retrieves or updates order information.
5. When required, the backend communicates with the FastAPI ML service.
6. The ML service generates predictions and address assessments.
7. The backend applies the operational decision logic.
8. The frontend displays the resulting information.

## 10. Environment Configuration

The application uses environment variables for service configuration.

Example configuration:

```env
PORT=4000
GEMINI_API_KEY=your_gemini_api_key
```

Keep actual API keys and secrets out of source control.

The Gemini integration is optional. The rule-based address validator remains available when the API key is not configured.

## 11. Running the Services

Start each service in a separate terminal from the repository root.

### Terminal 1 — FastAPI

```bash
cd fastapi
uvicorn app.main:app --reload --port 8000
```

### Terminal 2 — Express Backend

```bash
cd backend
node src/server.js
```

### Terminal 3 — React Frontend

```bash
cd frontend
npm run dev
```

Open the application:

```text
http://localhost:3000
```

The application opens directly into the demo dashboard. No manual login is required.

## 12. Project Structure

```text
rto-sentinel/
│
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   └── services/
│   ├── tests/
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── features/
│   │   ├── services/
│   │   └── lib/
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── fastapi/
│   ├── app/
│   │   ├── api/
│   │   ├── core/
│   │   ├── llm/
│   │   ├── ml/
│   │   ├── schemas/
│   │   ├── services/
│   │   └── main.py
│   ├── artifacts/
│   ├── data/
│   ├── tests/
│   └── requirements.txt
│
├── config/
├── docs/
├── scripts/
├── docker-compose.yml
├── package.json
├── .env.example
├── .gitignore
└── README.md
```

## 13. Testing

The project includes automated tests for the backend and AI service.

### Backend tests

```bash
npm --prefix backend test
```

### FastAPI tests

```bash
python -m unittest discover -s fastapi/tests -p "test_*.py"
```

### Full system verification

```bash
python scripts/verify.py
```

Refer to the test output for the actual execution results.

---

## 14. Production Considerations

Before production deployment, the following should be configured and reviewed:

- Proper user authentication and authorization
- Secure session and token management
- Environment-specific secrets
- API request validation
- Rate limiting
- Logging and monitoring
- Database backups
- Error handling and service availability
- Secure deployment of the ML service

**RTO Sentinel is currently presented as an assignment/demo application with Instant Demo Mode. Production security settings should be enabled before exposing the application to real customers or business data.**