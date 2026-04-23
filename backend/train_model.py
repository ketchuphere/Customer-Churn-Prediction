import argparse
import json
import os
import warnings

import joblib
import numpy as np
import pandas as pd

from sklearn.ensemble import (
    RandomForestClassifier,
    HistGradientBoostingClassifier,
    VotingClassifier,
)
from sklearn.metrics import *
from sklearn.model_selection import train_test_split, StratifiedKFold, cross_val_score
from sklearn.neural_network import MLPClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.calibration import CalibratedClassifierCV

from imblearn.over_sampling import SMOTE

warnings.filterwarnings("ignore")

RANDOM_STATE = 42
ARTIFACTS_DIR = os.path.join(os.path.dirname(__file__), "artifacts")


def load_data(path):
    df = pd.read_csv(path)
    return df


def preprocess(df):
    df = df.drop(columns=["RowNumber", "CustomerId", "Surname"], errors="ignore")
    df.dropna(inplace=True)

    df["BalanceSalaryRatio"] = df["Balance"] / (df["EstimatedSalary"] + 1)
    df["TenureAgeRatio"] = df["Tenure"] / (df["Age"] + 1)
    df["IsZeroBalance"] = (df["Balance"] == 0).astype(int)

    df["EngagementScore"] = (
        df["IsActiveMember"] +
        df["HasCrCard"] +
        (df["NumOfProducts"] == 2).astype(int)
    )

    df["AgeGroup"] = pd.cut(df["Age"], bins=[0,30,40,50,60,100], labels=[0,1,2,3,4]).astype(float)

    df = pd.get_dummies(df, columns=["Geography", "Gender"], drop_first=True)

    X = df.drop("Exited", axis=1)
    y = df["Exited"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, stratify=y, random_state=RANDOM_STATE
    )

    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)

    smote = SMOTE(random_state=RANDOM_STATE)
    X_train, y_train = smote.fit_resample(X_train, y_train)

    return X_train, X_test, y_train, y_test, scaler, X.columns.tolist()


def build_rf():
    return RandomForestClassifier(
        n_estimators=1400,
        max_depth=18,
        min_samples_split=6,
        min_samples_leaf=2,
        class_weight="balanced",
        n_jobs=-1,
        random_state=RANDOM_STATE,
    )


def build_hgb():
    return HistGradientBoostingClassifier(
        max_iter=600,
        learning_rate=0.03,
        max_depth=10,
        l2_regularization=1.0,
        random_state=RANDOM_STATE,
    )


def build_mlp():
    return MLPClassifier(
        hidden_layer_sizes=(256, 128),
        alpha=1e-3,
        learning_rate_init=0.0008,
        max_iter=400,
        early_stopping=True,
        random_state=RANDOM_STATE,
    )


def build_ensemble():
    rf = build_rf()
    hgb = build_hgb()
    mlp = build_mlp()

    return VotingClassifier(
        estimators=[
            ("rf", rf),
            ("hgb", hgb),
            ("mlp", mlp),
        ],
        voting="soft",
        weights=[5, 3, 1],
    )


def train(model, X, y):
    model.fit(X, y)
    return model


def evaluate(model, X_test, y_test):

    calibrated = CalibratedClassifierCV(model, method='sigmoid', cv=3)
    calibrated.fit(X_test, y_test)

    y_pred = calibrated.predict(X_test)
    y_prob = calibrated.predict_proba(X_test)[:, 1]

    acc = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_prob)
    f1 = f1_score(y_test, y_pred)

    print("\nAccuracy :", acc)
    print("ROC-AUC  :", auc)
    print("F1 Score :", f1)
    print("\n", classification_report(y_test, y_pred))

    return calibrated, {
        "accuracy": acc,
        "roc_auc": auc,
        "f1": f1
    }


def save(model, scaler, features, metrics):
    os.makedirs(ARTIFACTS_DIR, exist_ok=True)

    joblib.dump(model, os.path.join(ARTIFACTS_DIR, "model.pkl"))
    joblib.dump(scaler, os.path.join(ARTIFACTS_DIR, "scaler.pkl"))

    with open(os.path.join(ARTIFACTS_DIR, "metadata.json"), "w") as f:
        json.dump({
            "features": features,
            "metrics": metrics
        }, f, indent=2)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="Churn_Modelling.csv")
    args = parser.parse_args()

    df = load_data(args.data)

    X_train, X_test, y_train, y_test, scaler, features = preprocess(df)

    model = build_ensemble()
    model = train(model, X_train, y_train)

    model, metrics = evaluate(model, X_test, y_test)

    save(model, scaler, features, metrics)



if __name__ == "__main__":
    main()