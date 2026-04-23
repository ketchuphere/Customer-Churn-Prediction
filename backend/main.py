from __future__ import annotations

import json
import os
import time
from contextlib import asynccontextmanager
from typing import Any

import joblib
import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from utils import ALL_FEATURES, engineer_features

BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
ARTIFACTS_DIR = os.path.join(BASE_DIR, "artifacts")
FRONTEND_DIST = os.path.join(BASE_DIR, "frontend", "dist")

_pipeline: Any  = None
_metadata: dict = {}


def _load_artifacts() -> None:
    global _pipeline, _metadata

    model_names = ["model.pkl", "best_churn_pipeline.pkl", "churn_model.pkl"]
    pipeline_path = None
    
    for name in model_names:
        path = os.path.join(ARTIFACTS_DIR, name)
        if os.path.exists(path):
            pipeline_path = path
            break
    
    if pipeline_path is None:
        raise FileNotFoundError(
            f"No model found in {ARTIFACTS_DIR}. Run: python train_model.py"
        )

    _pipeline = joblib.load(pipeline_path)
    
    metadata_path = os.path.join(ARTIFACTS_DIR, "metadata.json")
    if not os.path.exists(metadata_path):
        raise FileNotFoundError(f"metadata.json not found in {ARTIFACTS_DIR}")
    
    with open(metadata_path) as f:
        _metadata = json.load(f)

    print(
        f"[ChurnScope] Loaded {os.path.basename(pipeline_path)} | "
        f"features={len(_metadata.get('features', []))} | "
        f"acc={_metadata.get('metrics', {}).get('accuracy')} | "
        f"auc={_metadata.get('metrics', {}).get('roc_auc')}"
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_artifacts()
    yield


app = FastAPI(
    title="ChurnScope API",
    description="Notebook-pipeline sklearn model — Bank Customer Churn",
    version="4.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class CustomerInput(BaseModel):
    credit_score:     int   = Field(..., ge=300,  le=900)
    country:          str   = Field(...,           description="France | Germany | Spain")
    gender:           str   = Field(...,           description="Male | Female")
    age:              int   = Field(..., ge=18,    le=100)
    tenure:           int   = Field(..., ge=0,     le=10)
    balance:          float = Field(..., ge=0)
    products_number:  int   = Field(..., ge=1,     le=4)
    credit_card:      int   = Field(..., ge=0,     le=1)
    active_member:    int   = Field(..., ge=0,     le=1)
    estimated_salary: float = Field(..., ge=0)

    @field_validator("country")
    @classmethod
    def validate_country(cls, v: str) -> str:
        if v not in {"France", "Germany", "Spain"}:
            raise ValueError("country must be France, Germany or Spain")
        return v

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, v: str) -> str:
        if v not in {"Male", "Female"}:
            raise ValueError("gender must be Male or Female")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "credit_score": 650, "country": "France", "gender": "Male",
                "age": 40, "tenure": 3, "balance": 50000.0,
                "products_number": 2, "credit_card": 1,
                "active_member": 1, "estimated_salary": 60000.0,
            }
        }
    }


class PredictionResponse(BaseModel):
    churn_probability:  float
    prediction:         str
    risk_level:         str
    confidence:         float
    key_factors:        list[str]
    model_accuracy:     float
    model_roc_auc:      float
    inference_ms:       float


def _build_input_df(inp: CustomerInput) -> pd.DataFrame:
    raw = {
        "credit_score":     inp.credit_score,
        "country":          inp.country,
        "gender":           inp.gender,
        "age":              inp.age,
        "tenure":           inp.tenure,
        "balance":          inp.balance,
        "products_number":  inp.products_number,
        "credit_card":      inp.credit_card,
        "active_member":    inp.active_member,
        "estimated_salary": inp.estimated_salary,
    }
    df = pd.DataFrame([raw])

    df = engineer_features(
        df,
        salary_balance_median=_metadata.get("statistics", {}).get("salary_balance_median"),
    )

    feature_mapping = {
        "CreditScore": "credit_score",
        "Age": "age",
        "Tenure": "tenure",
        "Balance": "balance",
        "NumOfProducts": "products_number",
        "HasCrCard": "credit_card",
        "IsActiveMember": "active_member",
        "EstimatedSalary": "estimated_salary",
        "BalanceSalaryRatio": "balance_salary_ratio",
        "TenureAgeRatio": "tenure_age_ratio",
        "IsZeroBalance": "is_zero_balance",
        "EngagementScore": "engagement_score",
        "AgeGroup": "age_group",
        "Geography_Germany": "geography_germany",
        "Geography_Spain": "geography_spain",
        "Gender_Male": "gender_male",
    }
    
    metadata_features = _metadata.get("features", [])
    local_features = [feature_mapping.get(f, f.lower()) for f in metadata_features]
    
    return pd.DataFrame(df[local_features].values)


def _risk_level(prob: float) -> str:
    if prob < 0.30:  return "Low"
    if prob < 0.65:  return "Medium"
    return "High"


def _key_factors(inp: CustomerInput) -> list[str]:
    factors: list[str] = []
    if inp.active_member == 0:
        factors.append("Inactive member — strongest single churn predictor")
    if inp.products_number >= 3:
        factors.append("3+ products — paradoxically correlates with churn")
    if inp.balance > 100_000:
        factors.append("High balance — attracts competitor poaching")
    if inp.country == "Germany":
        factors.append("Germany region — nearly 2× baseline churn rate")
    if inp.credit_score < 500:
        factors.append("Low credit score — financial stress indicator")
    if inp.age > 50:
        factors.append("Age above 50 — elevated churn risk bracket")
    if inp.tenure <= 1:
        factors.append("Short tenure — loyalty not yet established")
    if inp.balance == 0:
        factors.append("Zero balance — potential unused secondary account")
    # Protective
    if inp.active_member == 1 and inp.tenure >= 5:
        factors.append("Active + long tenure — strong loyalty signal")
    if inp.credit_score >= 750:
        factors.append("Excellent credit score — financially stable customer")
    if inp.products_number == 2:
        factors.append("2 products — optimal engagement sweet spot")
    if inp.country == "Spain":
        factors.append("Spain region — historically low churn rate")
    return factors[:4] if factors else ["No significant risk factors identified"]


@app.get("/health", tags=["ops"])
async def health():
    metrics = _metadata.get("metrics", {})
    return {
        "status":     "ok",
        "features":   len(_metadata.get("features", [])),
        "accuracy":   metrics.get("accuracy"),
        "roc_auc":    metrics.get("roc_auc"),
    }


@app.get("/model-info", tags=["ops"])
async def model_info():
    metrics = _metadata.get("metrics", {})
    return {
        "features":           _metadata.get("features", []),
        "performance": {
            "accuracy":  metrics.get("accuracy"),
            "roc_auc":   metrics.get("roc_auc"),
            "f1":        metrics.get("f1"),
        },
    }


@app.post("/predict", response_model=PredictionResponse, tags=["prediction"])
async def predict(customer: CustomerInput):
    if _pipeline is None:
        raise HTTPException(503, "Model not loaded — run train_model.py first")

    t0 = time.perf_counter()

    X_input = _build_input_df(customer)
    probs   = _pipeline.predict_proba(X_input)[0]
    churn_p = float(probs[1])
    stay_p  = float(probs[0])
    elapsed = round((time.perf_counter() - t0) * 1000, 2)

    metrics = _metadata.get("metrics", {})
    return PredictionResponse(
        churn_probability  = round(churn_p, 4),
        prediction         = "Churn" if churn_p >= 0.5 else "Stay",
        risk_level         = _risk_level(churn_p),
        confidence         = round(max(churn_p, stay_p), 4),
        key_factors        = _key_factors(customer),
        model_accuracy     = metrics.get("accuracy", 0.0),
        model_roc_auc      = metrics.get("roc_auc", 0.0),
        inference_ms       = elapsed,
    )


@app.post("/predict/batch", tags=["prediction"])
async def predict_batch(customers: list[CustomerInput]):
    if len(customers) > 100:
        raise HTTPException(400, "Batch limit is 100")
    if _pipeline is None:
        raise HTTPException(503, "Model not loaded")
    results = []
    for c in customers:
        prob = float(_pipeline.predict_proba(_build_input_df(c))[0][1])
        results.append({
            "churn_probability": round(prob, 4),
            "prediction":        "Churn" if prob >= 0.5 else "Stay",
            "risk_level":        _risk_level(prob),
        })
    return {"count": len(results), "results": results}


if os.path.isdir(FRONTEND_DIST):
    assets_dir = os.path.join(FRONTEND_DIST, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        candidate = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(candidate):
            return FileResponse(candidate)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
else:
    @app.get("/", include_in_schema=False)
    async def root():
        return {
            "message": "ChurnScope API running",
            "docs":    "/docs",
            "predict": "POST /predict",
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
