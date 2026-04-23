#!/bin/bash
set -e
echo "ChurnScope v4 — Notebook Pipeline Setup (Python 3.11)"
python3.11 -m venv venv 2>/dev/null || python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
echo "Training (5–15 min)..."
python train_model.py
echo "Done. Run: uvicorn main:app --reload --port 8000"