# Exploratory Data Analysis (EDA) Report: D2C Haircare COD Orders

**Dataset Analyzed**: `orders_sample.csv` (2,018 raw order records, April 1, 2026 – September 30, 2026; MD5: `f2b840ca2338cbdbceb31eedae06efa8`)  
**Target Variable**: `final_status` (Order outcome: DELIVERED vs RTO)  
**Scope**: COD Pre-shipment Risk Assessment for RTO Sentinel  

---

## 1. Executive Summary & Core Dataset Characteristics

| Metric | Raw Dataset | Clean Resolved Training Set | Audit Note |
|---|---|---|---|
| Total Records | 2,018 orders | 1,987 orders | 30 exact row duplicates + 1 IN_TRANSIT removed |
| Unique Orders | 1,988 | 1,987 | 30 duplicate order IDs verified as exact row replicas |
| Order Date Range | 2026-04-01 to 2026-09-30 | 2026-04-01 to 2026-09-30 | 6 full calendar months |
| Payment Method | 100% Cash on Delivery (COD) | 100% Cash on Delivery (COD) | No prepaid orders exist in historical sample |
| Outcome Breakdown | **DELIVERED**: 1,444 (71.56%)<br>**RTO**: 573 (28.39%)<br>**IN_TRANSIT**: 1 (0.05%) | **DELIVERED**: 1,422 (71.57%)<br>**RTO**: 565 (28.43%) | Normalized from string variants (`DELIVERED`, `delivered`, `RTO`, `Rto`, `RTO `) |
| Baseline COD RTO Rate | **28.41%** (raw resolved) | **28.43%** (clean) | Verified empirical baseline |
| Empirical Mean Order Value | ₹918.71 (Delivered: ₹904.42) | ₹918.45 (Delivered: ₹904.42) | Empirical order values in CSV (styled baseline uses ₹649 AOV) |
| Missing Values | City: 4, Pincode: 12 | Imputed / Flagged | Deterministic fallback handling |
| First-Time Buyers | 1,518 (75.22%) | 1,492 (75.09%) | Orders where `customer_prior_orders == 0` |
| Repeat Buyers | 500 (24.78%) | 495 (24.91%) | Orders where `customer_prior_orders >= 1` |

---

## 2. Key Statistical Findings & Insights (With Exact Numbers)

### Finding 1: Severe Geographic Bifurcation — Tier-1 Metros vs High-RTO Regional Clusters
- **Tier-1 Metros** demonstrate controlled, commercially viable RTO rates:
  - Mumbai: 216 orders, 18.06% RTO (39 returned)
  - Pune: 168 orders, 18.45% RTO (31 returned)
  - Chennai: 155 orders, 21.29% RTO (33 returned)
  - Delhi NCR: 242 orders, 21.90% RTO (53 returned)
  - Kolkata: 129 orders, 24.81% RTO (32 returned)
  - Hyderabad: 174 orders, 25.29% RTO (44 returned)
  - Bengaluru: 211 orders, 26.07% RTO (55 returned)
- **High-Risk Clusters (Eastern UP, Bihar, MP Tier-2/3)** exhibit severe return rates:
  - **Gorakhpur, UP**: 45 orders, **62.22% RTO** (28 returned)
  - **Bareilly, UP**: 33 orders, **60.61% RTO** (20 returned)
  - **Darbhanga, Bihar**: 61 orders, **57.38% RTO** (35 returned)
  - **Sagar, MP**: 54 orders, **51.85% RTO** (28 returned)
  - **Patna, Bihar**: 79 orders, **48.10% RTO** (38 returned)
  - **Madhubani, Bihar**: 3 orders, **100.00% RTO** (3 returned)
- **Business Implication**: Blanket shipping to these high-risk clusters without pre-dispatch WhatsApp verification destroys gross margin. However, regional profiling must not trigger automatic cancellations for honest first-timers.

### Finding 2: Customer History Asymmetry & The "First-Timer Dilemma"
- Prior customer track record is heavily non-linear:
  - `customer_prior_rto == 0`: 1,844 orders, **27.22% RTO**
  - `customer_prior_rto == 1`: 109 orders, **33.94% RTO** (+6.72% risk increase)
  - `customer_prior_rto >= 2`: 34 orders, **76.47% RTO** (+49.25% risk increase; 26 out of 34 returned!)
- **Repeat Customers** (`prior_orders >= 1`, 495 clean orders) exhibit **22.83% RTO**, whereas **First-time Customers** (`prior_orders == 0`, 1,492 clean orders) exhibit **30.29% RTO** (452 returned).
- **Financial Conflict**: First-time customers constitute 75.09% of the sales pipeline. Marketing spent ₹300+ CAC for each customer acquired. Cancelling first-time buyers forfeits ₹402.38 in gross profit and destroys customer lifetime value. Therefore, the decision engine must prioritize **WhatsApp Confirmation** and **Prepaid Nudges with ₹20 discount** over outright cancellation.

### Finding 3: Syntactic Address Quality & Dummy Name Fraud Signals
- **Vague / Truncated Addresses**: 184 orders contain minimal placeholder strings (e.g., `.`, `xyz`, `home`, `call me`, `near station`, or address length < 10 characters).
  - Vague address RTO: **61.96%** (114 / 184 RTO) vs **25.01%** for detailed addresses.
  - Relative risk multiplier: **2.48x higher failure probability**.
- **Suspicious Customer Names**: 40 orders have dummy names (`test`, `Test Order`, `asdf`, `qwerty`, `na`, `abc`, `xyz xyz`).
  - Suspicious name RTO: **62.50%** (25 / 40 RTO) vs **27.73%** for standard names.
- **Natural Language Address Cues**: Over 40% of genuine delivered Indian addresses use landmark vernacular ("ke saamne", "ke paas", "peeche wala ghar", "chowk se left", "gali no"). Rejecting these as "invalid" would severely harm genuine customers. Gemini LLM contextual parsing is ideal here to differentiate valid landmark-based addresses from true gibberish.

### Finding 4: Marketing Channel Dynamics
- **Acquisition Source (UTM)**:
  - Meta Ads (`meta_ads`): 768 orders, **31.38% RTO** (highest volume, impulse buyer demographic)
  - Instagram Organic: 231 orders, **29.44% RTO**
  - Google Ads: 242 orders, **28.10% RTO**
  - Influencer: 226 orders, **26.55% RTO**
  - WhatsApp Broadcast: 268 orders, **26.49% RTO**
  - Direct: 252 orders, **22.62% RTO** (highest intent)

---

## 3. Data Cleaning & Integrity Checklist

1. **Target Normalization**:
   - `DELIVERED`, `delivered` $\to$ `DELIVERED` (1,444 raw $\to$ 1,422 clean after dedup)
   - `RTO`, `Rto`, `RTO ` $\to$ `RTO` (573 raw $\to$ 565 clean after dedup)
   - `IN_TRANSIT` (order `KT100021`, 1 row) $\to$ Removed from training set to prevent label noise during supervised binary classification.
2. **Duplicate Records**:
   - 30 exact duplicate rows identified and deduplicated using deterministic first-occurrence retention (`drop_duplicates(subset=['order_id'], keep='first')`).
3. **Missing Value Handling**:
   - `city` missing in 4 rows $\to$ Imputed from Pincode lookup table or tagged as 'UNKNOWN'.
   - `pincode` missing in 12 rows $\to$ Imputed from City modal pincode or tagged as -1 with `missing_pincode_flag`.
4. **Anomalous Values**:
   - 3 orders with ₹0 value (`KT100710`, `KT101549`, `KT100565`) — all were DELIVERED (free promotional samples or warranty replacements). Retained with clean numeric encoding.
5. **No Data Leakage Guarantee**:
   - Feature set strictly excludes `final_status`, post-order tracking events, delivery timestamps, or courier NDR (non-delivery report) notes. All features are strictly known at checkout.
