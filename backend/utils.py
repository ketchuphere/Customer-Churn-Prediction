from __future__ import annotations

import numpy as np
import pandas as pd

COLUMN_MAP: dict[str, str] = {
    "CreditScore":     "credit_score",
    "Geography":       "country",
    "Gender":          "gender",
    "Age":             "age",
    "Tenure":          "tenure",
    "Balance":         "balance",
    "NumOfProducts":   "products_number",
    "HasCrCard":       "credit_card",
    "IsActiveMember":  "active_member",
    "EstimatedSalary": "estimated_salary",
    "Exited":          "churn",
    # extras that may be present in the raw CSV
    "RowNumber":       "row_number",
    "CustomerId":      "customer_id",
    "Surname":         "surname",
}

BASE_FEATURES: list[str] = [
    "credit_score", "age", "tenure", "balance", "products_number",
    "credit_card", "active_member", "estimated_salary",
]
ENGINEERED_FEATURES: list[str] = [
    "balance_salary_ratio", "tenure_age_ratio", "is_zero_balance", 
    "engagement_score", "age_group",
]
ENCODED_FEATURES: list[str] = [
    "geography_germany", "geography_spain", "gender_male",
]
ALL_FEATURES: list[str] = BASE_FEATURES + ENGINEERED_FEATURES + ENCODED_FEATURES

_AGE_BINS   = [0,  25, 35, 45, 55, 65, 100]
_AGE_LABELS = ["<25", "25-34", "35-44", "45-54", "55-64", "65+"]
_TEN_BINS   = [-1, 0, 2, 5, 10, 100]
_TEN_LABELS = ["0", "1-2", "3-5", "6-10", "10+"]


def rename_columns(df: pd.DataFrame) -> pd.DataFrame:
    return df.rename(columns=COLUMN_MAP)


def engineer_features(
    df: pd.DataFrame,
    balance_75th: float | None = None,
    salary_balance_median: float | None = None,
) -> pd.DataFrame:
    df = df.copy()

    raw_ratio = df["estimated_salary"] / df["balance"].replace(0.0, np.nan)
    raw_ratio = raw_ratio.replace([np.inf, -np.inf], np.nan)
    fill_val = salary_balance_median if salary_balance_median is not None else raw_ratio.median()
    df["balance_salary_ratio"] = raw_ratio.fillna(fill_val)

    df["tenure_age_ratio"] = df["tenure"] / df["age"]

    df["is_zero_balance"] = (df["balance"] == 0).astype(int)

    df["engagement_score"] = (
        df["active_member"] * 2 +
        (df["products_number"] - 1) +
        df["credit_card"]
    )

    df["age_group"] = pd.cut(
        df["age"], bins=_AGE_BINS, labels=_AGE_LABELS
    ).cat.codes.astype(float)

    df["geography_germany"] = (df["country"] == "Germany").astype(int)
    df["geography_spain"] = (df["country"] == "Spain").astype(int)

    df["gender_male"] = (df["gender"] == "Male").astype(int)

    df = df.drop(columns=["country", "gender"], errors="ignore")

    return df