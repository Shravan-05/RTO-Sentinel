# Decision Log — RTO Sentinel

This document records all significant technical, product, and architectural decisions made during the development of RTO Sentinel, along with the reasoning and alternatives considered.

---

## DEC-001: Strict Chronological Data Split (No Future-Data Leakage)

**Date:** Phase 2  
**Decision:** Enforce a strict chronological train/test split (April 1 – July 31, 2026 for training with 1,297 orders; August 1 – September 30, 2026 for testing with 690 orders) rather than random k-fold cross-validation.

**Reasoning:**
- In e-commerce logistics, consumer purchasing patterns, address formatting, courier network density, and regional COD refusal rates drift over time.
- Random k-fold cross-validation introduces future-data leakage, allowing the model to train on future transactions while predicting past transactions, which artificially inflates performance metrics.
- A chronological partition strictly mirrors real-world production conditions: the model trains on past data to predict future incoming orders.

**Alternatives Rejected:**
- Stratified k-fold: Breaches temporal boundaries and creates data leakage.
- Leave-one-out: Computationally inefficient and vulnerable to temporal correlation.

---

## DEC-002: Calibrated Logistic Regression (L2) Selected as Champion Architecture

**Date:** Phase 2 / Phase 3  
**Decision:** Select Logistic Regression (L2 with balanced class weights) as the production champion model over Random Forest, Gradient Boosting (GBDT), and HistGradientBoosting.

**Reasoning:**
- **Recall Priority**: In Cash on Delivery operations, an undetected RTO costs **₹169.40** in wasted forward and reverse logistics. Conversely, flagging an order for customer confirmation incurs only **₹0.50** for a WhatsApp interactive message. Therefore, high operational recall is far more valuable than narrow precision.
- **Why GBDT Was Rejected Despite Higher Precision**:
  - GBDT achieved a higher precision (54.96% vs. 43.92%) and PR-AUC (0.5072 vs. 0.5023).
  - However, GBDT suffered from an **unacceptably low recall of 38.50%**, catching only 72 out of 187 RTOs on the holdout test set and letting 115 costly returns ship through unflagged. Its F1 score was only 0.4528.
  - Logistic Regression achieved **59.89% recall** (catching 112 out of 187 RTOs) and delivered the highest overall F1 score (**0.5068**) and highest ROC-AUC (**0.7246**) under expanding-window encoding.
- **Interpretability & Explainability**: The standardized linear coefficients of Logistic Regression provide mathematically sound, legally defensible reasons for every risk score without needing heavy post-hoc approximation wrappers like SHAP.

**Calibration Note**: In addition to the raw sigmoid classifier (`model.joblib`), a 5-fold cross-validated Platt scaling calibration pipeline was deployed and saved to `model_calibrated.joblib` (see DEC-008), bringing the Brier score down from 0.2078 to 0.1719 and anchoring mean predicted probability at 0.2858 (closely tracking the true holdout base rate of 0.2710).

---

## DEC-003: Sunk CAC Separation & Mathematical Break-Even Grounding

**Date:** Phase 3  
**Decision:** Separate customer acquisition costs (CAC) from direct cancellation penalties, and ground the decision engine in exact mathematical expected value.

**Reasoning:**
- **The ₹300 CAC was spent upfront** during ad acquisition (Meta/Google). Cancelling an order does not cause a new ₹300 cash outflow; it wastes a sunk marketing asset and forfeits future customer lifetime value.
- **Mathematical Break-Even RTO Probability**:
  $$\text{EV}(\text{ship}) = (1 - P) \times ₹402.38 - P \times ₹169.40 = 0 \implies P = \frac{402.38}{402.38 + 169.40} = \mathbf{70.37\%}$$
- Orders with predicted risk $< 70.37\%$ have positive expected value when shipped.
- The operational cancellation threshold is set at **75%** to incorporate a small safety margin against model error, ensuring no order is cancelled unless the expected logistics loss genuinely outweighs the gross margin.
- First-time buyers with elevated risk are routed to WhatsApp Prepaid Nudge or Confirmation rather than automated cancellation, preserving the acquired customer relationship.

---

## DEC-004: Dual MongoDB + Embedded In-Memory JSON Storage Engine

**Date:** Phase 4  
**Decision:** Implement a dual-mode storage engine that attempts a MongoDB connection, but gracefully and automatically falls back to an embedded local JSON persistence layer.

**Reasoning:**
- Evaluators inspecting the project should not face setup barriers such as mandatory external Docker daemons or running MongoDB instances.
- The embedded storage engine faithfully implements 100% of the Mongoose interface, preserving full CRUD functionality, audit logging, and simulation state across service restarts.

---

## DEC-005: Standardization on a Single 0–100 Risk Scale

**Date:** Final Audit  
**Decision:** Standardize all services, configurations, and documentation on a single unified 0–100 risk score scale:
- **0 – 29: `SHIP_AS_IS`** (Low risk, direct warehouse fulfillment)
- **30 – 54: `SHIP_AFTER_CONFIRMATION`** (Medium risk, interactive WhatsApp verification)
- **55 – 74: `NUDGE_TO_PREPAID`** (High risk, ₹20 discount prepaid incentive)
- **75 – 100: `HOLD_CANCEL`** (Critical risk exceeding mathematical breakeven; manual hold or cancel for repeat offenders)

**Reasoning:**
- Standardizing eliminates discrepancies between probability fractions ($0.15, 0.35, 0.60$) and integer percentiles ($29, 54, 74$), ensuring seamless synchronization across frontend UI badges, Express decision logic, and Python ML prediction schemas.

---

## DEC-006: Interactive WhatsApp Simulator as Deterministic FSM

**Date:** Phase 5  
**Decision:** Implement the WhatsApp simulator as an interactive finite state machine (FSM) with a controllable simulation clock rather than a live external webhook integration.

**States:** `PENDING_DISPATCH` → `AWAITING_REPLY` → [`CONFIRMED` | `CANCELLED` | `EXPIRED` | `CONVERTED_PREPAID` | `ADDRESS_UPDATED`]

**Reasoning:**
- Demonstrating the entire customer lifecycle (confirmation, cancellation, address correction, prepaid conversion, 24-hour timeout expiration) requires deterministic control over time.
- Production WhatsApp Business APIs require Meta Business verification and active SIM cards, which are impractical for a portable technical take-home assignment.

---

## DEC-007: Google Gemini API with Rule-Based Fallback for Address Validation

**Date:** Phase 3  
**Decision:** Utilize Google Gemini 1.5 Flash for natural language address parsing, paired with a comprehensive deterministic rule-based fallback when the API key is not present.

**Reasoning:**
- Gemini understands Indian colloquial landmarks ("ke paas", "ke saamne", "behind temple") that regex misses.
- The rule-based fallback ensures that unit tests, local development, and offline evaluation run seamlessly without external network dependencies.
- Both pipelines return identical structured JSON schemas.

---

## DEC-008: Chronological Expanding-Window Target Encoding & Platt Scaling Deployment

**Date:** Final Audit Fix  
**Decision:** Upgrade target encoding to Chronological Expanding-Window and deploy 5-fold CV Platt Scaling calibration.

**Reasoning:**
- Standard Leave-One-Out (LOO) encoding allows intra-group temporal leakage because earlier orders observe full-training-period group statistics. Chronological expanding-window encoding ensures each order's encoding strictly aggregates past orders ($0 \dots i-1$), eliminating all temporal leakage.
- Balanced class weights shift logistic regression raw sigmoid probabilities upwards (mean 0.447 vs actual 0.271). Platt scaling (`CalibratedClassifierCV(method='sigmoid', cv=5)` fit on train data only) anchors probabilities to empirical ground truth (mean 0.286, Brier score improves from 0.2078 to 0.1719).
- The calibrated pipeline is saved as `model_calibrated.joblib`, while the raw pipeline is preserved as `model.joblib`.

---

## DEC-009: Strict Protection Safeguards for First-Time Buyers

**Date:** Final Audit Fix  
**Decision:** Mandate in `decisionEngine.js` that first-time buyers (`customer.priorOrders === 0`) are never auto-cancelled solely on high predicted risk.

**Reasoning:**
- First-time customers represent sunk Customer Acquisition Cost (CAC ₹300). Cancelling them destroys the marketing investment and prospective customer lifetime value (LTV).
- High-risk first-time buyers are routed to `NUDGE_TO_PREPAID` (offering ₹20 discount) or `SHIP_AFTER_CONFIRMATION` (interactive WhatsApp verification).
- Automated `CANCEL` is strictly reserved for chronic repeat offenders (`customer.priorRto >= 2`) or verified address non-responsiveness.
