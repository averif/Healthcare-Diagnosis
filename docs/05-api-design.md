# 5. REST API Design

Base path `/api`. JSON in and out. Authenticated endpoints need `Authorization: Bearer <access token>`.
Interactive Swagger documentation is generated automatically at **`/api/docs`**.

Status: ✅ implemented · ⏳ planned (Phase 3–4)

## Auth
| Method | Path | Roles | Description | Status |
|---|---|---|---|---|
| GET | `/health` | public | API and database status | ✅ |
| POST | `/auth/register` | public | Register a patient account | ⏳ |
| POST | `/auth/login` | public | Returns access + refresh tokens (rate-limited) | ⏳ |
| POST | `/auth/refresh` | refresh token | New access token | ⏳ |
| POST | `/auth/logout` | any | Revoke current token | ⏳ |
| GET | `/auth/me` | any | Current user and role | ⏳ |

## Patients
| Method | Path | Roles | Description | Status |
|---|---|---|---|---|
| GET / PUT | `/patients/me` | patient | Own profile | ⏳ |
| GET | `/patients` | doctor, admin | Patients (doctors see assigned patients only) | ⏳ |
| GET | `/patients/{id}` | doctor, admin | Patient detail (audit-logged) | ⏳ |

## Predictions
| Method | Path | Roles | Description | Status |
|---|---|---|---|---|
| GET | `/predictions/modules` | any | Available modules, input schemas, valid ranges, model version | ⏳ |
| POST | `/predictions/{disease}` | patient, doctor | Run a prediction (`diabetes`, `heart`, `liver`, `symptom`) | ⏳ |
| GET | `/predictions` | any | History (filter by disease, risk, status, date; paginated) | ⏳ |
| GET | `/predictions/{id}` | owner, doctor, admin | Prediction detail with explanation and review | ⏳ |
| POST | `/predictions/{id}/review` | doctor | Record verdict and notes | ⏳ |
| POST | `/predictions/{id}/report` | owner, doctor | Generate and download a PDF | ⏳ |
| GET | `/reports/{code}` | owner, doctor | Download a previously generated report | ⏳ |

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
  "model": { "version": "1.0.0", "algorithm": "DecisionTreeClassifier", "recall": 0.78 },
  "status": "pending_review",
  "disclaimer": "Preliminary decision support only, not a medical diagnosis."
}
```

## Dashboard, assistant and admin
| Method | Path | Roles | Description | Status |
|---|---|---|---|---|
| GET | `/dashboard/summary` | doctor, admin | Counts, risk distribution, predictions over time | ⏳ |
| GET | `/models` | doctor, admin | Model registry with metrics (model performance page) | ⏳ |
| POST | `/assistant/chat` | patient, doctor | Ask about a prediction (grounded, guard-railed) | ⏳ |
| GET / POST / PATCH | `/admin/users` | admin | List, create, activate / deactivate users and change roles | ⏳ |
| PATCH | `/admin/patients/{id}/doctor` | admin | Assign a doctor | ⏳ |
| GET | `/admin/audit-logs` | admin | Audit trail (filter by user, action, date) | ⏳ |

## Error format
All errors use one shape (flask-smorest default):
```json
{ "code": 422, "status": "Unprocessable Entity", "errors": { "json": { "Glucose": ["Must be between 40 and 300."] } } }
```
