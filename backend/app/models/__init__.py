"""Database models. Importing this package registers every table with SQLAlchemy."""

from .audit import AuditLog, ChatMessage
from .enums import (
    ChatRole,
    Disease,
    PredictionStatus,
    ReviewVerdict,
    RiskLevel,
    Role,
    Sex,
)
from .ml_model import ModelVersion
from .patient import Patient
from .prediction import Prediction
from .report import Report
from .review import DoctorReview
from .token import RevokedToken
from .user import User

__all__ = [
    "AuditLog",
    "ChatMessage",
    "ChatRole",
    "Disease",
    "DoctorReview",
    "ModelVersion",
    "Patient",
    "Prediction",
    "PredictionStatus",
    "Report",
    "ReviewVerdict",
    "RevokedToken",
    "RiskLevel",
    "Role",
    "Sex",
    "User",
]
