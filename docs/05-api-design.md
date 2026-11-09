# 5. REST API Design

Base path `/api`. JSON in and out. Authenticated endpoints need `Authorization: Bearer <access token>`.
Interactive Swagger documentation is generated automatically at **`/api/docs`**.

Status: ✅ implemented (41 automated API tests) · ⏳ planned

## Auth
| Method | Path | Roles | Description | Status |
|---|---|---|---|---|
| GET | `/health` | public | API and database status | ✅ |
| POST | `/auth/register` | public | Register a patient account | ✅ |
| POST | `/auth/login` | public | Returns access + refresh tokens (rate-limited) | ✅ |
| POST | `/auth/refresh` | refresh token | New access token | ✅ |
| POST | `/auth/logout` | any | Revoke current token | ✅ |
| GET | `/auth/me` | any | Current user and role | ✅ |

## Patients
| Method | Path | Roles | Description | Status |
|---|---|---|---|---|
| GET / PUT | `/patients/me` | patient | Own profile | ✅ |
| GET | `/patients` | doctor, admin | Patients (doctors see assigned patients only) | ✅ |
| GET | `/patients/{id}` | owner, assigned doctor, admin | Patient detail (clinician access audit-logged) | ✅ |

## Predictions
| Method | Path | Roles | Description | Status |
|---|---|---|---|---|
| GET | `/predictions/modules` | any | Available modules, input schemas, valid ranges, model version | ✅ |
| GET | `/predictions/modules/{disease}` | any | One module (symptom module: 131 symptoms with red-flag markers) | ✅ |
| POST | `/predictions/{disease}` | patient, doctor | Run a prediction (`diabetes`, `heart`, `liver`, `symptom`) | ✅ |
| GET | `/predictions` | any | History (filter by disease, risk, status, date; paginated) | ✅ |
| GET | `/predictions/{id}` | owner, doctor, admin | Prediction detail with explanation and review | ✅ |
| PUT | `/predictions/{id}/review` | assigned doctor | Record or update verdict and notes; sets status to `reviewed` | ✅ |
| POST | `/predictions/{id}/report` | owner, doctor | Generate and download a PDF | ✅ |
| GET | `/reports/{code}` | owner, doctor | Download a previously generated report | ✅ |

### Example: `POST /api/predictions/diabetes` (illustrative values)
```json
{
  "patient_id": 12,
  "inputs": { "Pregnancies": 2, "Glucose": 168, "BloodPressure": 74, "SkinThickness": 30,
              "Insulin": 120, "BMI": 33.1, "DiabetesPedigreeFunction": 0.62, "Age": 47 }
}
```
```json
{
  "id": 431,
  "disease": "diabetes",
  "predicted_label": "Diabetic",
  "probability": 0.82,
  "risk_level": "high",
  "explanation": {
    "reasons": ["Glucose 168 > 154.5 mg/dL", "BMI 33.1 > 29.95", "Age 47 > 28.5 years"],
    "top_features": [{ "feature": "Glucose", "importance": 0.47 }, { "feature": "BMI", "importance": 0.18 }]
  },
  "guidance": ["Consult a physician for an HbA1c or fasting glucose test.", "..."],
  "red_flags": [],
  "model": { "version": "1.0.0", "algorithm": "DecisionTreeClassifier" },
  "status": "pending_review",
  "disclaimer": "Preliminary decision support only, not a medical diagnosis."
}
```

## Dashboard, assistant and admin
| Method | Path | Roles | Description | Status |
|---|---|---|---|---|
| GET | `/dashboard/summary` | any | Totals, risk / disease / status breakdown, 30-day timeline, recent predictions (scoped to the caller) | ✅ |
| GET | `/models` | doctor, admin | Full model cards (metrics, ROC, confusion matrix, comparison) + usage count | ✅ |
| POST | `/assistant/chat` | patient, doctor | Ask about a prediction (grounded, guard-railed) | ⏳ Phase 4 |
| GET / POST | `/admin/users` | admin | List (filter by role, search) and create users | ✅ |
| PATCH | `/admin/users/{id}` | admin | Rename, change role, activate / deactivate (cannot demote yourself) | ✅ |
| PUT | `/admin/patients/{id}/doctor` | admin | Assign (or unassign with `null`) a doctor | ✅ |
| GET | `/admin/audit-logs` | admin | Audit trail (filter by user, action, date) | ✅ |

## Error format
All errors use one shape (flask-smorest default):
```json
{ "code": 422, "status": "Unprocessable Entity", "errors": { "json": { "Glucose": ["Must be between 40 and 300."] } } }
```

## Security design

| Concern | Implementation |
|---|---|
| Passwords | Argon2id hashes; policy of at least 8 characters with a letter and a digit |
| Sessions | JWT access tokens (30 min) + refresh tokens (7 days); role and name in claims |
| Logout | Token ID (`jti`) stored in `revoked_tokens`; every request checks it |
| Deactivation | Deactivated users fail token lookup immediately, even with an unexpired token |
| Authorisation | `roles_required(...)` on every endpoint, plus record-level checks: patients see only their own records, doctors only assigned patients |
| Enumeration | Records outside the caller's scope return **404**, not 403, so IDs cannot be probed |
| Brute force | Login 10/min and registration 5/min per IP (Flask-Limiter) |
| Audit | Logins (incl. failures), registrations, record views, predictions, reviews, reports and admin actions are written to `audit_logs` |
| Input safety | Every clinical value is range-checked against the model's feature specification before reaching the model |
| CORS | Only the configured frontend origin; `Content-Disposition` and `X-Report-Code` exposed for downloads |
