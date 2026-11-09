# AI-Powered Healthcare Diagnosis and Clinical Decision Support System

**Project report (draft)** · B.Tech Computer Science & Engineering · Integral University, Lucknow · 2026–27

**Submitted by:** Zibran Hasan Khan (2300100849), Tanvir Husain (2300100589), Yasir Khan (2300101259)
**Supervisor:** Ms. Saman Khan

> **Editing notes for the team** (delete before submission)
> - Numbers below are from the committed models (`ml/reports/summary.md`). If you retrain, update §9.
> - Insert screenshots where marked **[Figure: …]**. All other figures already exist under
>   `ml/reports/` and `docs/` (export Mermaid diagrams at <https://mermaid.live>).
> - Fill §9.4 with your UAT results (use `docs/uat-record-sheet.md`).
> - **Verify every reference in §References** against the original source before submitting.

---

## Abstract

Clinical decision support systems (CDSS) can help clinicians and patients interpret health data,
but many machine-learning prototypes are black boxes, are evaluated on leaky data, and stop at a
"Yes/No" output. This project presents **MediAssist**, a web-based CDSS that gives preliminary,
**explainable** predictions for diabetes, heart disease and liver disease from clinical
measurements, and for 41 common conditions from reported symptoms.

The system uses scikit-learn **Decision Tree** classifiers tuned with grid search and the CART
one-standard-error rule, and a Random Forest for the high-dimensional symptom module. Models are
evaluated with **nested cross-validation** against Logistic Regression, Random Forest and
majority-class baselines. Every prediction is explained by decomposing the tree's decision path
into per-feature contributions that add up exactly to the predicted probability.

A Flask REST API and a React (TypeScript) application add role-based access for patients, doctors
and administrators, doctor review of every prediction (human in the loop), PDF reports, dashboards,
an audit trail and an AI clinical assistant with safety guardrails. On held-out data the Decision
Trees reach a balanced accuracy of 0.74 (diabetes), 0.79 (heart) and 0.67 (liver) under nested
cross-validation, within one standard deviation of black-box models while remaining fully
interpretable.

The work also documents data-quality problems that commonly inflate published results. For
example, 41 of the 42 "test" rows of a widely used symptom dataset are copies of training rows.
The system is supported by 103 automated tests and continuous integration.

---

## 1. Introduction

### 1.1 Background

Artificial intelligence is increasingly used to analyse patient information and support clinical
decisions. A CDSS organises information and offers recommendations, but it supports, rather than
replaces, qualified professionals (Sutton et al., 2020). Machine-learning models can learn
patterns from structured clinical datasets and produce preliminary risk estimates when the
relevant features are supplied.

### 1.2 Motivation

Student and research prototypes typically:

1. demonstrate **one disease per application**, fragmenting the workflow;
2. present a bare prediction **without reasons**, which clinicians cannot verify (Rudin, 2019);
3. report accuracy measured on data that **leaks** between training and testing; and
4. have no notion of users, history, review or reporting.

MediAssist addresses each of these in one integrated, explainable and tested system.

## 2. Problem Statement

Develop a web-based AI healthcare system that accepts patient information, clinical parameters
and symptoms, and produces preliminary, explained predictions for multiple diseases with
probability and risk information. It must store prediction history, support review by doctors,
generate downloadable reports and give general guidance, while making clear that its output is
not a diagnosis.

Current solutions are limited by fragmented single-disease tools, unexplained outputs, no history
or reporting, and evaluation practices that overstate accuracy.

## 3. Objectives

| Objective (from synopsis) | Status | Where |
|---|---|---|
| Web-based application for preliminary multi-disease prediction | ✅ 4 modules | Ch. 8 |
| Decision Tree models on suitable healthcare datasets | ✅ tuned, explained, compared | Ch. 6, 9 |
| Patient registration and login | ✅ JWT, Argon2, rate limiting | §7.4 |
| Prediction history linked to the patient | ✅ filterable history | §8.3 |
| Risk / probability information and general recommendations | ✅ risk bands, guidance, red flags | §6.6 |
| Doctor / admin dashboard and downloadable reports | ✅ role-specific dashboards, PDF | §8.3 |
| AI clinical assistant | ✅ grounded, guard-railed | §8.4 |
| **Beyond the synopsis** | Explainable contributions, doctor review workflow, model performance page, audit log, nested CV, E2E tests, Docker | — |

## 4. Scope

**Included:** registration and login; patient profile; clinical and symptom input; multi-disease
prediction with probability, risk and explanation; guidance and red-flag warnings; history; doctor
review; doctor and admin dashboards; PDF reports; audit log; AI assistant; ML training and
evaluation; Flask API; React frontend; database; automated testing; containerised deployment.

**Excluded:** real patient data, clinical certification, prescriptions or treatment plans,
integration with hospital systems (HL7/FHIR), telemedicine, payments and native mobile apps.

## 5. Literature Review

**Decision trees in medicine.** CART (Breiman et al., 1984) builds binary trees by recursive
partitioning. Their rule-like structure is close to clinical reasoning ("if glucose > 140 and BMI
> 30 …"), and cost-complexity pruning and the one-standard-error rule favour small, generalisable
trees.

**Benchmark datasets.** The Pima Indians Diabetes data (Smith et al., 1988), the Cleveland heart
disease data (Detrano et al., 1989) and the Indian Liver Patient Dataset (UCI) are standard
benchmarks. Published accuracies vary widely, partly because of inconsistent handling of
missing values and duplicates.

**Evaluation bias.** Choosing hyperparameters with the same cross-validation used to report
performance biases the estimate upwards. Nested cross-validation avoids this (Varma & Simon,
2006).

**Interpretability.** Post-hoc explainers such as SHAP (Lundberg & Lee, 2017) approximate black
boxes. Rudin (2019) argues that high-stakes decisions should use inherently interpretable models.
For trees, the change in node values along the decision path gives an *exact* additive
attribution (the "tree interpreter" decomposition, Saabas, 2014), which this project adopts.

**CDSS and ethics.** CDSS must support clinicians, show their reasoning and keep a human in the
loop (Sutton et al., 2020; WHO, 2021). These principles shaped the review workflow, disclaimers and
assistant guardrails.

## 6. Methodology

### 6.1 Datasets

| Module | Dataset | Raw rows | Rows used | Features | Target |
|---|---|---:|---:|---:|---|
| Diabetes | Pima Indians Diabetes | 768 | 768 | 8 | Diabetes within 5 years |
| Heart | UCI Cleveland | 303 | 303 | 13 | Angiographic disease (num > 0) |
| Liver | ILPD | 583 | 570 | 10 | Liver patient |
| Symptoms | Kaggle symptom–disease | 4,962 | 305 | 131 | 41 diseases |

All files are downloaded by a script and verified against SHA-256 checksums, so the results are
reproducible.

### 6.2 Data-quality findings and cleaning

| Dataset | Finding | Treatment |
|---|---|---|
| Pima | Zeros used for "not measured": insulin 48.7 %, skin thickness 29.6 % | Converted to missing; median-imputed inside each training fold |
| Cleveland | 6 missing values; 0–4 severity target; nominal codes | Imputed; binarised; one-hot encoded |
| ILPD | 13 exact duplicates; inverted label coding; 71 % positive, 76 % male | Duplicates removed before splitting; labels remapped; limitations recorded |
| Symptoms | Only 305 unique rows out of 4,920; **41 of 42 test rows also appear in training**; typos | De-duplicated; cross-validated on unique rows; robustness test |

**[Figure: `ml/notebooks/04_symptoms_eda.ipynb` disease × symptom heatmap]**

### 6.3 Pipeline and model selection

Each model is a scikit-learn `Pipeline`: imputation → one-hot encoding → classifier. This
prevents leakage and lets the saved model accept raw input. Data is split 80/20, stratified, with
seed 42.

`GridSearchCV` (5-fold stratified) searches 336 Decision Tree configurations: depth, minimum leaf
size, gini or entropy, cost-complexity α and class weights. Selection uses **balanced accuracy**,
because F1 rewarded a useless "always positive" model on the liver data (§9.3). The **one
standard-error rule** then picks the shallowest tree whose score is within one standard error of
the best.

Selected trees:

| Module | Depth | Leaves | Criterion | Min leaf | Class weight |
|---|---:|---:|---|---:|---|
| Diabetes | 5 | 19 | gini | 20 | balanced |
| Heart | 3 | 8 | gini | 10 | balanced |
| Liver | 4 | 11 | entropy | 20 | balanced |

### 6.4 Evaluation protocol

- **Hold-out test set** (20 %): accuracy, balanced accuracy, recall (sensitivity), specificity,
  F1, ROC AUC, confusion matrix and ROC curve.
- **Nested cross-validation** (5 outer folds × 2 repeats; tuning repeated inside every outer
  fold) for Decision Tree, Logistic Regression, Random Forest and a majority-class baseline.
- **Symptom robustness:** hide 1–3 reported symptoms per unseen patient and measure top-1 and
  top-3 accuracy.

### 6.5 Explanation method

For a patient with input x, follow the root-to-leaf path. Let p(n) be the predicted class's
proportion at node n. Each split from parent n to child c contributes p(c) − p(n) to the feature
tested at n. Summing over the path gives:

  p(leaf) = p(root) + Σ contributions

This identity is exact, not an approximation. For a Random Forest the per-tree contributions are
averaged, and the identity still holds because the forest's probability is the mean of its
trees. Numeric splits are merged into readable ranges ("glucose is 168 mg/dL, above 154.5"), and
one-hot splits become categories ("chest pain type is asymptomatic").

### 6.6 Risk bands and guidance

- Probability < 0.35: **low**; 0.35–0.65: **moderate**; ≥ 0.65: **high**.
- Guidance is general and per band, and never prescribes treatment.
- Input red flags (e.g. resting blood pressure ≥ 180 mm Hg) and red-flag symptoms (chest pain,
  breathlessness, …) trigger urgent-care warnings whatever the model's output.
- Symptom results are triaged by condition: urgent, see a doctor, or routine.

## 7. System Design

### 7.1 Architecture

A layered architecture: React presentation layer → Flask REST API (auth, validation, services) →
ML layer (`medml` package: pipelines, explainer, model registry) → data layer (SQLite / MySQL via
SQLAlchemy, PDF files).

**[Figure: architecture diagram, `docs/02-architecture.md` §2.1]**
**[Figure: DFD level 0 and level 1, §2.2–2.3]** **[Figure: use-case diagram, §2.4]**
**[Figure: prediction sequence diagram, §2.5]**

### 7.2 Database

Nine tables: users, patients, predictions, doctor_reviews, reports, model_registry, audit_logs,
chat_messages and revoked_tokens. The schema is in third normal form, apart from a deliberate JSON
snapshot of each prediction's inputs (needed for the audit trail). Versioned Alembic migrations
run unchanged on SQLite and MySQL.

**[Figure: ER diagram, `docs/03-database-design.md`]**

### 7.3 API

There are 28 REST endpoints under `/api`, documented automatically with OpenAPI/Swagger at
`/api/docs` (see `docs/05-api-design.md`).

### 7.4 Security design

- Passwords hashed with Argon2id.
- Access tokens (30 min) and refresh tokens (7 days), revoked on logout.
- Role checks on every endpoint, plus record-level rules: patients see only their own records and
  doctors only their assigned patients. Records outside a user's scope return 404 to prevent ID
  probing.
- Login and registration are rate-limited.
- Every sensitive action is written to the audit log.
- In production the app refuses weak secrets.
- nginx adds security headers (CSP, `X-Frame-Options`, `nosniff`).
- Dependencies are scanned for known vulnerabilities in CI.

## 8. Implementation

### 8.1 Technology stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, TanStack Query, React Hook Form + Zod, Recharts |
| Backend | Python 3, Flask 3, flask-smorest, SQLAlchemy 2, Alembic, Flask-JWT-Extended, Argon2, ReportLab |
| ML | scikit-learn, pandas, NumPy, joblib, Jupyter, Matplotlib, Seaborn |
| Assistant | Anthropic Python SDK (optional) with an offline rule-based fallback |
| Data | SQLite (development), MySQL 8 (deployment) |
| Quality | pytest, Vitest, React Testing Library, Playwright, Ruff, oxlint, Prettier, GitHub Actions |
| Deployment | Docker, Docker Compose, gunicorn, nginx |

Code size, excluding blank lines: backend about 2,400 lines, ML package about 1,370, frontend about
4,400, and tests about 1,200.

### 8.2 ML package (`medml`)

The package covers:

- feature specifications: labels, units, valid ranges and codes. These are shared by training,
  API validation and the generated frontend forms;
- data loaders with cleaning logs;
- training and evaluation;
- the explainer;
- `ModelBundle` for inference, with input validation.

Each trained model ships with a JSON **model card** (data provenance, hyperparameters, metrics,
ROC and confusion matrix, comparison, limitations).

### 8.3 Application features by role

| Role | Features |
|---|---|
| Patient | **[Figures: assessment form, result page, history, PDF report]** |
| Doctor | **[Figures: review queue, review panel, model performance]** |
| Admin | **[Figures: dashboard, users, audit log]** |

### 8.4 AI clinical assistant

- Messages that suggest an emergency are answered with a fixed urgent-care response and never
  reach the model.
- Other questions go to Claude (if configured), grounded only in the stored prediction, with a
  system prompt that forbids diagnosis and dosing.
- On a refusal or API failure, a deterministic rules engine answers from the same data.

## 9. Testing and Results

### 9.1 Model performance: hold-out test set

| Module | Model | Accuracy | Balanced acc. | Recall | Specificity | F1 | ROC AUC |
|---|---|---:|---:|---:|---:|---:|---:|
| Diabetes | Decision Tree | 0.747 | 0.720 | 0.630 | 0.810 | 0.635 | 0.799 |
| Heart | Decision Tree | 0.869 | 0.868 | 0.857 | 0.879 | 0.857 | 0.871 |
| Liver | Decision Tree | 0.684 | 0.706 | 0.654 | 0.758 | 0.747 | 0.740 |
| Symptoms | Random Forest | 1.000 | — | — | — | 1.000 (macro) | — |

**[Figures: confusion matrices and ROC curves, `ml/reports/*/`]**

### 9.2 Algorithm comparison: nested cross-validation (mean ± sd)

| Module (metric) | Decision Tree | Logistic Regression | Random Forest | Majority |
|---|---|---|---|---|
| Diabetes (balanced acc.) | 0.738 ± 0.042 | 0.745 ± 0.031 | 0.766 ± 0.037 | 0.500 |
| Diabetes (recall) | 0.778 ± 0.088 | 0.720 ± 0.048 | 0.776 ± 0.034 | 0.000 |
| Heart (balanced acc.) | 0.789 ± 0.058 | 0.831 ± 0.035 | 0.831 ± 0.039 | 0.500 |
| Liver (balanced acc.) | 0.668 ± 0.014 | 0.693 ± 0.035 | 0.682 ± 0.033 | 0.500 |
| Symptoms (macro F1) | 0.524 ± 0.047 | 0.994 ± 0.013 | 1.000 ± 0.000 | 0.002 |

On the clinical datasets the interpretable tree is within 2.5–4.2 points of the best black-box
model, and every gap is within one standard deviation. For diabetes screening it ties Random
Forest for the highest recall.

### 9.3 Why metric choice matters

On the liver data the majority-class model scores 0.712 accuracy and 0.832 F1, higher than every
real model, yet its balanced accuracy is 0.500. Reporting accuracy or F1 alone would have favoured
a useless model.

### 9.4 Symptom robustness

| Algorithm | 0 symptoms hidden | 1 hidden | 2 hidden | 3 hidden |
|---|---|---|---|---|
| Decision Tree (top-1 / top-3) | 0.61 / 0.61 | 0.54 / 0.56 | 0.45 / 0.49 | 0.40 / 0.44 |
| Random Forest (deployed) | 1.00 / 1.00 | 1.00 / 1.00 | 0.97 / 1.00 | 0.94 / 0.99 |

A single tree generalises poorly on 131 sparse binary features with 5–10 examples per disease.
The forest, which is still decision-tree based, is therefore used for this module.

### 9.5 Software testing

| Level | Tests | Result |
|---|---:|---|
| ML unit tests | 31 | all pass |
| API unit and integration tests | 51 | all pass, 97 % line coverage |
| Frontend unit tests | 10 | all pass |
| End-to-end browser tests (Playwright) | 11 | all pass |
| Dependency vulnerability scan | — | no known vulnerabilities |

Ten defects found by testing were fixed (see `docs/08-testing.md` §8.5).

### 9.6 User acceptance testing

**[Fill in: participants, completion rate per scenario U1–U8, mean questionnaire scores, main
feedback and resulting changes.]**

## 10. Discussion and Limitations

- **Data:** the datasets are small, old and from narrow populations (e.g. Pima women only; one US
  clinic for heart disease). The models must not be assumed to generalise to Indian patients.
- **Symptom data:** the dataset is template-like (305 unique patterns), so near-perfect scores do
  not indicate real-world diagnostic accuracy.
- **Liver:** performance is modest (balanced accuracy about 0.67), in line with the literature on
  this dataset.
- **Calibration:** the probabilities are leaf proportions from class-weighted trees. They rank
  risk well but are not calibrated clinical probabilities.
- **Prototype status:** no clinical validation, regulatory approval or DPDP-Act compliance review.

## 11. Conclusion and Future Scope

MediAssist meets every objective in the synopsis and adds:

- explanations that add up exactly to each prediction;
- a doctor review workflow;
- transparent model cards;
- rigorous evaluation;
- comprehensive automated testing.

The project shows that an interpretable model, evaluated honestly, can come close to black-box
performance while giving clinicians reasons they can check.

**Future work:**

- probability calibration (isotonic or Platt scaling);
- training on larger and more recent Indian datasets;
- federated learning across hospitals;
- FHIR integration with hospital records;
- multilingual (Hindi) interface and assistant;
- monitoring of model drift.

## 12. Impact

- One interface for multiple screening tasks.
- Patients get understandable, explained results and a record they can share with their doctor.
- Doctors get a triaged review queue.
- Administrators get accountability through the audit log.

## 13–16. Timeline, Project Plan, Resources and Budget

| Phase | Weeks | Delivered |
|---|---|---|
| 1. Requirements and design | 1–2 | SRS, architecture, DFDs, ER, datasets |
| 2. ML development | 3–5 | Cleaning, tuning, nested CV, explainer, model cards |
| 3. Backend | 6–7 | 28-endpoint secured API, PDF reports, audit |
| 4. Frontend and assistant | 8–9 | React application, dashboards, assistant |
| 5. Testing, deployment, documentation | 10–12 | E2E tests, Docker, CI, documentation |

The budget is as in the synopsis: about ₹2,000–2,500 for miscellaneous costs. All software is
open source. The optional Claude API costs a few rupees per demo session.

## References

> Verify each entry against the original publication before submission.

1. Breiman, L., Friedman, J., Olshen, R., & Stone, C. (1984). *Classification and Regression
   Trees.* Wadsworth.
2. Smith, J. W., Everhart, J. E., Dickson, W. C., Knowler, W. C., & Johannes, R. S. (1988). Using
   the ADAP learning algorithm to forecast the onset of diabetes mellitus. *Proceedings of the
   Annual Symposium on Computer Application in Medical Care*, 261–265.
3. Detrano, R., et al. (1989). International application of a new probability algorithm for the
   diagnosis of coronary artery disease. *American Journal of Cardiology*, 64(5), 304–310.
4. Ramana, B. V., & Venkateswarlu, N. B. (2012). ILPD (Indian Liver Patient Dataset). UCI Machine
   Learning Repository. https://doi.org/10.24432/C5D02C
5. Janosi, A., Steinbrunn, W., Pfisterer, M., & Detrano, R. (1988). Heart Disease. UCI Machine
   Learning Repository. https://doi.org/10.24432/C52P4X
6. Pedregosa, F., et al. (2011). Scikit-learn: Machine learning in Python. *Journal of Machine
   Learning Research*, 12, 2825–2830.
7. Varma, S., & Simon, R. (2006). Bias in error estimation when using cross-validation for model
   selection. *BMC Bioinformatics*, 7, 91.
8. Lundberg, S. M., & Lee, S.-I. (2017). A unified approach to interpreting model predictions.
   *Advances in Neural Information Processing Systems*, 30.
9. Saabas, A. (2014). Interpreting random forests. Blog post, *Diving into data*.
10. Rudin, C. (2019). Stop explaining black box machine learning models for high stakes decisions
    and use interpretable models instead. *Nature Machine Intelligence*, 1, 206–215.
11. Sutton, R. T., et al. (2020). An overview of clinical decision support systems: benefits,
    risks, and strategies for success. *npj Digital Medicine*, 3, 17.
12. World Health Organization. (2021). *Ethics and governance of artificial intelligence for
    health.* WHO.

## Appendices

- **A.** Requirements specification: `docs/01-requirements.md`
- **B.** Architecture and diagrams: `docs/02-architecture.md`
- **C.** Database design: `docs/03-database-design.md`
- **D.** Data dictionary and data-quality findings: `docs/04-datasets.md`
- **E.** API reference: `docs/05-api-design.md` and Swagger `/api/docs`
- **F.** Model evaluation: `docs/06-model-evaluation.md`, `ml/reports/`
- **G.** Testing and UAT forms: `docs/08-testing.md`, `docs/uat-record-sheet.md`
- **H.** Deployment: `docs/09-deployment.md`
- **I.** User manual: `docs/10-user-manual.md`
- **J.** Exploratory analysis notebooks: `ml/notebooks/`
