"""Tests against the trained, committed models in ml/models/."""

import pytest

from medml.inference import InputError, ModelBundle, risk_level
from medml.paths import MODELS_DIR

pytestmark = pytest.mark.skipif(
    not (MODELS_DIR / "symptom.joblib").exists(), reason="run `python -m medml.train` first"
)

SAMPLES = {
    "diabetes": {
        "Pregnancies": 2,
        "Glucose": 168,
        "BloodPressure": 74,
        "SkinThickness": None,
        "Insulin": None,
        "BMI": 33.1,
        "DiabetesPedigreeFunction": 0.62,
        "Age": 47,
    },
    "heart": {
        "age": 61,
        "sex": 1,
        "cp": 4,
        "trestbps": 140,
        "chol": 260,
        "fbs": 0,
        "restecg": 2,
        "thalach": 120,
        "exang": 1,
        "oldpeak": 2.5,
        "slope": 2,
        "ca": 2,
        "thal": 7,
    },
    "liver": {
        "Age": 45,
        "Gender": 1,
        "Total_Bilirubin": 3.2,
        "Direct_Bilirubin": 1.6,
        "Alkaline_Phosphotase": 420,
        "Alamine_Aminotransferase": 95,
        "Aspartate_Aminotransferase": 120,
        "Total_Proteins": 6.4,
        "Albumin": 2.9,
        "Albumin_and_Globulin_Ratio": 0.8,
    },
}


@pytest.mark.parametrize("disease", ["diabetes", "heart", "liver"])
def test_binary_prediction_contract(disease):
    bundle = ModelBundle.load(disease)
    result = bundle.predict(SAMPLES[disease])
    assert 0.0 <= result["probability"] <= 1.0
    assert result["risk_level"] in {"low", "moderate", "high"}
    assert result["predicted_label"] in bundle.class_names
    assert result["explanation"]["reasons"]
    assert result["model"]["version"] == bundle.card["version"]


def test_high_risk_heart_profile_is_flagged():
    result = ModelBundle.load("heart").predict(SAMPLES["heart"])
    assert result["predicted_class"] == 1


def test_out_of_range_and_missing_values_are_rejected():
    bundle = ModelBundle.load("diabetes")
    bad = SAMPLES["diabetes"] | {"Glucose": 900, "BMI": None, "Bogus": 1}
    with pytest.raises(InputError) as exc:
        bundle.predict(bad)
    assert set(exc.value.errors) == {"Glucose", "BMI", "Bogus"}


def test_symptom_prediction_returns_differential_and_red_flags():
    bundle = ModelBundle.load("symptom")
    result = bundle.predict({"symptoms": ["chest_pain", "breathlessness", "sweating", "vomiting"]})
    assert 1 <= len(result["top_conditions"]) <= 3
    assert result["red_flags"] == ["breathlessness", "chest_pain"]
    assert result["predicted_label"] == result["top_conditions"][0]["condition"]


def test_symptom_input_validation():
    bundle = ModelBundle.load("symptom")
    with pytest.raises(InputError):
        bundle.predict({"symptoms": ["itching"]})
    with pytest.raises(InputError):
        bundle.predict({"symptoms": ["itching", "not_a_symptom"]})


def test_risk_bands():
    assert risk_level(0.1) == "low"
    assert risk_level(0.5) == "moderate"
    assert risk_level(0.9) == "high"
