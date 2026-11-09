# 1. Software Requirements Specification

**Project:** AI-Powered Healthcare Diagnosis and Clinical Decision Support System ("MediAssist CDSS")
**Team:** Zibran Hasan Khan, Tanvir Husain, Yasir Khan, supervised by Ms. Saman Khan, Integral University Lucknow

## 1.1 Purpose

MediAssist is a web-based clinical decision support prototype. It takes patient information, clinical
parameters and symptoms, then gives **preliminary, explainable** predictions for Diabetes, Heart
Disease, Liver Disease and general symptom-based conditions. It supports qualified healthcare
professionals and does **not** replace them.

## 1.2 User roles

| Role | Description | Key capabilities |
|---|---|---|
| **Patient** | Registers to get preliminary assessments | Manage own profile, run predictions, view own history, download reports, ask the AI assistant |
| **Doctor** | Clinician who reviews AI output | View assigned patients, review predictions (agree / disagree / inconclusive + notes), run predictions for a patient, view dashboard analytics |
| **Admin** | Operates the system | Manage users and roles, assign doctors to patients, view audit log, view model performance and system statistics |

> The synopsis lists a combined "Doctor/Admin" role. It is split in two so clinical permissions
> (seeing patient data) are kept apart from system administration (least privilege).

## 1.3 Functional requirements

| ID | Requirement | Roles | Priority |
|---|---|---|---|
| FR-01 | Users can register (patient) and log in with email + password | All | Must |
| FR-02 | Sessions use short-lived JWT access tokens and refresh tokens; logout revokes the token | All | Must |
| FR-03 | Admin can create doctor accounts, deactivate users and change roles | Admin | Must |
| FR-04 | Patient can create and update a profile (DOB, sex, height, weight, blood group, history) | Patient | Must |
| FR-05 | Diabetes prediction from 8 clinical parameters | Patient, Doctor | Must |
| FR-06 | Heart disease prediction from 13 clinical parameters | Patient, Doctor | Must |
| FR-07 | Liver disease prediction from 10 laboratory parameters | Patient, Doctor | Must |
| FR-08 | Symptom-based prediction from a searchable list of 131 symptoms (top-3 conditions) | Patient, Doctor | Must |
| FR-09 | Each prediction returns label, probability, risk band (low / moderate / high) and a plain-English explanation of the decision path | Patient, Doctor | Must |
| FR-10 | Each prediction returns general guidance and red-flag warnings (e.g. "seek emergency care") | Patient, Doctor | Must |
| FR-11 | Every prediction is saved with its inputs and the model version used | System | Must |
| FR-12 | Patients can view and filter their prediction history and trends | Patient | Must |
| FR-13 | A PDF report with a unique report code can be downloaded for any prediction | Patient, Doctor | Must |
| FR-14 | Doctors can review a prediction and record a verdict and notes; the patient sees the review | Doctor | Must |
| FR-15 | Doctor dashboard: assigned patients, pending reviews queue, risk distribution charts | Doctor | Must |
| FR-16 | Admin dashboard: user counts, predictions per disease and over time, audit log | Admin | Must |
| FR-17 | Model performance page: metrics, confusion matrix, ROC curve, feature importance per model | Doctor, Admin | Should |
| FR-18 | AI clinical assistant answers questions about a specific prediction in plain language, with safety guardrails | Patient, Doctor | Should |
| FR-19 | Sensitive actions (viewing a patient record, review, role change) are written to an audit log | System | Must |

## 1.4 Non-functional requirements

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Security | Passwords hashed with Argon2id; JWT secrets come from environment variables; no secrets in Git |
| NFR-02 | Security | Role-based access control on every endpoint; patients can only access their own records |
| NFR-03 | Security | Login and registration are rate-limited (brute-force protection) |
| NFR-04 | Validation | All inputs are validated on the client (Zod) **and** the server (marshmallow) against clinically plausible ranges |
| NFR-05 | Performance | A prediction completes in under 500 ms on a standard laptop (models load once at startup) |
| NFR-06 | Explainability | Every prediction exposes the reasons behind it; no "black box" output |
| NFR-07 | Traceability | Each stored prediction references the exact model version and its metrics |
| NFR-08 | Usability | Responsive UI (mobile to desktop), keyboard accessible, WCAG AA colour contrast |
| NFR-09 | Safety | A medical disclaimer is visible on every page, result and report |
| NFR-10 | Portability | Runs on SQLite (development) or MySQL (deployment) with no code changes; starts with `docker compose up` |
| NFR-11 | Maintainability | Automated tests run in CI on every push; backend coverage target ≥ 80 % |
| NFR-12 | Reproducibility | Datasets are fetched by script and checked against SHA-256 checksums; training is scripted with fixed random seeds |

## 1.5 Constraints and assumptions

- Software-only prototype; no medical devices or real hospital integration (no HL7/FHIR).
- Models are trained on public research datasets. They may not generalise to every population,
  which is stated in the model cards and the final report.
- Decision Tree classifiers are the primary algorithm, as specified in the synopsis. Other
  algorithms are trained only as comparison baselines.
- The AI assistant is optional at runtime. Without an API key, a rule-based fallback is used.

## 1.6 Out of scope

Real patient data, clinical certification (e.g. CE / FDA), prescriptions or treatment plans,
telemedicine, payments, and native mobile apps.
