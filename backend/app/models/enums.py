"""Enumerations shared by the database models and API schemas."""

from enum import StrEnum


class Role(StrEnum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    ADMIN = "admin"


class Sex(StrEnum):
    MALE = "male"
    FEMALE = "female"
    OTHER = "other"


class Disease(StrEnum):
    DIABETES = "diabetes"
    HEART = "heart"
    LIVER = "liver"
    SYMPTOM = "symptom"  # general symptom-based condition prediction


class RiskLevel(StrEnum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"


class PredictionStatus(StrEnum):
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"


class ReviewVerdict(StrEnum):
    AGREE = "agree"
    DISAGREE = "disagree"
    INCONCLUSIVE = "inconclusive"


class ChatRole(StrEnum):
    USER = "user"
    ASSISTANT = "assistant"


class DoctorStatus(StrEnum):
    """Manual verification state of a self-registered doctor."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
