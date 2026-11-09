"""Load and clean the raw datasets.

Each loader returns a :class:`Dataset` holding the feature matrix, the target and a cleaning log
(what was changed and why), which is copied into the model card and the final report.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .features import (
    DIABETES_FEATURES,
    HEART_FEATURES,
    LIVER_FEATURES,
    FeatureSpec,
    symptom_specs,
)
from .paths import RAW_DIR


@dataclass
class Dataset:
    name: str
    title: str
    X: pd.DataFrame
    y: pd.Series
    features: list[FeatureSpec]
    class_names: list[str]  # index i = label for class i (binary: ["negative", "positive"])
    source: str
    cleaning_log: list[str] = field(default_factory=list)
    raw_rows: int = 0

    @property
    def is_binary(self) -> bool:
        return len(self.class_names) == 2

    def class_balance(self) -> dict[str, int]:
        counts = self.y.value_counts().sort_index()
        if self.is_binary:
            return {self.class_names[int(k)]: int(v) for k, v in counts.items()}
        return {str(k): int(v) for k, v in counts.items()}


# --------------------------------------------------------------------------------------------
# Diabetes (Pima Indians)
# --------------------------------------------------------------------------------------------

#: Zero is physiologically impossible for these measurements; it encodes "not measured".
PIMA_ZERO_AS_MISSING = ["Glucose", "BloodPressure", "SkinThickness", "Insulin", "BMI"]


def load_diabetes() -> Dataset:
    df = pd.read_csv(RAW_DIR / "diabetes_pima.csv")
    log: list[str] = []
    raw_rows = len(df)

    for col in PIMA_ZERO_AS_MISSING:
        n = int((df[col] == 0).sum())
        df[col] = df[col].replace(0, np.nan)
        log.append(f"{col}: {n} zero values ({n / raw_rows:.1%}) treated as missing")
    log.append("Missing values are imputed with the training-fold median inside the pipeline")

    return Dataset(
        name="diabetes",
        title="Diabetes",
        X=df[[f.name for f in DIABETES_FEATURES]],
        y=df["Outcome"].astype(int),
        features=DIABETES_FEATURES,
        class_names=["Non-diabetic", "Diabetic"],
        source="Pima Indians Diabetes Database (NIDDK; Smith et al., 1988)",
        cleaning_log=log,
        raw_rows=raw_rows,
    )


# --------------------------------------------------------------------------------------------
# Heart disease (UCI Cleveland)
# --------------------------------------------------------------------------------------------

HEART_COLUMNS = [f.name for f in HEART_FEATURES] + ["num"]


def load_heart() -> Dataset:
    df = pd.read_csv(
        RAW_DIR / "heart_cleveland.data", header=None, names=HEART_COLUMNS, na_values="?"
    )
    raw_rows = len(df)
    missing = {c: int(n) for c, n in df.isna().sum().items() if n}
    log = [
        f"Missing values ('?') found: {missing}; imputed inside the pipeline",
        "Target 'num' (0-4 severity) binarised: 0 = no disease, 1-4 = disease present",
        "Categorical codes (cp, restecg, slope, thal) one-hot encoded so they are not "
        "treated as ordered numbers",
        "Original 303-row UCI Cleveland file used instead of the 1,025-row Kaggle copy, which "
        "contains repeated patients and leaks between train and test",
    ]
    y = (df["num"] > 0).astype(int)
    return Dataset(
        name="heart",
        title="Heart Disease",
        X=df[[f.name for f in HEART_FEATURES]],
        y=y,
        features=HEART_FEATURES,
        class_names=["No heart disease", "Heart disease"],
        source="UCI Heart Disease, Cleveland subset (Janosi et al., 1988)",
        cleaning_log=log,
        raw_rows=raw_rows,
    )


# --------------------------------------------------------------------------------------------
# Liver disease (ILPD)
# --------------------------------------------------------------------------------------------

LIVER_COLUMNS = [f.name for f in LIVER_FEATURES] + ["Selector"]


def load_liver() -> Dataset:
    df = pd.read_csv(RAW_DIR / "liver_ilpd.csv", header=None, names=LIVER_COLUMNS)
    raw_rows = len(df)
    log: list[str] = []

    dups = int(df.duplicated().sum())
    df = df.drop_duplicates().reset_index(drop=True)
    log.append(f"Removed {dups} exact duplicate rows so no patient appears in both train and test")

    df["Gender"] = df["Gender"].map({"Female": 0, "Male": 1}).astype(int)
    log.append("Gender encoded as 0 = female, 1 = male")

    n_missing = int(df["Albumin_and_Globulin_Ratio"].isna().sum())
    log.append(f"Albumin_and_Globulin_Ratio: {n_missing} missing values imputed (median)")

    # Source labels are 1 = liver patient, 2 = non-liver patient -> remap to 1 / 0
    y = (df["Selector"] == 1).astype(int)
    log.append("Target remapped from (1 = disease, 2 = healthy) to (1 = disease, 0 = healthy)")

    return Dataset(
        name="liver",
        title="Liver Disease",
        X=df[[f.name for f in LIVER_FEATURES]],
        y=y,
        features=LIVER_FEATURES,
        class_names=["No liver disease", "Liver disease"],
        source="Indian Liver Patient Dataset, ILPD (Ramana & Venkateswarlu, 2012)",
        cleaning_log=log,
        raw_rows=raw_rows,
    )


# --------------------------------------------------------------------------------------------
# General symptoms (41 diseases, 131 symptoms)
# --------------------------------------------------------------------------------------------

DISEASE_NAME_FIXES = {
    "(vertigo) Paroymsal  Positional Vertigo": "Benign paroxysmal positional vertigo",
    "Dimorphic hemmorhoids(piles)": "Haemorrhoids (piles)",
    "Osteoarthristis": "Osteoarthritis",
    "Peptic ulcer diseae": "Peptic ulcer disease",
    "hepatitis A": "Hepatitis A",
    "Paralysis (brain hemorrhage)": "Paralysis (brain haemorrhage)",
}


def _clean_symptom_frame(df: pd.DataFrame) -> pd.DataFrame:
    df = df.loc[:, ~df.columns.str.startswith("Unnamed")]
    # 'fluid_overload' is never used; its duplicate 'fluid_overload.1' holds the real values
    df = df.drop(columns=["fluid_overload"]).rename(columns={"fluid_overload.1": "fluid_overload"})
    df.columns = [c.strip().replace(" ", "") for c in df.columns]  # 'spotting_ urination' etc.
    df["prognosis"] = df["prognosis"].str.strip().replace(DISEASE_NAME_FIXES)
    return df


def load_symptoms(include_test_file: bool = True) -> Dataset:
    train = _clean_symptom_frame(pd.read_csv(RAW_DIR / "symptoms_train.csv"))
    frames = [train]
    if include_test_file:
        frames.append(_clean_symptom_frame(pd.read_csv(RAW_DIR / "symptoms_test.csv")))
    df = pd.concat(frames, ignore_index=True)
    raw_rows = len(df)

    deduped = df.drop_duplicates().reset_index(drop=True)
    symptoms = [c for c in deduped.columns if c != "prognosis"]
    log = [
        "Fixed malformed column names (e.g. 'spotting_ urination', 'dischromic _patches') and "
        "disease-name typos (e.g. 'Osteoarthristis', 'Peptic ulcer diseae')",
        "Dropped the empty 'fluid_overload' column "
        "(its duplicate 'fluid_overload.1' holds the data)",
        f"Merged the train and test files and removed exact duplicates: {raw_rows} -> "
        f"{len(deduped)} unique rows. The original test file was almost entirely copies of "
        "training rows, which makes ~100% accuracy meaningless",
        "Evaluation uses stratified cross-validation on unique rows plus a robustness test that "
        "hides some of the patient's symptoms",
    ]

    class_names = sorted(deduped["prognosis"].unique())
    y = deduped["prognosis"].map({name: i for i, name in enumerate(class_names)}).astype(int)
    return Dataset(
        name="symptom",
        title="Symptom Checker",
        X=deduped[symptoms].astype(int),
        y=y,
        features=symptom_specs(symptoms),
        class_names=class_names,
        source="Disease Prediction Using Machine Learning (Kaggle, 132 symptoms / 41 diseases)",
        cleaning_log=log,
        raw_rows=raw_rows,
    )


LOADERS: dict[str, Callable[[], Dataset]] = {
    "diabetes": load_diabetes,
    "heart": load_heart,
    "liver": load_liver,
    "symptom": load_symptoms,
}


def load(name: str) -> Dataset:
    try:
        return LOADERS[name]()
    except KeyError:
        raise ValueError(f"Unknown dataset {name!r}; choose from {sorted(LOADERS)}") from None
