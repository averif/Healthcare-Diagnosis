"""Feature specifications for each disease module.

This is the single source of truth for feature names, human-readable labels, units, valid input
ranges and categorical codes. It is used by training, by the explainer (to write plain-English
reasons) and by the backend (to validate API input and build frontend forms).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Literal

FeatureKind = Literal["numeric", "categorical", "binary"]


@dataclass(frozen=True)
class FeatureSpec:
    name: str  # column name used by the model
    label: str  # human-readable name
    kind: FeatureKind
    unit: str = ""
    min: float | None = None
    max: float | None = None
    choices: dict[str, str] = field(default_factory=dict)  # code -> label (categorical/binary)
    required: bool = True
    help: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    def describe_value(self, value: object) -> str:
        """Format a raw value for display, e.g. '168 mg/dL' or 'asymptomatic'."""
        if self.kind in ("categorical", "binary") and self.choices:
            return self.choices.get(_code(value), str(value))
        if isinstance(value, float):
            value = f"{value:g}"
        return f"{value} {self.unit}".strip()


def _code(value: object) -> str:
    """Normalise categorical codes so 4, 4.0 and '4' all map to '4'."""
    if isinstance(value, float) and value.is_integer():
        value = int(value)
    return str(value)


YES_NO = {"0": "no", "1": "yes"}

DIABETES_FEATURES: list[FeatureSpec] = [
    FeatureSpec("Pregnancies", "Number of pregnancies", "numeric", "", 0, 20),
    FeatureSpec(
        "Glucose",
        "Plasma glucose (2-h OGTT)",
        "numeric",
        "mg/dL",
        40,
        300,
        help="Glucose concentration 2 hours after an oral glucose tolerance test",
    ),
    FeatureSpec("BloodPressure", "Diastolic blood pressure", "numeric", "mm Hg", 30, 140),
    FeatureSpec(
        "SkinThickness", "Triceps skin-fold thickness", "numeric", "mm", 5, 100, required=False
    ),
    FeatureSpec("Insulin", "2-hour serum insulin", "numeric", "µU/mL", 10, 900, required=False),
    FeatureSpec("BMI", "Body mass index", "numeric", "kg/m²", 10, 70),
    FeatureSpec(
        "DiabetesPedigreeFunction",
        "Diabetes pedigree function",
        "numeric",
        "",
        0.05,
        2.5,
        help="Score summarising diabetes history in relatives (higher = stronger family history)",
    ),
    FeatureSpec("Age", "Age", "numeric", "years", 18, 100),
]

HEART_FEATURES: list[FeatureSpec] = [
    FeatureSpec("age", "Age", "numeric", "years", 18, 100),
    FeatureSpec("sex", "Sex", "binary", choices={"0": "female", "1": "male"}),
    FeatureSpec(
        "cp",
        "Chest pain type",
        "categorical",
        choices={
            "1": "typical angina",
            "2": "atypical angina",
            "3": "non-anginal pain",
            "4": "asymptomatic",
        },
    ),
    FeatureSpec("trestbps", "Resting blood pressure", "numeric", "mm Hg", 80, 220),
    FeatureSpec("chol", "Serum cholesterol", "numeric", "mg/dL", 100, 600),
    FeatureSpec("fbs", "Fasting blood sugar > 120 mg/dL", "binary", choices=YES_NO),
    FeatureSpec(
        "restecg",
        "Resting ECG",
        "categorical",
        choices={"0": "normal", "1": "ST-T wave abnormality", "2": "left ventricular hypertrophy"},
    ),
    FeatureSpec("thalach", "Maximum heart rate achieved", "numeric", "bpm", 60, 220),
    FeatureSpec("exang", "Exercise-induced angina", "binary", choices=YES_NO),
    FeatureSpec(
        "oldpeak", "ST depression induced by exercise", "numeric", "mm", 0, 7, help="vs rest"
    ),
    FeatureSpec(
        "slope",
        "Slope of peak exercise ST segment",
        "categorical",
        choices={"1": "upsloping", "2": "flat", "3": "downsloping"},
    ),
    FeatureSpec(
        "ca", "Major vessels coloured by fluoroscopy", "numeric", "vessels", 0, 3, required=False
    ),
    FeatureSpec(
        "thal",
        "Thalassemia (thallium stress test)",
        "categorical",
        choices={"3": "normal", "6": "fixed defect", "7": "reversible defect"},
        required=False,
    ),
]

LIVER_FEATURES: list[FeatureSpec] = [
    FeatureSpec("Age", "Age", "numeric", "years", 4, 90),
    FeatureSpec("Gender", "Sex", "binary", choices={"0": "female", "1": "male"}),
    FeatureSpec("Total_Bilirubin", "Total bilirubin", "numeric", "mg/dL", 0.1, 80),
    FeatureSpec("Direct_Bilirubin", "Direct bilirubin", "numeric", "mg/dL", 0.1, 20),
    FeatureSpec("Alkaline_Phosphotase", "Alkaline phosphatase (ALP)", "numeric", "IU/L", 50, 2500),
    FeatureSpec(
        "Alamine_Aminotransferase", "Alanine aminotransferase (ALT)", "numeric", "IU/L", 5, 2000
    ),
    FeatureSpec(
        "Aspartate_Aminotransferase",
        "Aspartate aminotransferase (AST)",
        "numeric",
        "IU/L",
        5,
        5000,
    ),
    FeatureSpec("Total_Proteins", "Total proteins", "numeric", "g/dL", 2, 10),
    FeatureSpec("Albumin", "Albumin", "numeric", "g/dL", 0.5, 6),
    FeatureSpec(
        "Albumin_and_Globulin_Ratio",
        "Albumin/globulin ratio",
        "numeric",
        "",
        0.2,
        3,
        required=False,
    ),
]

# Symptoms that always trigger an urgent-care warning, whatever the model predicts.
RED_FLAG_SYMPTOMS: frozenset[str] = frozenset(
    {
        "chest_pain",
        "breathlessness",
        "coma",
        "altered_sensorium",
        "slurred_speech",
        "weakness_of_one_body_side",
        "stomach_bleeding",
        "blood_in_sputum",
        "bloody_stool",
        "acute_liver_failure",
        "fast_heart_rate",
        "loss_of_balance",
    }
)


def humanize_symptom(name: str) -> str:
    """'yellowing_of_eyes' -> 'Yellowing of eyes'."""
    text = name.replace("_", " ").replace("(", " (").replace("  ", " ").strip()
    return text[:1].upper() + text[1:]


def symptom_specs(symptoms: list[str]) -> list[FeatureSpec]:
    return [
        FeatureSpec(s, humanize_symptom(s), "binary", choices={"0": "absent", "1": "present"})
        for s in symptoms
    ]


FEATURES: dict[str, list[FeatureSpec]] = {
    "diabetes": DIABETES_FEATURES,
    "heart": HEART_FEATURES,
    "liver": LIVER_FEATURES,
}


def spec_index(specs: list[FeatureSpec]) -> dict[str, FeatureSpec]:
    return {s.name: s for s in specs}
