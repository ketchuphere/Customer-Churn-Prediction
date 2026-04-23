@echo off
echo ==
echo  ChurnScope v4 — Notebook Pipeline Setup  (Python 3.11)
echo  sklearn ColumnTransformer + SMOTE + VotingEnsemble
echo ==

py -3.11 -m venv venv
if errorlevel 1 (
    echo ERROR: Python 3.11 not found. Download from https://python.org
    pause & exit /b 1
)

call venv\Scripts\activate.bat
python -m pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

echo.
echo ==
echo  Training pipeline (5–15 min — includes EDA plots + CV)...
echo  Tip: add --skip-eda to skip plot generation and go faster.
echo ==
python train_model.py

echo.
echo  Setup complete! Run start.bat to launch the API.
pause