# 3. Database Design

The schema is defined by SQLAlchemy models in [`backend/app/models/`](../backend/app/models) and
versioned with Alembic migrations in [`backend/migrations/`](../backend/migrations). Enum columns
are stored as `VARCHAR` with a `CHECK` constraint so the schema behaves the same on SQLite and MySQL.

## 3.1 Entity-relationship diagram

```mermaid
erDiagram
    users ||--o| patients : "has profile"
    users ||--o{ patients : "is assigned doctor of"
    patients ||--o{ predictions : has
    users ||--o{ predictions : "created"
    model_registry ||--o{ predictions : "produced"
    predictions ||--o| doctor_reviews : "is reviewed by"
    users ||--o{ doctor_reviews : writes
    predictions ||--o{ reports : "exported as"
    users ||--o{ audit_logs : performs
    users ||--o{ chat_messages : sends
    predictions |o--o{ chat_messages : "grounds"

    users {
        int id PK
        string email UK
        string password_hash
        string full_name
        enum role "patient | doctor | admin"
        bool is_active
        datetime last_login_at
        datetime created_at
    }
    patients {
        int id PK
        int user_id FK, UK
        int assigned_doctor_id FK
        date date_of_birth
        enum sex
        string phone
        string blood_group
        float height_cm
        float weight_kg
        text medical_history
        datetime created_at
        datetime updated_at
    }
    model_registry {
        int id PK
        enum disease
        string version
        string algorithm
        string file_path
        json features
        json metrics
        bool is_active
        datetime trained_at
    }
    predictions {
        int id PK
        int patient_id FK
        int created_by_id FK
        int model_version_id FK
        enum disease
        json input_data
        string predicted_label
        float probability
        enum risk_level "low | moderate | high"
        json explanation
        enum status "pending_review | reviewed"
        datetime created_at
    }
    doctor_reviews {
        int id PK
        int prediction_id FK, UK
        int doctor_id FK
        enum verdict "agree | disagree | inconclusive"
        text notes
        datetime created_at
    }
    reports {
        int id PK
        string report_code UK
        int prediction_id FK
        int generated_by_id FK
        string file_path
        datetime created_at
    }
    audit_logs {
        int id PK
        int user_id FK
        string action
        string entity_type
        int entity_id
        string ip_address
        json details
        datetime created_at
    }
    chat_messages {
        int id PK
        int user_id FK
        int prediction_id FK
        enum role "user | assistant"
        text content
        datetime created_at
    }
```

## 3.2 Table descriptions

| Table | Purpose | Notable design decisions |
|---|---|---|
| `users` | One login account per person | Single table plus a `role` column (simple RBAC); `email` unique and indexed; Argon2id hash only, never the password |
| `patients` | Demographic and baseline profile | 1-to-1 with a patient user; `assigned_doctor_id` links to a doctor user; age and BMI are **derived**, not stored |
| `model_registry` | Every trained model version | `UNIQUE(disease, version)`; one `is_active` model per disease; metrics stored as JSON for the model performance page |
| `predictions` | One model run | Inputs stored as JSON because each disease has different features; links to `model_registry` for traceability |
| `doctor_reviews` | Human-in-the-loop verdict | `UNIQUE(prediction_id)`, so at most one review per prediction; saving a review sets `predictions.status = reviewed` |
| `reports` | Generated PDFs | `report_code` is a random public identifier (e.g. `RPT-7F3K9Q2M`) printed on the PDF, so internal IDs are not exposed |
| `audit_logs` | Security and accountability trail | Kept even if the user is deleted (`ON DELETE SET NULL`) |
| `chat_messages` | AI assistant conversation history | Optionally grounded in one prediction |

## 3.3 Normalisation

The schema is in **third normal form**: every non-key attribute depends only on its table's
primary key. The one deliberate exception is `predictions.input_data` (JSON). It is a snapshot of
exactly what the model saw at that moment, so it must not change if the patient's profile is
edited later. This is an audit requirement, not redundancy.

## 3.4 Referential actions

| Relationship | On delete |
|---|---|
| User → patient profile | `CASCADE` (deleting an account deletes its profile) |
| Patient → predictions → reviews / reports | `CASCADE` |
| Doctor / creator / model → prediction, review, report | `SET NULL` (keeps clinical history intact) |
| User → audit log | `SET NULL` (audit trail is never lost) |
