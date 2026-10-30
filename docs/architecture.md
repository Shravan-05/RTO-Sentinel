# System Architecture Document: RTO Sentinel
## AI-Powered COD Risk Management & RTO Prevention Platform

---

## 1. High-Level Architecture Overview

RTO Sentinel is designed as a decoupled, microservices monorepo with clean separation of concerns:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        React 18 + Vite (SPA)                           │
│  - Port: 3000 (Development server)                                     │
│  - Tailwind CSS Premium SaaS Design System (Stripe / Linear aesthetic) │
│  - Recharts Visualizations & KPI Cards                                │
│  - Interactive WhatsApp Verification & Prepaid Conversion Simulator   │
│  - Historical Backtesting Workspace & Policy Comparison                │
│  - Standardized Risk Scale: 0–29, 30–54, 55–74, 75–100                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ REST / JSON (JWT Protected)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Main Backend: Express.js (Node.js)                   │
│  - Port: 4000                                                          │
│  - Authentication, JWT, Rate Limiting, Request Validation              │
│  - Orders Management, Audit Trail & Decision Orchestrator              │
│  - Financial Calculation Engine (Unit-Economics & Margin Protection)   │
│  - WhatsApp State Machine & Controllable Simulation Clock (24h timer)  │
│  - Dual Storage: MongoDB Mongoose + Embedded In-Memory JSON Store      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   AI/ML Microservice: FastAPI (Python)                 │
│  - Port: 8000                                                          │
│  - Preprocessing & Feature Engineering Pipeline (Scikit-Learn/Joblib)  │
│  - Target Encoding: Chronological Expanding-Window (Zero Leakage)      │
│  - Supervised Model: Logistic Regression (L2, Balanced Class Weights)  │
│  - Probability Scoring: Platt-Calibrated Probability (5-fold CV)       │
│  - Deterministic Rule-Based & Google Gemini LLM Address Validation     │
│  - Explainable Risk Decomposition (Standardized Linear Coefficients)   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Responsibilities & Service Contracts

### A. Frontend (`frontend`)
- **Port**: 3000
- **Role**: Operator and Founder experience. Opens directly in **Instant Demo Mode** without requiring a manual login barrier, giving immediate visibility into orders, risk analysis, and simulation workspaces.
- **Key Modules**:
  1. **Founder Dashboard**: 5-second business clarity; Total Orders, COD Orders, COD RTO Rate, RTO Loss Avoided, Net Financial Impact; Yesterday filter with exact bucket counts; Actual vs Counterfactual distinction.
  2. **Order Management**: Search, sort, filter (risk, decision, status, date), detail drawer with explainable risk breakdown. Test order sandbox.
  3. **AI Risk Analysis Workspace**: Interactive order evaluator with real-time scoring, address quality, and plain-English financial justifications.
  4. **WhatsApp Simulator**: Dual-pane phone simulator with two flows (Order Confirmation and ₹20 Prepaid Discount Nudge), quick actions (YES, NO, Invalid, 24h Timeout), real order context linking, and controllable test clock.
  5. **Analytics & Backtesting**: City/Pincode heatmaps, channel breakdown, Ops vs Marketing policy simulation.
  6. **Settings**: Configurable risk thresholds (Ship As-Is: 0–29, Confirmation: 30–54, Prepaid Nudge: 55–74, Hold/Cancel: 75–100), discount values, timeouts, and customer protection overrides.

### B. Main Backend API (`backend`)
- **Port**: 4000
- **Role**: Core transaction hub, decision orchestration, database persistence, and financial modeling.
- **Key Services**:
  - `DecisionOrchestrator`: Evaluates order against ML risk probability, address quality, customer history, and policy rules. Assigns one of 4 canonical actions:
    1. `SHIP_AS_IS` (Low risk: 0–29 score)
    2. `SHIP_AFTER_CONFIRMATION` (Moderate risk: 30–54 score)
    3. `NUDGE_TO_PREPAID` (Elevated risk: 55–74 score)
    4. `HOLD_CANCEL` (Critical risk: 75–100 score)
  - `FinancialEngine`: Centralized unit-economics calculator:
    - Forward shipping = ₹65.00
    - Return shipping = ₹65.00
    - Packaging & handling = ₹25.00
    - Damage probability on returns = 8%
    - Product cost = ₹180.00
    - **Expected RTO Cost** = ₹65 + ₹65 + ₹25 + (0.08 × ₹180) = **₹169.40**
    - **Gross Contribution** = Order Value × 62% (Baseline ₹649 × 0.62 = **₹402.38**)
    - **Simplified Prepaid Conversion Benefit** = $(0.2843 - 0.04) \times ₹169.40 - ₹20 = \mathbf{+₹21.38}$ per converted order.
    - **Mathematical Break-Even RTO Probability**:
      $$\text{EV}(\text{ship}) = (1 - P) \times ₹402.38 - P \times ₹169.40 = 0 \implies P = \frac{402.38}{402.38 + 169.40} = \mathbf{70.37\%}$$
      *(Orders below 70.37% risk have positive expected shipping value; the 75 operational threshold applies risk aversion to protect against variance).*
    - **First-time Customer Protection**: Sunk CAC = ₹300. Cancelling a genuine customer forfeits gross contribution (₹402.38) and destroys the acquired customer lifetime value. CAC is tracked as an asset at risk, not an additional cash outflow.
  - `WhatsAppEngine`: Full state machine tracking `PENDING_CONFIRMATION`, `CONFIRMED`, `DECLINED`, `CONVERTED_PREPAID`, `TIMEOUT_HOLD`. Includes virtual clock fast-forward.
  - `StorageLayer`: MongoDB Mongoose with seamless embedded fallback storage for 100% instant zero-friction local execution.

### C. AI/ML Service (`fastapi`)
- **Port**: 8000
- **Role**: Statistical risk prediction and natural language evaluation.
- **Endpoints**:
  - `POST /api/v1/predict`: Generates RTO probability `[0.0, 1.0]`, risk score `[0, 100]`, risk tier (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), and linear feature contributions.
  - `POST /api/v1/validate-address`: Combines deterministic rule-based checks with Gemini LLM address interpretation (with robust fallback when API key is unset).
  - `GET /health` / `GET /api/v1/health`: Model status, artifact version, uptime.

---

## 3. Standardized Decision Matrix & Policy Rules

| Risk Tier | Risk Score (0–100) | Recommended Decision | Financial Justification |
|---|---|---|---|
| **Low Risk** | 0 – 29 | `SHIP_AS_IS` | High expected positive contribution (+₹402.38); minimal failure risk. Shipping friction is counterproductive. |
| **Medium Risk** | 30 – 54 | `SHIP_AFTER_CONFIRMATION` | Verifies intent via WhatsApp. Cost of message is negligible (₹0.50) compared to avoiding ₹169.40 RTO loss. |
| **High Risk** | 55 – 74 | `NUDGE_TO_PREPAID` | Offers ₹20 discount to secure upfront payment, slashing RTO rate from 28.43% to 4%. Net expected gain = +₹21.38 per converted order. |
| **Critical Risk** | 75 – 100 | `HOLD_CANCEL` | Exceeds mathematical breakeven (70.37%). Expected logistics loss outweighs contribution. For repeat offenders (`prior_rto >= 2`), immediate hold. For first-timers, hold for manual team verification. |

### Golden Safeguards:
1. **First-time Customer Protection Override**: First-time customers (`prior_orders == 0`) with no prior malicious flags are never placed into automatic cancellation without at least one WhatsApp confirmation or prepaid incentive attempt.
2. **Vernacular Address Understanding**: Addresses with colloquial Indian landmarks ("ke paas", "ke saamne") are flagged as positive human intent, not fraud.
3. **Audit Trail**: Every decision logs the exact ML score, model version, timestamp, active thresholds, and financial impact estimate.
