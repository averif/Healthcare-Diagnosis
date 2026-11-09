# 8. Testing

Testing follows the three levels promised in the synopsis (§9: unit, integration, user acceptance),
plus browser end-to-end tests and automated quality gates. Every automated level runs in GitHub
Actions on each push.

## 8.1 Summary

| Level | Tool | Tests | What it covers |
|---|---|---:|---|
| ML unit | pytest | 31 | Data cleaning per dataset, explainer exactness (tree **and** forest), the 1-SE rule, inference contract, input validation, JSON serialisation |
| API unit and integration | pytest + Flask test client | 51 | Auth, RBAC, record-level access, predictions, reviews, PDF reports, dashboards, admin, assistant guardrails, seeding, production config, proxy handling |
| Frontend unit | Vitest + React Testing Library | 10 | Form-schema builder (clinical ranges), explanation chart, risk gauge, route guard, disclaimer |
| End-to-end | Playwright (Chromium) | 11 | Real browser → React → Flask → trained models → database, for all three roles |
| User acceptance | Guided sessions + questionnaire | 8 scenarios | Usability and understanding with real users (§8.6) |
| Static analysis | Ruff, oxlint, TypeScript, Prettier | — | Lint, formatting and strict type-checking |
| Security | pip-audit, npm audit | — | Known-vulnerability scan of every dependency |

**Coverage:** the API reaches **97 % line coverage** (1,450 statements). ML unit-test coverage
is 56 %. The remaining lines are the training and plotting scripts, which are exercised end to
end by `python -m medml.train` rather than by unit tests.

## 8.2 Unit tests

**ML (`ml/tests/`)**

| Area | Example checks |
|---|---|
| Data cleaning | Pima zeros become missing (374 insulin values); heart target binarised to 164/139; 13 liver duplicates removed and labels remapped; symptom file de-duplicated to ~305 unique rows with typos fixed |
| Explainer | For many patients, `base rate + Σ contributions == predicted probability` (±0.001), for single trees **and** for a Random Forest; one-hot columns map back to original features; imputed values are flagged |
| Model selection | The one-standard-error rule picks the simplest tree within 1 SE of the best score |
| Inference | Valid inputs produce a probability, risk band and reasons; out-of-range, missing and unknown fields are rejected with per-field messages; symptom red flags are detected |

**API (`backend/tests/`)**: 51 tests, including:

| File | Tests | Highlights |
|---|---:|---|
| `test_auth.py` | 7 | Registration and password policy, login auditing, token refresh, logout revocation, deactivated users locked out, **rate limit returns 429 on the 4th attempt** |
| `test_patients.py` | 6 | Profile validation; doctors see only assigned patients; records outside scope return 404; clinician access is audit-logged |
| `test_predictions.py` | 11 | Modules catalogue; explained predictions; field-level 422 errors; input red flags; symptom triage; doctor and patient restrictions; history filters and pagination; review workflow |
| `test_reports.py` | 3 | Valid PDF with `RPT-` code, re-download by code, regeneration if the file is deleted, access control |
| `test_dashboard_admin.py` | 6 | Scoped dashboards per role, model cards, user management (no self-demotion), doctor assignment, audit log, OpenAPI security metadata |
| `test_assistant.py` | 8 | Offline answers, **emergency messages bypass the model**, private history, Claude call grounded in the prediction (fake client, no cost), refusal and network errors fall back to rules |
| `test_models.py`, `test_cli.py`, `test_health.py` | 10 | Schema constraints, idempotent demo seeding, health and OpenAPI, production refuses weak secrets, real client IP behind a proxy |

## 8.3 Integration testing

The API tests are integration tests in the synopsis's sense: each request goes through routing,
JWT verification, schema validation, the service layer, the **real trained models** and a
database. Additional integration checks:

- `flask db check` confirms the Alembic migrations match the models exactly.
- `flask db upgrade --sql` against a MySQL URL generates valid MySQL DDL from the same
  migrations (SQLite → MySQL portability).
- A live run with `curl`: login → dashboard → prediction → review → PDF → logout → revoked token
  rejected (Phase 3 notes).

## 8.4 End-to-end tests (`frontend/e2e/`)

Playwright starts a **fresh, seeded database** (`backend/scripts/e2e_server.py`) and the Vite
app, then drives Chromium like a user:

| Spec | Scenario |
|---|---|
| `auth.spec.ts` | Register with validation → welcome → profile save → BMI calculated; wrong password error; protected routes redirect; sign-out ends the session |
| `patient.spec.ts` | Diabetes form rejects glucose 900 → example values → explained result → assistant explains "why" and refuses dosing → PDF download with `RPT-` filename; symptom checker blocks one symptom, warns on red flags, triages heart attack urgently; history filter |
| `clinician-admin.spec.ts` | Doctor reviews from the queue; runs a liver assessment for an assigned patient; views model performance; is blocked from admin pages. Admin creates a doctor (audited) and assigns a doctor to a patient |

Run locally: `cd frontend && E2E_PYTHON=../.venv/Scripts/python.exe npm run test:e2e`
(`npm run test:e2e:ui` opens the interactive runner). Result: **11/11 passed in about 25 s.**

## 8.5 Defects found by testing (and fixed)

| # | Found by | Defect | Fix |
|---|---|---|---|
| 1 | Training run | Liver tree selected on F1 equalled the "always disease" baseline | Select on balanced accuracy |
| 2 | Training run | Single tree only 61 % on unseen symptom patterns | Random Forest for that module; explainer extended to forests |
| 3 | API test | NumPy `bool_` in explanation was not JSON-serialisable | Cast to `bool`; serialisation test added |
| 4 | API test | Streaming PDFs held a file lock on Windows | Serve reports from memory |
| 5 | Live PDF check | `≥` and `⚠` rendered as boxes in Helvetica | Character substitution for PDF output |
| 6 | Browser test | After registering, the user landed on the dashboard, not the welcome page | Redirect guard respects in-flight sign-in |
| 7 | Browser test | Signing in after another user's sign-out reopened their page | Remember the page only when the session expired |
| 8 | E2E test | Required-field asterisk was read aloud as part of every label | Asterisk `aria-hidden`, `aria-required` on the control |
| 9 | Code review (Phase 5) | Behind nginx, all users shared one IP for rate limiting | `ProxyFix` when `BEHIND_PROXY=1`, with a test |
| 10 | Code review (Phase 5) | `.env` was read after config import, so it was ignored under gunicorn | Load `.env` before config |

## 8.6 User acceptance testing (UAT)

**Participants:** 6–10 classmates or family members, at least two acting as doctors. **Method:**
each participant completes the scenarios below without help (think-aloud), then fills in the
questionnaire. Record completion, time and problems in the table.

| ID | Role | Scenario | Success criterion |
|---|---|---|---|
| U1 | Patient | Create an account and complete your profile | Profile saved; age and BMI shown |
| U2 | Patient | Check your diabetes risk with the values on the card provided | Result page reached without help |
| U3 | Patient | Explain in your own words *why* you got that result | Names the top factor correctly |
| U4 | Patient | Find out what you should do next, then download the report | Mentions the guidance; PDF opened |
| U5 | Patient | Use the symptom checker for: fever, cough, breathlessness | Notices the red-flag warning |
| U6 | Doctor | Find the oldest assessment waiting for review and record a verdict | Review saved |
| U7 | Doctor | Compare the Decision Tree with Random Forest for heart disease | Finds the comparison table |
| U8 | Admin | Assign an unassigned patient to a doctor | Assignment saved |

**Questionnaire** (1 = strongly disagree … 5 = strongly agree):

1. The system was easy to use.
2. I understood what the result meant.
3. I understood *why* the system gave that result.
4. It was clear the result is not a medical diagnosis.
5. I would trust a doctor-reviewed result more than the AI alone.
6. The pages loaded quickly and worked on my device.
7. Open question: what was confusing or missing?

Use the [UAT record sheet](uat-record-sheet.md) to collect results. Report the mean score per
question and the scenario completion rate in the final report (Chapter 9).
