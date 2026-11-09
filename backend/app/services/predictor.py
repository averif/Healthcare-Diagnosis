"""Runs the trained models (via the `medml` package) and stores explained predictions."""

from __future__ import annotations

from pathlib import Path
from threading import Lock

from flask import current_app
from medml.features import RED_FLAG_SYMPTOMS, humanize_symptom
from medml.inference import InputError, ModelBundle

from ..extensions import db
from ..models import Disease, ModelVersion, Patient, Prediction, RiskLevel, User
from . import guidance

MODULE_INFO = {
    Disease.DIABETES: "Estimates the likelihood of diabetes from 8 clinical measurements.",
    Disease.HEART: "Estimates the likelihood of coronary heart disease from 13 clinical tests.",
    Disease.LIVER: "Estimates the likelihood of liver disease from 10 liver function tests.",
    Disease.SYMPTOM: "Suggests the most likely of 41 common conditions from reported symptoms.",
}


class PredictionService:
    """Loads each model once and keeps it in memory (predictions take a few milliseconds)."""

    def __init__(self, models_dir: Path):
        self.models_dir = Path(models_dir)
        self._bundles: dict[str, ModelBundle] = {}
        self._lock = Lock()

    def bundle(self, disease: Disease) -> ModelBundle:
        key = disease.value
        if key not in self._bundles:
            with self._lock:
                if key not in self._bundles:
                    self._bundles[key] = ModelBundle.load(key, self.models_dir)
        return self._bundles[key]

    # -- module catalogue ------------------------------------------------------------------

    def module(self, disease: Disease) -> dict:
        b = self.bundle(disease)
        card = b.card
        info = {
            "disease": disease.value,
            "title": card["title"],
            "description": MODULE_INFO[disease],
            "algorithm": card["algorithm"],
            "version": card["version"],
            "class_names": card["class_names"],
            "test_metrics": {
                k: v
                for k, v in card["evaluation"]["test"].items()
                if isinstance(v, int | float) and k != "support"
            },
            "limitations": card["limitations"],
        }
        if disease == Disease.SYMPTOM:
            info["symptoms"] = [
                {"name": f.name, "label": f.label, "red_flag": f.name in RED_FLAG_SYMPTOMS}
                for f in sorted(b.features, key=lambda f: f.label)
            ]
            info["features"] = []
        else:
            info["features"] = [f.to_dict() for f in b.features]
        return info

    def modules(self) -> list[dict]:
        return [self.module(d) for d in Disease]

    # -- model registry -------------------------------------------------------------------

    def model_version(self, disease: Disease) -> ModelVersion:
        """Registry row for the loaded model, created on first use and marked active."""
        card = self.bundle(disease).card
        row = db.session.scalar(
            db.select(ModelVersion).filter_by(disease=disease, version=card["version"])
        )
        if row is None:
            db.session.execute(
                db.update(ModelVersion)
                .where(ModelVersion.disease == disease)
                .values(is_active=False)
            )
            row = ModelVersion(
                disease=disease,
                version=card["version"],
                algorithm=card["algorithm"],
                file_path=f"ml/models/{disease.value}.joblib",
                features=card["feature_names"],
                metrics={
                    "test": card["evaluation"]["test"],
                    "nested_cv": card["evaluation"]["nested_cv"],
                },
                is_active=True,
            )
            db.session.add(row)
            db.session.flush()
        return row

    # -- prediction -----------------------------------------------------------------------

    def evaluate(self, disease: Disease, inputs: dict) -> dict:
        """Run the model and add risk band, guidance and red flags. Raises InputError."""
        result = self.bundle(disease).predict(inputs)
        if disease == Disease.SYMPTOM:
            symptoms = sorted(set(inputs.get("symptoms", [])))
            flags = result["red_flags"]
            risk = guidance.symptom_triage(result["predicted_label"], flags)
            result["risk_level"] = risk
            result["guidance"] = guidance.symptom_guidance(result["predicted_label"], risk)
            result["red_flags"] = guidance.symptom_red_flag_messages(flags, humanize_symptom)
            result["inputs"] = {"symptoms": symptoms}
        else:
            risk = result["risk_level"]
            result["guidance"] = guidance.clinical_guidance(disease.value, risk)
            result["red_flags"] = guidance.input_red_flags(disease.value, inputs)
            result["inputs"] = {f.name: inputs.get(f.name) for f in self.bundle(disease).features}
        return result

    def create(self, disease: Disease, patient: Patient, inputs: dict, by: User) -> Prediction:
        result = self.evaluate(disease, inputs)
        prediction = Prediction(
            patient=patient,
            created_by=by,
            model_version=self.model_version(disease),
            disease=disease,
            input_data=result["inputs"],
            predicted_label=result["predicted_label"],
            probability=result["probability"],
            risk_level=RiskLevel(result["risk_level"]),
            explanation={
                "explanation": result["explanation"],
                "top_conditions": result.get("top_conditions"),
                "guidance": result["guidance"],
                "red_flags": result["red_flags"],
            },
        )
        db.session.add(prediction)
        db.session.flush()
        return prediction


def prediction_service() -> PredictionService:
    return current_app.extensions["prediction_service"]


__all__ = ["InputError", "PredictionService", "prediction_service"]
