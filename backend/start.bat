@echo off
call venv\Scripts\activate.bat
echo ChurnScope API → http://localhost:8000
echo Swagger docs  → http://localhost:8000/docs
uvicorn main:app --reload --port 8000
