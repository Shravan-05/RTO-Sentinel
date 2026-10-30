#!/usr/bin/env python3
"""
RTO Sentinel — Quick Verification Script
Checks all components are installed, data is available, and model artifacts exist.
Run from the project root:  python scripts/verify.py
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'fastapi'))

OK = "[OK]"
FAIL = "[FAIL]"
WARN = "[WARN]"

checks_passed = 0
checks_total = 0

def check(label, condition, required=True):
    global checks_passed, checks_total
    checks_total += 1
    icon = OK if condition else (FAIL if required else WARN)
    status = "PASS" if condition else ("FAIL" if required else "WARN")
    print(f"  {icon} {label:55} [{status}]")
    if condition:
        checks_passed += 1

print("\n=== RTO SENTINEL — Environment Verification ===\n")

# Python version
import platform
pv = sys.version_info
print("[ Python Environment ]")
check("Python version >= 3.12", pv.major == 3 and pv.minor >= 12)

# Required packages
packages = {
    "pandas": "pandas",
    "numpy": "numpy",
    "sklearn (scikit-learn)": "sklearn",
    "joblib": "joblib",
    "fastapi": "fastapi",
    "pydantic": "pydantic"
}
# xgboost is a benchmark dependency only; champion model is Logistic Regression
optional_packages = {
    "xgboost (optional, benchmark only)": "xgboost",
}
print("\n[ Python Packages ]")
for label, pkg in packages.items():
    try:
        __import__(pkg)
        check(label, True)
    except ImportError:
        check(label, False)
for label, pkg in optional_packages.items():
    try:
        __import__(pkg)
        check(label, True, required=False)
    except (ImportError, MemoryError):
        check(label, False, required=False)

# Data files
print("\n[ Data & Artifacts ]")
csv_paths = [
    os.path.join(ROOT, 'orders_sample.csv'),
    os.path.join(ROOT, 'fastapi', 'data', 'raw', 'orders_sample.csv')
]
csv_exists = any(os.path.exists(p) for p in csv_paths)
check("orders_sample.csv (training data)", csv_exists)

artifacts = ['model.joblib', 'model_calibrated.joblib', 'metrics.json', 'city_risk_lookup.json', 'pincode_risk_lookup.json']
for artifact in artifacts:
    path = os.path.join(ROOT, 'fastapi', 'artifacts', artifact)
    check(f"Artifact: {artifact}", os.path.exists(path))

# Config files
print("\n[ Configuration ]")
config_files = [
    ('risk-thresholds.json', True),
    ('business-rules.json', True)
]
for fname, required in config_files:
    path = os.path.join(ROOT, 'config', fname)
    check(f"config/{fname}", os.path.exists(path), required)

# Node.js
print("\n[ Node.js Environment ]")
import subprocess
try:
    res = subprocess.run(['node', '--version'], capture_output=True, text=True, shell=True)
    node_ver = res.stdout.strip()
    maj = int(node_ver.replace('v', '').split('.')[0])
    check(f"Node.js {node_ver} (>= 18 required)", maj >= 18)
except Exception:
    check("Node.js installed", False)

try:
    res = subprocess.run(['npm', '--version'], capture_output=True, text=True, shell=True)
    check(f"npm {res.stdout.strip()}", bool(res.stdout.strip()))
except Exception:
    check("npm installed", False)

check("backend dependencies installed", 
    os.path.exists(os.path.join(ROOT, 'backend', 'node_modules')) or
    os.path.exists(os.path.join(ROOT, 'node_modules', 'express'))
)
check("frontend dependencies installed",
    os.path.exists(os.path.join(ROOT, 'frontend', 'node_modules')) or
    os.path.exists(os.path.join(ROOT, 'node_modules', 'react'))
)

# Test AI prediction
print("\n[ AI Engine Smoke Test ]")
try:
    from app.services.prediction_service import prediction_service
    from app.schemas.order import OrderInput
    order = OrderInput(
        order_id="VERIFY_001",
        order_value=649.0,
        payment_method="COD",
        shipping_address="Flat 12A, Andheri West, Near WEH Metro",
        shipping_city="Mumbai",
        shipping_state="Maharashtra",
        shipping_pincode="400053",
        customer_name="Rohit Sharma",
        customer_prior_orders=1,
        customer_prior_rto=0
    )
    res = prediction_service.predict_single(order)
    check(f"Prediction service: {res.decision} (Score: {res.risk_score})", True)
    check("Financial impact calculation works", res.financial_impact.gross_margin_profit > 0)
    check("Risk factors generated", len(res.risk_factors) > 0)
    check("Address validation runs", res.address_validation is not None)
except Exception as e:
    check(f"AI Engine end-to-end prediction: {e}", False)

# Summary
print(f"\n{'='*52}")
success_rate = (checks_passed / checks_total) * 100 if checks_total > 0 else 0
color = "\033[92m" if success_rate >= 85 else "\033[93m" if success_rate >= 60 else "\033[91m"
print(f"  {color}{checks_passed}/{checks_total} checks passed ({success_rate:.0f}%)\033[0m")

if success_rate < 100:
    print(f"\n  To fix missing artifacts, run:")
    print(f"    python fastapi/app/ml/training/train.py")
    print(f"\n  To install Node.js deps:")
    print(f"    cd backend && npm install")
    print(f"    cd frontend && npm install")

print()

