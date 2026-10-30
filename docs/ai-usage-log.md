# AI Usage Log — RTO Sentinel

This document records all AI and ML components used in the RTO Sentinel platform, including models, frameworks, APIs, evaluation methodology, and architectural justifications.

---

## 1. Machine Learning — Supervised RTO Risk Classifier

**Purpose:** Predict the probability that a Cash on Delivery (COD) order will result in Return to Origin (RTO) before dispatch.

**Training Approach:**
- **Dataset:** 2,018 historical Shopify orders (April–September 2026), yielding **1,987 clean resolved transactions** after deduplicating 30 exact row replicas and removing 1 unresolved `IN_TRANSIT` record.
- **Target variable:** `final_status == 'RTO'` (binary, 28.43% positive class on clean records).
- **Split strategy:** Strict chronological holdout split (no future-data leakage) — April–July 2026 as training (1,297 orders, 29.14% RTO rate), August–September 2026 as out-of-time holdout test (690 orders, 27.10% RTO rate).
- **Class imbalance handling:** `class_weight='balanced'` in candidate estimators to penalize false negatives on costly RTO events.
- **Customer History Signals:** `customer_prior_orders` and `customer_prior_rto` represent static historical customer account attributes present at the time of order placement.
- **Target Encoding Safeguard:** Geographic target encodings (`city_rto_risk` and `pin_rto_risk`) were computed strictly from the training partition using Empirical Bayes Laplace smoothing with the training prior ($m = 10$, prior mean = 29.14%), preventing future-data leakage into the test set.

### Candidate Models Evaluated on Out-of-Time Test Set (Aug–Sep 2026, 690 Orders)
*(Evaluated with Chronological Expanding-Window Target Encoding)*

| Model Architecture | Accuracy | Precision | Recall | F1 Score | ROC-AUC | PR-AUC | Status |
|---|---|---|---|---|---|---|---|
| **Logistic Regression (L2)** | **68.41%** | **43.92%** | **59.89%** | **0.5068** | **0.7246** | **0.5023** | **CHAMPION (Selected)** |
| Random Forest | 73.33% | 50.83% | 49.20% | 0.5000 | 0.7229 | 0.5149 | Candidate |
| Gradient Boosting (GBDT) | 74.78% | 54.96% | 38.50% | 0.4528 | 0.7260 | 0.5072 | Candidate |
| HistGradientBoosting | 73.48% | 51.75% | 31.55% | 0.3920 | 0.7206 | 0.5224 | Candidate |

> [!NOTE]
> All metrics above are **reproduced from the verified training engine run** (`train.py`) on the chronological holdout set (Aug–Sep 2026, 690 orders) and match `artifacts/metrics.json` exactly.

### Detailed Evaluation of Champion Model (Logistic Regression L2)
- **Confusion Matrix on 690 Test Records** (verified):
  - True Negatives (Delivered correctly cleared): **360**
  - False Positives (Delivered flagged for check): **143**
  - False Negatives (RTO missed and shipped): **75**
  - True Positives (RTO caught before shipping): **112**
- **Exact Metric Verification**:
  - Precision: $\frac{\text{TP}}{\text{TP} + \text{FP}} = \frac{112}{112 + 143} = \frac{112}{255} = \mathbf{43.92\%}$
  - Recall: $\frac{\text{TP}}{\text{TP} + \text{FN}} = \frac{112}{112 + 75} = \frac{112}{187} = \mathbf{59.89\%}$
  - F1 Score Formula: $F_1 = 2 \times \frac{\text{Precision} \times \text{Recall}}{\text{Precision} + \text{Recall}} = 2 \times \frac{0.4392 \times 0.5989}{0.4392 + 0.5989} = \frac{0.5261}{1.0381} = \mathbf{0.5068}$
  - Accuracy: $\frac{\text{TP} + \text{TN}}{\text{Total}} = \frac{112 + 360}{690} = \frac{472}{690} = \mathbf{68.41\%}$
  - ROC-AUC: **0.7246** | PR-AUC: **0.5023**

### Selection Rationale: Why Logistic Regression Over Gradient Boosting (GBDT)
While Gradient Boosting achieved a higher raw accuracy, its recall of only **38.50%** means it catches only 72 out of 187 RTOs — letting 115 costly returns ship unflagged.
- In COD risk management, the cost asymmetry is severe: an undetected RTO costs **₹169.40** in wasted courier charges, whereas a false alarm incurs only **₹0.50** for a WhatsApp verification message.
- Logistic Regression caught **112 out of 187 RTOs (59.89% recall)** — catching 40 more RTOs than GBDT — and delivered the highest overall F1 score (**0.5068** vs. GBDT's 0.4528).

### Probability Output and Calibration Implementation
- **Raw Sigmoid Probabilities**: The base model outputs logistic sigmoid scores with `class_weight='balanced'`. Because positive class weights are increased to prioritize recall, raw sigmoid scores are systematically elevated (mean ≈ 0.4470 vs actual base rate 0.2710, Brier = 0.2078).
- **Platt Scaling Calibration**: Platt scaling was implemented and fitted strictly using **5-fold Cross-Validation on the training partition only** (never touching the holdout test set).
  - Raw Model Brier Score: **0.2078** (Mean predicted: 0.4470)
  - Calibrated Model Brier Score: **0.1719** (Mean predicted: 0.2858)
  - Brier Score Improvement: **+0.0359** (lower is better, demonstrating substantial reliability improvement).
  - Actual Holdout Base Rate: **0.2710** (calibrated mean 0.2858 is within 1.5% of true ground truth).
- **Production Artifacts & Inference**:
  - `model.joblib`: raw champion pipeline.
  - `model_calibrated.joblib`: calibrated champion pipeline.
  - In `prediction_service.py`, `ml_raw_score` exposes the raw sigmoid score, while `ml_calibrated_probability` exposes the mathematically verified Platt-calibrated probability.

#### Calibration Reliability Table (5 Quantile Bins on Holdout Set)

| Bin | Raw Pred. Prob. | Actual RTO Rate | Calibrated Pred. | Actual RTO Rate |
|---|---:|---:|---:|---:|
| 1 (lowest) | 0.155 | 0.072 | 0.106 | 0.072 |
| 2 | 0.307 | 0.181 | 0.187 | 0.174 |
| 3 | 0.422 | 0.225 | 0.250 | 0.239 |
| 4 | 0.572 | 0.333 | 0.343 | 0.326 |
| 5 (highest) | 0.788 | 0.543 | 0.541 | 0.543 |

*Raw probabilities systematically over-predict RTO probability due to balanced class weighting. Calibrated probabilities align closely with true outcomes across all bins.*

### Target Encoding: Chronological Expanding-Window
- **Implementation**: Replaced standard LOO with **chronological expanding-window target encoding**.
  - Training records are sorted by timestamp (`order_dt`).
  - For each order $i$, empirical geographic risk (`city_rto_risk` and `pin_rto_risk`) is computed strictly from records $0$ to $i-1$, smoothed towards the global training prior ($m=10$).
  - For inference and the holdout test set, cumulative lookup tables derived strictly from the complete training partition (April–July 2026) are loaded from `artifacts/city_risk_lookup.json` and `artifacts/pincode_risk_lookup.json`.
  - **Result**: Zero temporal leakage across the entire training pipeline. Verified by automated tests in `test_temporal_encoding.py`.

### Coefficient Normalization & Global Feature Importance
All numeric features were standardized using `StandardScaler` ($\mu = 0, \sigma = 1$) prior to model fitting, while categorical features (`utm_source_clean`, `state_clean`) were one-hot encoded without scaling.
- Because numeric features have unit variance, the magnitude of each linear coefficient $|\beta_j|$ represents the change in log-odds of RTO per one standard deviation change in feature $x_j$.
- Global feature importance is represented by the absolute magnitude of these standardized pipeline coefficients, **not by SHAP values or tree split gains**.

**Top 15 Predictive Features by Absolute Standardized Coefficient Magnitude:**
1. `pin_rto_risk` (0.8502) — Pincode prefix empirical risk from training set
2. `is_first_time` (0.6702) — First-time buyer indicator
3. `is_high_value` (0.4251) — Order value >= ₹1,500
4. `is_vague_address` (0.4144) — Address length < 10 characters or placeholder string
5. `num_items` (0.3601) — Multi-item cart count
6. `city_rto_risk` (0.3058) — Smoothed empirical city risk
7. `utm_source_clean_direct` (0.3015) — Direct navigation traffic
8. `has_prior_rto` (0.2731) — Binary prior RTO flag
9. `customer_prior_rto` (0.2697) — Prior RTO count
10. `utm_source_clean_meta_ads` (0.2379) — Social media advertising traffic
11. `state_clean_Assam` (0.2290) — Regional state indicator
12. `state_clean_Karnataka` (0.2088) — Regional state indicator
13. `is_suspicious_name` (0.1991) — Dummy name matching regex dictionary
14. `utm_source_clean_whatsapp_broadcast` (0.1783) — Broadcast campaign traffic
15. `customer_prior_orders` (0.1711) — Past completed order count

---

## 2. Google Gemini API — LLM Address Validation

**Model Used:** `gemini-1.5-flash` (via REST API)

**Purpose:** Validate the quality, completeness, and deliverability of Indian D2C delivery addresses beyond regex heuristics.

**Input:** Full street address, City, State, Pincode, Customer Name.  
**Output:** Structured JSON containing `is_valid` (bool), `quality_score` (0–100), `category` (COMPLETE | MISSING_LANDMARK | VAGUE | GIBBERISH | INVALID_PINCODE), `issues` (list), and `suggested_correction`.

**Fallback Mechanism:**
When `GEMINI_API_KEY` is absent (local development, CI, testing) or when the API call fails or times out (5-second threshold), the system automatically falls back to deterministic rule-based evaluation:
- Address length < 8 chars or < 2 words: −50 points (`VAGUE`)
- Gibberish / placeholder patterns (`xyz`, `test`, `asdf`): −60 points (`GIBBERISH`)
- Repetitive characters (`aaaaaa`): −40 points (`GIBBERISH`)
- Missing house/flat number AND landmark: −25 points
- Suspicious customer name: −20 points
- Invalid 6-digit Indian PIN format: −35 points

The `validation_source` response header clearly indicates origin: `GEMINI_AI`, `RULE_BASED`, or `RULE_BASED (GEMINI_FALLBACK)`.

---

## 3. Standardized Risk Scoring & Decision Arbitration

Every order is assigned a standardized risk score on a **0–100 scale**:
$$\text{riskScore} = \text{round}(P_{\text{blended}} \times 100)$$
where $P_{\text{blended}} = 0.70 \times P_{\text{ML}}(\text{RTO}) + 0.30 \times \text{Address Penalty}$.

**Standardized Operational Thresholds:**
- **0 – 29: `SHIP_AS_IS`** (Low risk, direct warehouse fulfillment)
- **30 – 54: `SHIP_AFTER_CONFIRMATION`** (Medium risk, interactive WhatsApp verification)
- **55 – 74: `NUDGE_TO_PREPAID`** (High risk, ₹20 discount prepaid incentive)
- **75 – 100: `HOLD_CANCEL`** (Critical risk exceeding mathematical breakeven; manual hold or cancel for repeat offenders)

**First-Time Buyer Safeguard:** First-time buyers (`prior_orders == 0`) with high risk scores (55–100) are escalated to WhatsApp Prepaid Nudge or Confirmation rather than direct cancellation, protecting marketing customer acquisition investments.
