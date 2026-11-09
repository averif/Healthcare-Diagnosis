"""Load a trained model + model card and turn raw inputs into an explained prediction.

This is the only module the backend needs at runtime:

    bundle = ModelBundle.load("diabetes")
    result = bundle.predict({"Glucose": 168, "BMI": 33.1, ...})
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.pipeline import Pipeline

from .explain import explain
from .features import FEATURES, RED_FLAG_SYMPTOMS, FeatureSpec, symptom_specs
from .paths import MODELS_DIR

#: Probability cut-offs for the risk bands shown to users.
RISK_BANDS = (("low", 0.35), ("moderate", 0.65), ("high", 1.01))


def risk_level(probability: float) -> str:
    for name, upper in RISK_BANDS:
        if probability < upper:
            return name
    return "high"


class InputError(ValueError):
    """Raised when inputs are missing or outside the plausible clinical range."""

    def __init__(self, errors: dict[str, str]):
        super().__init__("; ".join(f"{k}: {v}" for k, v in errors.items()))
        self.errors = errors


def validate_inputs(specs: list[FeatureSpec], inputs: dict[str, object]) -> dict[str, object]:
    """Return a clean {feature: float | None} dict or raise InputError."""
    errors: dict[str, str] = {}
    clean: dict[str, object] = {}
    known = {s.name for s in specs}
    for name in inputs:
        if name not in known:
            errors[name] = "Unknown field."
    for spec in specs:
        value = inputs.get(spec.name)
        if value is None or value == "":
            if spec.required:
                errors[spec.name] = "This field is required."
            clean[spec.name] = None
            continue
        try:
            number = float(value)  # type: ignore[arg-type]
        except (TypeError, ValueError):
            errors[spec.name] = "Must be a number."
            continue
        if spec.kind == "numeric":
            too_low = spec.min is not None and number < spec.min
            too_high = spec.max is not None and number > spec.max
            if too_low or too_high:
                errors[spec.name] = f"Must be between {spec.min:g} and {spec.max:g}."
        elif spec.choices and str(int(number)) not in spec.choices:
            errors[spec.name] = f"Must be one of {sorted(spec.choices)}."
        clean[spec.name] = number
    if errors:
        raise InputError(errors)
    return clean


@dataclass
class ModelBundle:
    disease: str
    pipeline: Pipeline
    card: dict
    features: list[FeatureSpec]

    @classmethod
    def load(cls, disease: str, models_dir: Path = MODELS_DIR) -> ModelBundle:
        pipeline = joblib.load(models_dir / f"{disease}.joblib")
        card = json.loads((models_dir / f"{disease}.card.json").read_text(encoding="utf-8"))
        if disease == "symptom":
            features = symptom_specs(card["feature_names"])
        else:
            features = FEATURES[disease]
        return cls(disease, pipeline, card, features)

    @property
    def class_names(self) -> list[str]:
        return self.card["class_names"]

    @property
    def is_binary(self) -> bool:
        return len(self.class_names) == 2

    def predict(self, inputs: dict[str, object]) -> dict:
        if self.disease == "symptom":
            return self.predict_symptoms(list(inputs.get("symptoms", [])))  # type: ignore[arg-type]

        clean = validate_inputs(self.features, inputs)
        frame = pd.DataFrame([clean]).astype(float)
        proba = self.pipeline.predict_proba(frame)[0]
        positive = float(proba[1])
        predicted = int(positive >= 0.5)
        explanation = explain(self.pipeline, self.features, clean, target_class=1)
        return {
            "disease": self.disease,
            "predicted_class": predicted,
            "predicted_label": self.class_names[predicted],
            "probability": round(positive, 4),  # probability of the disease being present
            "risk_level": risk_level(positive),
            "explanation": explanation,
            "red_flags": [],
            "model": self.model_summary(),
        }

    def predict_symptoms(self, symptoms: list[str]) -> dict:
        known = {s.name for s in self.features}
        unknown = [s for s in symptoms if s not in known]
        if unknown:
            raise InputError({"symptoms": f"Unknown symptoms: {', '.join(unknown)}"})
        if len(set(symptoms)) < 2:
            raise InputError({"symptoms": "Select at least 2 symptoms."})

        inputs = {s.name: float(s.name in symptoms) for s in self.features}
        frame = pd.DataFrame([inputs])
        proba = self.pipeline.predict_proba(frame)[0]
        top = np.argsort(proba)[::-1][:3]
        best = int(top[0])
        explanation = explain(self.pipeline, self.features, inputs, target_class=best)
        return {
            "disease": self.disease,
            "predicted_class": best,
            "predicted_label": self.class_names[best],
            "probability": round(float(proba[best]), 4),
            "risk_level": None,  # not meaningful for a differential of 41 conditions
            "top_conditions": [
                {"condition": self.class_names[i], "probability": round(float(proba[i]), 4)}
                for i in top
                if proba[i] > 0
            ],
            "explanation": explanation,
            "red_flags": sorted(set(symptoms) & RED_FLAG_SYMPTOMS),
            "model": self.model_summary(),
        }

    def model_summary(self) -> dict:
        test = self.card["evaluation"]["test"]
        return {
            "version": self.card["version"],
            "algorithm": self.card["algorithm"],
            "trained_at": self.card["trained_at"],
            "test_metrics": {k: test[k] for k in ("accuracy", "recall", "f1") if k in test},
        }
