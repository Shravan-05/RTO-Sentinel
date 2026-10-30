# 🛡️ RTO Sentinel

### *Prevent RTO. Protect Revenue. Make Smarter Decisions.*

An AI-powered COD (Cash on Delivery) Risk Management & RTO Prevention Platform for D2C e-commerce businesses. Built as a production-quality SaaS application demonstrating ML integration, explainable AI, and financially-justified decision making.

---

## 🏗️ What It Does

RTO Sentinel evaluates every COD order **before shipment** and routes it into one of four operational decision buckets using:

- **Logistic Regression ML model** (L2, balanced class weights) trained on historical order data with chronological split and Chronological Expanding-Window target encoding — ROC-AUC: **0.7246**, F1: **0.5068**, Recall: **59.89%**, Accuracy: **68.41%**, Precision: **43.92%**
- **Google Gemini API** for intelligent address quality validation (rule-based fallback always active)
- **Financial arbitration engine** — EV(ship) = (1 − p) × ₹402.38 − p × ₹169.40; mathematical break-even: **p = 70.37%**
- **Interactive WhatsApp Simulator** with test clock fast-forward

| Decision | Risk Score | Business Action |
|---|---|---|
| ✅ SHIP_AS_IS | 0 – 29 | Fast-track fulfilment |
| 💬 SHIP_AFTER_CONFIRMATION | 30 – 54 | WhatsApp 1-click confirmation |
| 💜 NUDGE_TO_PREPAID | 55 – 74 | ₹20 discount payment link |
| 🚫 HOLD_CANCEL | 75 – 100 | Hold pending manual review |

> `riskScore = Math.round(rto_probability × 100)` — a 0–100 integer derived from the blended calibrated RTO probability (70% calibrated probability + 30% address risk penalty). The raw sigmoid score is also recorded as `ml_raw_score` alongside `ml_calibrated_probability`.

---

## ⚡ Quick Start (Under 5 Minutes)

### Prerequisites

- **Node.js** ≥ 22 ([download](https://nodejs.org))
- **Python** ≥ 3.12 ([download](https://python.org))

> MongoDB is **optional** — the app runs fully with a local JSON store.

---

### Step 1: Clone & Install Dependencies

```bash
# Install Node.js backend dependencies
cd backend
npm install

# Install Python AI Engine dependencies
cd ../fastapi
pip install -r requirements.txt
```

### Step 2: Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

### Step 3: Train the ML Model

```bash
cd ../fastapi
python app/ml/training/train.py
```

You should see:
```
SELECTED CHAMPION MODEL: Logistic Regression (L2) (F1-Score: 0.5068)
Champion model saved to: .../artifacts/model.joblib
Calibrated model saved to: .../artifacts/model_calibrated.joblib
Training phase complete successfully!
```

> The training script performs chronological train/test split (Apr–Jul train, Aug–Sep test), applies Chronological Expanding-Window (EW) target encoding with global prior smoothing ($m=10.0$), trains 5-fold CV Platt Scaling calibration, and saves `model.joblib`, `model_calibrated.joblib`, `metrics.json`, `feature_importance.json`, and lookup tables to `artifacts/`.
>
> **Note on Temporal Target Encoding:** Chronological Expanding-Window encoding strictly guarantees that each order $i$ in training encodes its category prior only from orders observed prior to its timestamp ($0 \dots i-1$). The final test/holdout split uses fixed frozen lookup tables fitted exclusively on the 1,297 training orders, guaranteeing zero future-to-past data leakage.

### Step 4: Configure Environment (Optional)

```bash
# Copy the example env file
cp .env.example .env
```

To enable Gemini AI address validation, add your free API key:
```
GEMINI_API_KEY=your_key_from_aistudio.google.com
```
> If left empty, the rule-based address validator handles all requests automatically.

### Step 5: Start All Three Services

**Terminal 1 — FastAPI AI Engine (port 8000):**
```bash
cd fastapi
uvicorn app.main:app --reload --port 8000
```

**Terminal 2 — Express Backend API (port 4000):**
```bash
cd backend
node src/server.js
```

**Terminal 3 — React Frontend (port 3000):**
```bash
cd frontend
npm run dev
```

### Step 6: Open the Platform

🌐 **http://localhost:3000**

> **Instant Demo Mode:** The web application opens directly into demo mode with full interactive access — no manual login screen is required. For API requests, built-in admin credentials (`admin@rtosentinel.com` / `admin123`) or default bypass tokens are automatically supported.
> 
> The platform auto-seeds all 2,018 historical orders from `orders_sample.csv` on first run into persistent/in-memory storage.

---

## 🧪 Running Tests

### Python AI Engine Tests (20 tests):
```bash
python -m unittest discover -s fastapi/tests -p "test_*.py"
```

### Express Backend Tests (15 tests across 6 suites):
```bash
npm --prefix backend test
```

### Full System Verification (24 checks):
```bash
python scripts/verify.py
```

Expected output: All 24 checks and 35 automated tests passing ✅

---

## 📁 Project Structure

```
rto-sentinel/
├── backend/                  # Node.js + Express.js backend (port 4000)
│   ├── src/
│   │   ├── config/           # Environment configuration
│   │   ├── controllers/      # Route handlers (orders, whatsapp, analytics, settings)
│   │   ├── middleware/       # JWT auth, request validation
│   │   ├── routes/           # Express router
│   │   └── services/
│   │       ├── storage.js         # MongoDB + JSON fallback
│   │       ├── aiClient.js        # AI engine proxy with local fallback
│   │       ├── decisionEngine.js  # 4-bucket decision arbitration
│   │       ├── financialEngine.js # Unit economics calculations
│   │       └── whatsappService.js # FSM simulator with test clock
│   ├── tests/                # 15 Node.js unit and integration tests
│   └── package.json
│
├── frontend/                 # React 18 + Vite + Tailwind frontend (port 3000)
│   ├── src/
│   │   ├── components/       # Shared UI (Button, Card, Drawer, Modal, Badge)
│   │   ├── features/         # Page-level features
│   │   │   ├── dashboard/         # Founder intelligence dashboard
│   │   │   ├── orders/            # Order management + ML explainability drawer
│   │   │   ├── risk-analysis/     # Interactive live AI scoring workspace
│   │   │   ├── whatsapp/          # WhatsApp simulator with test clock
│   │   │   ├── analytics/         # Geographic breakdown + policy backtesting
│   │   │   └── settings/          # Configurable thresholds & economics
│   │   ├── services/         # Axios API client
│   │   └── lib/              # Utilities (cn, formatCurrency, formatDate)
│   ├── public/
│   └── package.json
│
├── fastapi/                  # Python 3.12 FastAPI ML microservice (port 8000)
│   ├── app/
│   │   ├── api/              # FastAPI routes
│   │   ├── core/             # Config & settings
│   │   ├── llm/              # Gemini API + rule-based address validator
│   │   ├── ml/
│   │   │   ├── preprocessing/      # Feature extraction pipeline (Expanding-Window)
│   │   │   └── training/           # Model benchmarking & 5-fold CV Platt training
│   │   ├── schemas/          # Pydantic request/response models
│   │   ├── services/         # Prediction service (ML + business rules)
│   │   └── main.py
│   ├── artifacts/            # model.joblib, model_calibrated.joblib, metrics.json
│   ├── data/raw/             # orders_sample.csv
│   ├── tests/                # 20 automated Python tests
│   └── requirements.txt
│
├── config/
│   ├── risk-thresholds.json  # Configurable risk tier boundaries (0-29/30-54/55-74/75-100)
│   └── business-rules.json  # Unit economics parameters
│
├── docs/
│   ├── business-memo.md      # 5 assignment questions answered with exact numbers
│   ├── decision-log.md       # Key technical decisions & justifications (DEC-001 to DEC-009)
│   ├── ai-usage-log.md       # All ML models, APIs, and calibration benchmarks
│   ├── architecture.md       # System design, topology, and service contracts
│   ├── eda-report.md         # Exploratory Data Analysis & dataset reconciliation
│   └── api-documentation.md  # Comprehensive REST API specifications (ports 4000 & 8000)
│
├── scripts/
│   └── verify.py             # 24-point automated environment & smoke verification
│
├── docker-compose.yml
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## 🧠 AI/ML Architecture

```
Order Submitted
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│               FEATURE EXTRACTION (pipeline.py)           │
│  • Customer history  • Address quality  • Temporal       │
│  • Geographic risk   • Payment method  • Name quality    │
│  Chronological Expanding-Window Encoding (ZERO leakage)  │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│      LOGISTIC REGRESSION + PLATT PROBABILITY CALIBRATION │
│  ROC-AUC: 0.725 | Recall: 59.89% | F1: 0.5068           │
│  Raw Sigmoid: Brier = 0.2078 (Mean predicted = 0.4470)   │
│  Platt Calibrated (5-fold CV): Brier = 0.1719 (Mean = 0.2858)│
│  Outputs: P(RTO) = 0.00 – 1.00 (Calibrated & Raw)       │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│         GEMINI ADDRESS VALIDATOR (+ rule fallback)       │
│  quality_score: 0-100 | category | issues | correction  │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│         FINANCIAL ARBITRATION ENGINE                     │
│  EV(Ship) = (1-p) × ₹402.38 − p × ₹169.40              │
│  Break-even: p* = 70.37% (applied to calibrated prob)   │
│  riskScore = round(blended_risk × 100)                   │
└─────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────┐
│           RULE ARBITRATION (decision_engine.js)          │
│  0-29 → SHIP_AS_IS                                       │
│  30-54 → SHIP_AFTER_CONFIRMATION                         │
│  55-74 → NUDGE_TO_PREPAID                               │
│  75-100 → HOLD / CANCEL (Never auto-cancel 1st timers)  │
└─────────────────────────────────────────────────────────┘
      │
      ▼
   DISPATCH / CONFIRM / NUDGE / HOLD

### Why Logistic Regression over Gradient Boosting?

| Model | ROC-AUC | PR-AUC | F1 | Recall (RTO class) |
|---|---|---|---|---|
| **Logistic Regression (L2, balanced)** | **0.725** | **0.502** | **0.5068** | **59.89%** (112/187) |
| Random Forest | 0.723 | 0.515 | 0.5000 | 49.20% (92/187) |
| Gradient Boosting (GBDT) | 0.726 | 0.507 | 0.4528 | 38.50% (72/187) |
| HistGradientBoosting | 0.721 | 0.522 | 0.3920 | 31.55% (59/187) |

GBDT catches only **72 out of 187 RTOs** — missing 115 returns worth ₹169.40 each. Logistic Regression catches **112 RTOs** with the highest F1 and recall. **In an RTO prevention system, recall dominates.**

> All metrics are reproduced from the chronological holdout (Aug–Sep 2026, 690 orders) with chronological expanding-window encoding and match `artifacts/metrics.json` exactly.

---

## 💰 Business Impact (Backtested on 1,987 Orders)

### Champion Model Confusion Matrix (690-order holdout)

| | Predicted Delivered | Predicted RTO |
|---|---|---|
| **Actual Delivered** | 360 (TN) | 143 (FP) |
| **Actual RTO** | 75 (FN) | **112 (TP — caught!)** |

- **Precision:** 112 / (112+143) = **43.92%**
- **Recall:** 112 / (112+75) = **59.89%** — catches ~3 in every 5 RTOs
- **F1:** 0.5068 | **ROC-AUC:** 0.7246 | **Calibrated Brier Score:** 0.1719

### Policy Simulation Results

| Metric | Baseline | Designed Target | ML-Driven Actual |
|---|---|---|---|
| RTO Rate | 28.43% | 16.62% | 21.61% |
| Net Contribution | ₹4,76,473 | ₹5,00,327 **(+₹23,854)** | ₹4,68,563 **(−₹7,910)** |
| RTOs Prevented | — | 293 | 200 |

> **Why two numbers?**
> - **Designed target (+₹23,854):** Rule-based policy simulation with optimistic allocation assumptions — what the system can achieve when held orders are predominantly true RTOs.
> - **ML-driven actual (−₹7,910):** Applying the saved model to score all 1,987 orders. Current precision (43.89%) is below the 70.37% break-even for hard cancellations — each wrongly-held genuine order costs ₹402.38 vs ₹169.40 saved per caught RTO. **Improving model precision above 70% flips this to net-positive.**

### Monthly Projection (1,650 Monthly COD Orders — Designed Target)

| Metric | Value |
|---|---|
| RTOs prevented/month | ~243 |
| Logistics savings | +₹41,164/month |
| Margin lost on held orders | −₹19,314/month |
| Intervention costs (WhatsApp + discounts) | −₹1,303/month |
| **Net monthly uplift** | **+₹20,546/month** |
| **Annualised** | **+₹2.47 Lakhs/year** |
| **ROI** | **15.76× (uplift / intervention costs)** |

> All figures are **simulated counterfactuals**, not observed realized savings.

---

## 📊 Unit Economics

| Parameter | Value |
|---|---|
| AOV | ₹649 |
| Gross contribution per delivery | ₹649 × 62% = **₹402.38** |
| RTO logistics cost | ₹65 + ₹65 + ₹25 + ₹14.40 = **₹169.40** |
| Mathematical break-even P(RTO) | **70.37%** |
| HOLD_CANCEL operational threshold | 75 (risk-averse policy margin above break-even) |
| CAC | ₹300+ (sunk cost — not deducted from shipping decisions) |

---

## 🔧 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS, Recharts, Framer Motion, Lucide Icons |
| Backend API | Node.js, Express.js, JWT Auth, Zod validation (port 4000) |
| ML Service | Python 3.12, FastAPI, scikit-learn (Logistic Regression), Pandas (port 8000) |
| AI Integration | Google Gemini 1.5 Flash (address validation) + rule-based fallback |
| Storage | MongoDB (optional) + JSON file fallback |
| Testing | Node Test Runner (15 tests), Python unittest (20 tests), verify.py (24 checks) |
| Infrastructure | Docker, Docker Compose |

---

## 📖 Documentation Index

| Document | Description |
|---|---|
| [Business Memo](docs/business-memo.md) | 5 assignment questions answered with exact financial numbers & 4-policy backtest |
| [Technical Decision Log](docs/decision-log.md) | Key engineering decisions & justifications (DEC-001 through DEC-009) |
| [AI Usage Log](docs/ai-usage-log.md) | All ML models, Platt calibration benchmarks, Gemini integration & feature importance |
| [System Architecture](docs/architecture.md) | System topology, service contracts, data flow & security |
| [EDA Report](docs/eda-report.md) | Exploratory data analysis, dataset reconciliation & temporal integrity audit |
| [API Documentation](docs/api-documentation.md) | Comprehensive REST API specifications (ports 4000 & 8000) |

---

## 🐳 Docker (Optional)

```bash
cp .env.example .env
# Add your GEMINI_API_KEY to .env if desired
docker-compose up --build
```

Access at `http://localhost:3000`

---

*Built for the Associate Software Engineer Take-Home Assignment — demonstrating production software engineering, ML integration, and business-first thinking.*
