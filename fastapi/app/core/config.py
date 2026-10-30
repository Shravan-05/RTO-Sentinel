import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent.parent
ARTIFACTS_DIR = BASE_DIR / "artifacts"
CONFIG_DIR = BASE_DIR.parent / "config"

class Settings(BaseModel):
    PROJECT_NAME: str = "RTO Sentinel AI Engine"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Model Artifacts
    MODEL_PATH: str = str(ARTIFACTS_DIR / "model.joblib")
    CALIBRATED_MODEL_PATH: str = str(ARTIFACTS_DIR / "model_calibrated.joblib")
    METRICS_PATH: str = str(ARTIFACTS_DIR / "metrics.json")
    CITY_RISK_PATH: str = str(ARTIFACTS_DIR / "city_risk_lookup.json")
    PINCODE_RISK_PATH: str = str(ARTIFACTS_DIR / "pincode_risk_lookup.json")
    
    # Config Paths
    RISK_THRESHOLDS_PATH: str = str(CONFIG_DIR / "risk-thresholds.json")
    BUSINESS_RULES_PATH: str = str(CONFIG_DIR / "business-rules.json")
    
    # Financial Constants (from business specs)
    AOV: float = 649.0
    GROSS_MARGIN_PCT: float = 0.62
    FORWARD_SHIPPING: float = 65.0
    RETURN_SHIPPING: float = 65.0
    PACKAGING_HANDLING: float = 25.0
    DAMAGE_PROBABILITY: float = 0.08
    AVG_PRODUCT_COST: float = 180.0
    CAC_NEW_CUSTOMER: float = 300.0
    
    # Gemini API Key (optional, defaults to rule-based fallback if not set)
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

settings = Settings()

