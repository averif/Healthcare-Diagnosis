# 2. System Architecture

> Diagrams are written in [Mermaid](https://mermaid.js.org) and render automatically on GitHub and
> in VS Code (Markdown Preview Mermaid Support extension). Export them to PNG for the final report
> with <https://mermaid.live>.

## 2.1 Layered architecture

```mermaid
flowchart TB
    subgraph Client["Presentation layer: React + TypeScript (Vite)"]
        UI["Pages: Auth · Profile · Predict · Results · History · Dashboards · Assistant"]
        RQ["TanStack Query (server state) + React Hook Form / Zod (validation)"]
    end

    subgraph API["Application layer: Flask REST API"]
        AUTH["Auth & RBAC (JWT, Argon2)"]
        VAL["Request validation (marshmallow) + OpenAPI docs"]
        SVC["Services: patients · predictions · reviews · reports · dashboard · audit"]
        ASSIST["AI clinical assistant (guard-railed LLM / rules fallback)"]
    end

    subgraph ML["ML layer: scikit-learn"]
        REG["Model registry (loads active models at startup)"]
        DT["Decision Tree pipelines: diabetes · heart · liver
Random Forest: symptoms"]
        XAI["Explainer: decision path → plain-English reasons"]
    end

    subgraph Data["Data layer"]
        DB[("SQLite / MySQL via SQLAlchemy")]
        FILES[["PDF reports · .joblib models"]]
    end

    UI --> RQ -->|"HTTPS JSON /api/*"| AUTH --> VAL --> SVC
    SVC --> REG --> DT --> XAI
    SVC --> ASSIST
    SVC --> DB
    SVC --> FILES
    REG --> FILES
    ASSIST -.->|"optional"| LLM(["Claude / Gemini API"])
```

## 2.2 Data-flow diagram: Level 0 (context)

```mermaid
flowchart LR
    P([Patient]) -->|"profile, parameters, symptoms"| S((MediAssist CDSS))
    S -->|"prediction, risk, explanation, report"| P
    D([Doctor]) -->|"review verdict, notes"| S
    S -->|"patient records, review queue, analytics"| D
    A([Admin]) -->|"user and role management"| S
    S -->|"statistics, audit log, model metrics"| A
    S <-.->|"grounded question / answer"| L([LLM provider])
```

## 2.3 Data-flow diagram: Level 1 (prediction)

```mermaid
flowchart LR
    IN[/"Clinical inputs or symptoms"/] --> P1["1.0 Validate input\n(types, clinical ranges)"]
    P1 --> P2["2.0 Preprocess\n(impute, encode, order features)"]
    P2 --> P3["3.0 Decision Tree\npredict + predict_proba"]
    P3 --> P4["4.0 Risk banding\n(low / moderate / high)"]
    P3 --> P5["5.0 Explain\n(decision path, feature importance)"]
    P4 --> P6["6.0 Guidance\n(general advice, red flags)"]
    P5 --> P6
    P6 --> D1[("D1 predictions")]
    P6 --> OUT[/"Result card"/]
    D1 --> P7["7.0 Report generation"] --> D2[["D2 PDF reports"]]
    D1 --> P8["8.0 Doctor review"] --> D3[("D3 doctor_reviews")]
    MR[("D4 model_registry")] --> P3
```

## 2.4 Use-case diagram

```mermaid
flowchart LR
    Patient([Patient])
    Doctor([Doctor])
    Admin([Admin])

    subgraph System["MediAssist CDSS"]
        UC1(Register / Log in)
        UC2(Manage profile)
        UC3(Run disease prediction)
        UC4(Check symptoms)
        UC5(View history and trends)
        UC6(Download PDF report)
        UC7(Ask AI assistant)
        UC8(Review prediction)
        UC9(View doctor dashboard)
        UC10(Manage users and roles)
        UC11(View audit log)
        UC12(View model performance)
    end

    Patient --- UC1 & UC2 & UC3 & UC4 & UC5 & UC6 & UC7
    Doctor --- UC1 & UC3 & UC5 & UC6 & UC7 & UC8 & UC9 & UC12
    Admin --- UC1 & UC10 & UC11 & UC12
```

## 2.5 Sequence: running a prediction

```mermaid
sequenceDiagram
    autonumber
    actor U as Patient
    participant FE as React app
    participant API as Flask API
    participant ML as Prediction service
    participant DB as Database

    U->>FE: Fill diabetes form, click Predict
    FE->>FE: Zod validation (ranges, required fields)
    FE->>API: POST /api/predictions/diabetes (JWT)
    API->>API: Verify JWT and role, validate schema
    API->>ML: predict(features)
    ML->>ML: Pipeline.transform → tree.predict_proba
    ML->>ML: Extract decision path → reasons
    ML-->>API: label, probability, risk, explanation
    API->>DB: INSERT prediction (+ model_version_id)
    API->>DB: INSERT audit_log
    API-->>FE: 201 Created + result JSON
    FE-->>U: Result card, risk gauge, reasons, guidance
    U->>FE: Download report
    FE->>API: POST /api/predictions/{id}/report
    API-->>FE: PDF file (report code RPT-XXXXXXXX)
```

## 2.6 Main user workflows

**Patient:** Register / Login → Complete profile → Choose module → Enter parameters or symptoms →
Result (probability, risk, reasons) → Guidance → Saved to history → Download report →
(Optional) Ask assistant → See the doctor's review when available.

**Doctor:** Login → Dashboard (pending reviews, risk distribution) → Open patient →
Inspect prediction and explanation → Record verdict and notes → Patient is notified on their history page.

**Admin:** Login → Dashboard (users, predictions over time) → Manage users / assign doctors →
Audit log → Model performance.

## 2.7 Repository layout

```
Healthcare Diagnosis/
├── frontend/          React + TypeScript (Vite, Tailwind CSS)
├── backend/           Flask API (app factory, SQLAlchemy models, Alembic migrations, pytest)
├── ml/                Datasets, notebooks, training pipeline, trained models and model cards
├── docs/              Requirements, architecture, database, datasets, API design
└── .github/workflows/ Continuous integration
```

## 2.8 Technology choices

| Concern | Choice | Reason |
|---|---|---|
| Frontend | React 19 + TypeScript + Vite | Type safety catches bugs early; Vite gives instant reloads |
| Styling | Tailwind CSS 4 | Consistent design tokens, fast to build responsive layouts |
| Server state | TanStack Query | Caching, loading and error states without hand-written boilerplate |
| Forms | React Hook Form + Zod | The same validation rules give instant feedback in the browser |
| Charts | Recharts | Declarative React charts for dashboards and metrics |
| API | Flask 3 + flask-smorest | Lightweight; generates OpenAPI / Swagger documentation from schemas |
| ORM / migrations | SQLAlchemy 2 + Alembic | One code base for SQLite and MySQL; versioned schema changes |
| Auth | Flask-JWT-Extended + Argon2id | Stateless tokens for a SPA; Argon2 is the recommended modern password hash |
| ML | scikit-learn Decision Tree in a `Pipeline` (Random Forest for the symptom module) | Interpretable by design; preprocessing and model saved together. See [06-model-evaluation.md](06-model-evaluation.md) for the symptom-module rationale |
| Reports | ReportLab | Pure-Python PDF generation that works on Windows without extra system libraries |
| Testing | pytest, Vitest, React Testing Library, Playwright | Unit, integration and end-to-end coverage |
| CI | GitHub Actions | Lint, type-check and test on every push |
