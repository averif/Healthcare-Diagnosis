"""General guidance, red-flag warnings and symptom triage shown with every prediction.

This content is deliberately general: lifestyle advice, which tests to discuss with a doctor, and
when to seek urgent care. It never prescribes treatment or medication. Wording follows widely
published public-health advice (WHO, NHS, American Diabetes/Heart Associations).
"""

from __future__ import annotations

from collections.abc import Callable

URGENT = "Seek urgent medical care"

# --------------------------------------------------------------------------------------------
# Clinical modules: guidance by risk band
# --------------------------------------------------------------------------------------------

GUIDANCE: dict[str, dict[str, list[str]]] = {
    "diabetes": {
        "high": [
            "Book an appointment with a doctor soon for a confirmatory test (HbA1c or fasting "
            "plasma glucose).",
            "Seek care promptly if you notice excessive thirst, frequent urination, blurred vision "
            "or unexplained weight loss.",
            "Limit sugary drinks and refined carbohydrates while you wait for testing.",
        ],
        "moderate": [
            "Discuss diabetes screening (HbA1c) with your doctor at your next visit.",
            "Aim for at least 150 minutes of moderate activity per week and a healthy weight.",
            "Prefer whole grains, vegetables and pulses over refined carbohydrates.",
        ],
        "low": [
            "Your inputs suggest a low risk. Keep up regular physical activity and a "
            "balanced diet.",
            "Adults over 35, or with a family history of diabetes, should still be screened "
            "periodically as advised by their doctor.",
        ],
    },
    "heart": {
        "high": [
            "Arrange a prompt review with a physician or cardiologist (ECG, lipid profile and "
            "further tests as they advise).",
            "Call emergency services immediately for chest pain lasting more than a few minutes, "
            "pain spreading to the arm, jaw or back, or sudden breathlessness.",
            "Do not start or stop any heart medication without medical advice.",
        ],
        "moderate": [
            "Discuss your cardiovascular risk with a doctor, including blood pressure and "
            "cholesterol checks.",
            "Stop smoking, limit salt and saturated fat, and stay physically active.",
        ],
        "low": [
            "Your inputs suggest a low risk. Keep blood pressure, cholesterol and weight in the "
            "healthy range with regular check-ups.",
            "Avoid tobacco and stay active (at least 150 minutes of moderate activity per week).",
        ],
    },
    "liver": {
        "high": [
            "Consult a doctor for a full liver function evaluation and possibly an ultrasound.",
            "Avoid alcohol, and do not take paracetamol, herbal or other supplements without "
            "medical advice.",
            "Seek urgent care for yellowing of the eyes with confusion, vomiting blood or "
            "black stools.",
        ],
        "moderate": [
            "Discuss these liver test results with your doctor; repeat testing may be advised.",
            "Limit alcohol and maintain a healthy weight; fatty liver is common and reversible.",
        ],
        "low": [
            "Your inputs suggest a low risk. Limit alcohol and keep a healthy weight to protect "
            "your liver.",
            "Ask your doctor about hepatitis B vaccination if you have not had it.",
        ],
    },
}

# Input values that warrant an urgent warning regardless of the model's output
InputRule = tuple[str, Callable[[float], bool], str]
INPUT_RED_FLAGS: dict[str, list[InputRule]] = {
    "diabetes": [
        ("Glucose", lambda v: v >= 250, "Very high blood glucose (≥ 250 mg/dL)"),
        ("BloodPressure", lambda v: v >= 120, "Very high diastolic blood pressure (≥ 120 mm Hg)"),
    ],
    "heart": [
        ("trestbps", lambda v: v >= 180, "Severely raised blood pressure (≥ 180 mm Hg)"),
        ("oldpeak", lambda v: v >= 4, "Marked ST depression on exercise ECG (≥ 4 mm)"),
    ],
    "liver": [
        ("Total_Bilirubin", lambda v: v >= 10, "Markedly raised bilirubin (≥ 10 mg/dL)"),
        ("Aspartate_Aminotransferase", lambda v: v >= 1000, "Very high AST (≥ 1000 IU/L)"),
        ("Alamine_Aminotransferase", lambda v: v >= 1000, "Very high ALT (≥ 1000 IU/L)"),
    ],
}


def input_red_flags(disease: str, inputs: dict) -> list[str]:
    flags = []
    for feature, test, message in INPUT_RED_FLAGS.get(disease, []):
        value = inputs.get(feature)
        if value is not None and test(float(value)):
            flags.append(f"{message}. {URGENT} if you feel unwell.")
    return flags


def clinical_guidance(disease: str, risk: str) -> list[str]:
    return GUIDANCE[disease][risk]


# --------------------------------------------------------------------------------------------
# Symptom checker: triage by most likely condition
# --------------------------------------------------------------------------------------------

#: Conditions where delay can be dangerous -> high risk / urgent care
SYMPTOM_URGENT = {"Heart attack", "Paralysis (brain haemorrhage)", "Hypoglycemia"}

#: Conditions that need a doctor within a day or two -> moderate risk
SYMPTOM_SEE_DOCTOR = {
    "AIDS",
    "Alcoholic hepatitis",
    "Bronchial Asthma",
    "Chicken pox",
    "Chronic cholestasis",
    "Dengue",
    "Diabetes",
    "Drug Reaction",
    "Gastroenteritis",
    "Hepatitis A",
    "Hepatitis B",
    "Hepatitis C",
    "Hepatitis D",
    "Hepatitis E",
    "Hypertension",
    "Hyperthyroidism",
    "Hypothyroidism",
    "Impetigo",
    "Jaundice",
    "Malaria",
    "Peptic ulcer disease",
    "Pneumonia",
    "Tuberculosis",
    "Typhoid",
    "Urinary tract infection",
}


def symptom_triage(top_condition: str, red_flag_symptoms: list[str]) -> str:
    if red_flag_symptoms or top_condition in SYMPTOM_URGENT:
        return "high"
    if top_condition in SYMPTOM_SEE_DOCTOR:
        return "moderate"
    return "low"


def symptom_guidance(top_condition: str, risk: str) -> list[str]:
    if risk == "high":
        return [
            f"{URGENT}: go to the nearest emergency department or call emergency services.",
            "Do not drive yourself if you feel faint, confused or short of breath.",
        ]
    if risk == "moderate":
        return [
            f"See a doctor within 24-48 hours to check for {top_condition.lower()} and "
            "related conditions.",
            "Rest, drink plenty of fluids, and note when each symptom started to tell the doctor.",
            f"{URGENT} if symptoms suddenly get worse.",
        ]
    return [
        f"Symptoms are most consistent with {top_condition.lower()}, which is usually not urgent.",
        "Book a routine appointment if symptoms persist for more than a week or keep coming back.",
        f"{URGENT} if new severe symptoms appear.",
    ]


def symptom_red_flag_messages(symptoms: list[str], humanize: Callable[[str], str]) -> list[str]:
    return [f"{humanize(s)} reported. {URGENT} immediately." for s in symptoms]
