import os
import json
import logging
from fastapi import APIRouter, HTTPException, Depends
from app.core.config import settings
from app.schemas.order import (
    OrderInput,
    PredictionResponse,
    BatchPredictionRequest,
    BatchPredictionResponse,
    AddressValidationRequest,
    AddressValidationResult
)
from app.services.prediction_service import prediction_service
from app.llm.gemini_validator import validate_address_with_gemini

logger = logging.getLogger("rto_sentinel.api")

router = APIRouter()

@router.post("/predict", response_model=PredictionResponse)
def predict_order_risk(order: OrderInput):
    """
    Evaluates COD order risk, computes RTO probability, applies explainable feature
    contributions, validates address, and outputs one of 4 canonical decisions.
    """
    try:
        return prediction_service.predict_single(order)
    except Exception as e:
        logger.error(f"Error predicting order risk: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/predict/batch", response_model=BatchPredictionResponse)
def batch_predict(request: BatchPredictionRequest):
    """
    Processes batch order risk scoring for warehouse dispatch queues.
    """
    results = []
    for order in request.orders:
        try:
            pred = prediction_service.predict_single(order)
            results.append(pred)
        except Exception as e:
            logger.error(f"Error processing order {order.order_id}: {e}")
    return BatchPredictionResponse(
        total_processed=len(results),
        predictions=results
    )

@router.post("/validate-address", response_model=AddressValidationResult)
def validate_address(request: AddressValidationRequest):
    """
    Direct endpoint for delivery address intelligence (LLM + Rule Engine).
    """
    return validate_address_with_gemini(
        address=request.address,
        city=request.city,
        state=request.state,
        pincode=request.pincode,
        customer_name=request.customer_name or ""
    )

@router.get("/model/metrics")
def get_model_metrics():
    """
    Returns champion model evaluation metrics, confusion matrix, ROC-AUC, and feature importances.
    """
    if os.path.exists(settings.METRICS_PATH):
        try:
            with open(settings.METRICS_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error reading metrics: {e}")
    raise HTTPException(status_code=404, detail="Metrics artifact not found")

@router.get("/rules/thresholds")
def get_thresholds():
    """
    Returns current active risk thresholds and decision policy mapping.
    """
    return prediction_service.thresholds

