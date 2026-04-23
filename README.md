#  ChurnScope v4


---

## Architecture

```
Analysis.ipynb pipeline  →  train_model.py  →  best_churn_pipeline.pkl
                                                        ↓
                                               FastAPI /predict endpoint
                                                        ↓
                                               React + Vite frontend
```

### Backend pipeline (mirrors notebook steps)

| Step | Description |
|------|-------------|
| 2    | Load + rename columns (Churn_Modelling.csv → notebook schema) |
| 3    | Initial inspection |
| 4    | EDA — 12 plots saved to `artifacts/eda/` |
| 5    | Feature Engineering (5 new features) |
| 6    | sklearn `ColumnTransformer` Pipeline (impute + scale + OHE) |
| 7    | Stratified split + SMOTE on training set only |
| 8    | CV-compare: LogReg, RF, GBT, AdaBoost, VotingEnsemble |
| 9    | Auto-select best model, evaluate on test set |
| 10   | Feature importances extracted from best model |
| 11   | Save `best_churn_pipeline.pkl` + `metadata.json` |
| 12   | Example prediction |

### Column schema (notebook-style)

| API Field         | Notebook Column    | Original CSV       |
|-------------------|--------------------|--------------------|
| `credit_score`    | credit_score       | CreditScore        |
| `country`         | country            | Geography          |
| `gender`          | gender             | Gender             |
| `age`             | age                | Age                |
| `tenure`          | tenure             | Tenure             |
| `balance`         | balance            | Balance            |
| `products_number` | products_number    | NumOfProducts      |
| `credit_card`     | credit_card        | HasCrCard          |
| `active_member`   | active_member      | IsActiveMember     |
| `estimated_salary`| estimated_salary   | EstimatedSalary    |

### Engineered features (Step 5)

| Feature              | Formula                              |
|----------------------|--------------------------------------|
| balance_per_product  | balance / products_number            |
| salary_balance_ratio | estimated_salary / balance           |
| age_group            | pd.cut → `<25, 25-34, ..., 65+`      |
| tenure_bucket        | pd.cut → `0, 1-2, 3-5, 6-10, 10+`   |
| high_balance         | balance > training 75th percentile   |

---

## Quick Start

### Requirements
- Python **3.11.x** — https://python.org/downloads/
- Node.js 18+ — https://nodejs.org/

### Windows

```bat
:: Backend (one-time)
cd backend
setup.bat

:: Start API
start.bat

:: Frontend (new terminal, one-time)
cd frontend
setup.bat

:: Start UI
npm run dev
```

### Mac / Linux

```bash
cd backend && ./setup.sh
uvicorn main:app --reload --port 8000

# New terminal
cd frontend && npm install && npm run dev
```

- API → http://localhost:8000
- UI  → http://localhost:8080
- Docs → http://localhost:8000/docs

---

## API

### POST /predict

```json
{
  "credit_score": 650,
  "country": "France",
  "gender": "Male",
  "age": 40,
  "tenure": 3,
  "balance": 50000.0,
  "products_number": 2,
  "credit_card": 1,
  "active_member": 1,
  "estimated_salary": 60000.0
}
```

Response:
```json
{
  "churn_probability": 0.2341,
  "prediction": "Stay",
  "risk_level": "Low",
  "confidence": 0.7659,
  "key_factors": ["2 products — optimal engagement sweet spot", ...],
  "model_name": "VotingEnsemble",
  "model_accuracy": 0.874,
  "model_roc_auc": 0.924,
  "feature_importance": {"age": 0.18, "balance": 0.15, ...},
  "inference_ms": 4.2
}
```

### GET /health · GET /model-info · GET /docs

---

## Project Structure

```
churn_scope_final/
├── backend/
│   ├── train_model.py          ← Full notebook pipeline (Steps 2–12)
│   ├── main.py                 ← FastAPI (Pydantic v2, lifespan)
│   ├── utils.py                ← Shared: column rename + feature engineering
│   ├── requirements.txt        ← Python 3.11 pinned
│   ├── setup.bat / setup.sh    ← One-click setup
│   ├── start.bat               ← Launch API
│   ├── Churn_Modelling.csv
│   └── artifacts/
│       ├── best_churn_pipeline.pkl   ← sklearn Pipeline
│       ├── metadata.json
│       └── eda/                      ← 12 EDA plots (PNG)
│           ├── dist_age.png
│           ├── cv_model_comparison.png
│           ├── feature_importance.png
│           └── ...
└── frontend/
    ├── src/pages/Index.tsx     ← React UI (notebook field names)
    ├── vite.config.ts
    └── package.json
```

---

## Troubleshooting

| Error | Fix |
|-------|-----|
| `ImpImporter / pkg_resources` | `python -m pip install --upgrade pip setuptools wheel` |
| `Python 3.13 not compatible`  | Install Python 3.11 from python.org |
| `No pipeline found`           | Run `python train_model.py` first |
| `KeyError: 'country'`         | Old artifact — re-run training to regenerate |
| `npm ERR!`                    | Delete `node_modules/` then `npm install` |
