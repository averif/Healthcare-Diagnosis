"""Filesystem locations used by the ML pipeline."""

from pathlib import Path

ML_ROOT = Path(__file__).resolve().parents[2]  # .../ml
RAW_DIR = ML_ROOT / "data" / "raw"
PROCESSED_DIR = ML_ROOT / "data" / "processed"
MODELS_DIR = ML_ROOT / "models"
REPORTS_DIR = ML_ROOT / "reports"

RANDOM_STATE = 42  # fixed seed so every run is reproducible
