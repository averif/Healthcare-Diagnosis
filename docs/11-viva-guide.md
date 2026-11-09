# 11. Viva Guide: demo script, slides and likely questions

## 11.1 Before the viva (checklist)

- [ ] Fresh database: delete `backend/instance/healthcare.db`, then `flask db upgrade && flask seed --demo`
- [ ] `frontend/.env.local` contains `VITE_DEMO_PASSWORD=<same as DEMO_PASSWORD>` so the
      demo-account buttons fill the password
- [ ] Both servers running (`flask run`, `npm run dev`), or `docker compose up`
- [ ] Browser zoom 110–125 % for the projector; close other tabs
- [ ] Backup: a screen recording of the demo (in case of Wi-Fi or laptop problems)
- [ ] Optional: `ANTHROPIC_API_KEY` set (assistant shows "Claude AI"); test it once beforehand
- [ ] Open in tabs: Swagger `/api/docs`, `ml/reports/summary.md`, `ml/notebooks/04_symptoms_eda.ipynb`

## 11.2 Seven-minute demo script

| Time | Who | Show | Say (key point) |
|---|---|---|---|
| 0:00 | A | Landing page | "One system, four modules, explainable, doctor in the loop." |
| 0:30 | A | Sign in as **patient** → New assessment → Diabetes → type glucose **900** | "The browser enforces the same clinical ranges as the server; they come from one specification." |
| 1:00 | A | **Fill example** → Get assessment | "Not just 'Diabetic': the bars show *why*. Baseline 50 % plus each factor gives exactly 86 %. These are exact, not approximations like SHAP." |
| 2:00 | A | Assistant: "Why is my risk this level?", then "What dose of metformin?" | "Grounded in this result; it refuses dosing." Then type "chest pain right now": "Emergencies bypass the AI." |
| 2:45 | A | Download PDF report | "Unique report code, QR, factors, guidance, doctor review, disclaimer." |
| 3:15 | B | Symptom checker: fever, cough, breathlessness | "Red-flag warning before submitting; urgent triage; three possible conditions." |
| 3:45 | B | Sign in as **doctor** → review queue → open → Agree + notes | "Human in the loop: the patient sees the doctor's verdict." |
| 4:30 | B | **Model performance** → Liver tab → comparison table | "The 'always say disease' baseline wins on accuracy and F1 but scores 0.5 on balanced accuracy. That is why we select on balanced accuracy." |
| 5:15 | B | Symptom tab → robustness chart | "A single tree got 61 %; the dataset has only 305 unique rows and 41 of 42 test rows leak. The Random Forest stays at 94 % with 3 symptoms hidden." |
| 6:00 | C | Sign in as **admin** → Audit log | "Every login, view, prediction and emergency message is recorded." |
| 6:30 | C | Swagger `/api/docs`; GitHub Actions page | "28 documented endpoints; 103 automated tests in CI including real-browser tests." |

## 11.3 Slide outline (12–14 slides)

1. **Title:** project name, team, supervisor
2. **Problem:** fragmented, unexplained, leaky ML health prototypes
3. **Objectives:** synopsis objectives, all met, plus extras
4. **Architecture:** layered diagram (React → Flask → `medml` → DB)
5. **Data:** four datasets and the data-quality findings table (the "41 of 42 leak" slide)
6. **Method:** pipeline, grid search, 1-SE rule, nested CV
7. **Explainability:** decision-path formula with one real example
8. **Results:** nested-CV table, with a short note on the metric choice (liver baseline)
9. **Symptom module:** robustness chart and why a Random Forest
10. **Live demo** (or the recording)
11. **Security and quality:** RBAC, audit, rate limits, 103 tests, CI, Docker
12. **Limitations and ethics:** populations, calibration, not a diagnosis
13. **Future scope**
14. **Thank you / questions**

Charts for slides 5–9 are already in `ml/reports/` (PNG, 150 dpi).

## 11.4 Likely questions and model answers

**Q: Why Decision Trees when Random Forest scores higher?**
The synopsis prioritises interpretability for clinical support. Under nested cross-validation the
gap is 2.5–4.2 balanced-accuracy points, and every gap is within one standard deviation. In return,
a doctor can audit the whole heart model on one page (8 leaves), and every prediction comes with
exact reasons. Where a single tree clearly fails (symptoms, 61 %), we used a forest, which is still
tree-based, and kept explanations exact.

**Q: What is nested cross-validation, and why use it?**
The inner loop tunes hyperparameters; the outer loop scores the tuned model on folds the tuning
never saw. Ordinary CV with tuning reuses the same data to choose and to score, which is
optimistically biased (Varma & Simon, 2006).

**Q: What is the one-standard-error rule?**
Among all configurations whose CV score is within one standard error of the best, pick the
simplest (shallowest). Differences smaller than the noise are not real, and simpler trees
generalise and explain better.

**Q: Why balanced accuracy instead of accuracy?**
Class imbalance. On the liver data, predicting "disease" for everyone gives 71 % accuracy and 0.83
F1 but is useless. Balanced accuracy, the mean of sensitivity and specificity, is 0.5 for any
trivial model.

**Q: How do you know the explanations are correct?**
They are an exact decomposition of the tree's own computation, not a separate model.
Automated tests check that base rate + contributions = predicted probability for many patients,
for both trees and forests.

**Q: Your symptom model gets 100 %. Isn't that suspicious?**
Yes, and we say so. The raw data has only 305 unique patterns and its test file is almost all
copies of training rows. We de-duplicated it, used cross-validation, and added a robustness test
that hides symptoms. We do not claim real-world accuracy for this module.

**Q: How did you handle missing values?**
Pima zeros were converted to missing and median-imputed inside each training fold (inside the
pipeline, so there is no leakage). Optional fields at prediction time are imputed the same way, and
the explanation marks them "not provided; typical value assumed".

**Q: How is patient data protected?**
- Argon2id password hashing and short-lived JWTs with revocation.
- Role checks plus record-level rules; out-of-scope records return 404.
- Rate-limited login.
- An audit log of every access.
- Strong secrets enforced in production, and security headers via nginx.
- Prototype data only.

**Q: What does the AI assistant do, and how is it kept safe?**
It explains one stored result using only that result's data. Emergency messages never reach the
model. The system prompt forbids diagnosis and dosing. If the model refuses or fails, an offline
rules engine answers. Every reply ends with "not a diagnosis". It also works fully offline.

**Q: Why are probabilities like 0.88 not "real" probabilities?**
They are class proportions in the tree's leaf, with balanced class weights. They rank risk well
(ROC AUC 0.80–0.87) but are not calibrated. Calibration is listed as future work.

**Q: Can it run on MySQL as the synopsis says?**
Yes. The same Alembic migrations generate MySQL DDL, and `docker compose up` runs the whole
system on MySQL 8.4.

**Q: What would you do with more time?**
Calibration, larger and more recent Indian datasets, FHIR integration, Hindi support, drift
monitoring and a formal clinical usability study.

## 11.5 Division of explanation (suggested)

| Member | Owns in the viva |
|---|---|
| ML lead | Data quality, model selection, nested CV, explanations (§6, §9) |
| Backend lead | API, database, security, reports, assistant (§7, §8.4) |
| Frontend lead | UX, dashboards, model performance page, testing and deployment (§8.3, §9.5) |
