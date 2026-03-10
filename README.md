#ChurnScope — Customer Churn Prediction

Full-stack deep learning app: **React + Vite frontend** connected to a **FastAPI backend** with a trained neural network.

## Project Structure

```
churn-scope/
├── backend/
│   ├── main.py               ← FastAPI (API + serves built frontend)
│   ├── train_model.py        ← Training pipeline
│   ├── requirements.txt
│   ├── Churn_Modelling.csv
│   └── artifacts/            ← Pre-trained model, scaler, metadata
│
└── frontend/                 ← React + Vite + Tailwind + shadcn/ui
    ├── src/pages/Index.tsx   ← Main prediction UI
    ├── vite.config.ts        ← Proxy /predict → localhost:8000
    └── package.json
```

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend — Development
```bash
cd frontend
npm install
npm run dev          # Opens http://localhost:8080
```
Vite auto-proxies `/predict` calls to FastAPI on port 8000.

### Frontend — Production Build
```bash
cd frontend
npm install && npm run build
cp -r dist ../backend/frontend/dist
# Now visit http://localhost:8000 — FastAPI serves both UI and API
```

## API

`POST /predict`
```json
{ "credit_score":619, "geography":"France", "gender":"Female",
  "age":42, "tenure":2, "balance":0.0, "num_of_products":1,
  "has_cr_card":1, "is_active_member":1, "estimated_salary":101348.88 }
```
Returns: `churn_probability`, `prediction`, `risk_level`, `confidence`, `key_factors`

Swagger docs → http://localhost:8000/docs
