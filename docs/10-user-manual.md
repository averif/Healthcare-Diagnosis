# 10. User Manual

> MediAssist gives **preliminary, AI-generated assessments for decision support**. It is not a
> medical diagnosis. Always consult a qualified healthcare professional.

## 10.1 For patients

**Create an account.** Click **Get started** on the home page. Enter your name, email and a
password (at least 8 characters with a letter and a number), tick the acknowledgement and click
**Create account**.

**Complete your profile.** Add your date of birth, sex, height and weight. MediAssist calculates
your age and BMI, and your doctor sees this profile when reviewing your results.

**Run an assessment.** Click **New assessment** and choose a module:

| Module | You will need |
|---|---|
| Diabetes | Recent glucose (OGTT) result, blood pressure, BMI, age; insulin and skin-fold are optional |
| Heart disease | Results from a cardiology work-up (ECG, stress test, cholesterol) |
| Liver disease | A liver function test report |
| Symptom checker | Just your symptoms: search and tick at least two |

Each field shows its unit and the accepted range. If a value is outside the range, the form tells
you before anything is sent. **Fill example** loads sample values so you can see how the module
works.

**Read your result.**

- **Gauge:** the estimated probability and the risk level (low / moderate / high).
- **Why this result?:** each factor that raised (red ↑) or lowered (green ↓) the estimate, in
  points. The factors add up exactly to the final percentage.
- **What to do next:** general guidance. Red warning boxes mean you should seek urgent care.
- **Doctor review:** your doctor's verdict and notes appear here once they have reviewed it.
- **Ask the assistant:** ask questions such as "why is my risk high?". It cannot diagnose or
  advise on medicines.
- **Download PDF report:** a printable report with a unique code (e.g. `RPT-7F3K9Q2M`).

**History.** **My history** lists all your assessments. Filter by module, risk or review status.

## 10.2 For doctors

- **Dashboard:** your patients, assessments awaiting review, the 30-day activity chart and the
  risk distribution. The **review queue** lists the most recent pending assessments.
- **Reviewing:** open an assessment, check the explanation and inputs, choose a verdict (agrees /
  disagrees / inconclusive), add notes for the patient and click **Save review**. You can edit a
  review later. The patient sees your verdict immediately, and it is printed on the PDF.
- **Assessing a patient:** **My patients** → open a patient → **Run assessment**.
- **Model performance:** metrics, confusion matrix, ROC curves, feature importance and algorithm
  comparison for every module, so you can judge how much weight to give a result.

## 10.3 For administrators

- **Users:** create doctor, admin or patient accounts with a temporary password; change roles;
  deactivate access (deactivated users are signed out at once). You cannot demote or deactivate
  yourself.
- **Patients:** assign each patient to a responsible doctor. Patients without a doctor are
  counted on the dashboard.
- **Audit log:** every sign-in (including failures), record view, assessment, review, report,
  emergency assistant message and admin change, with time, user and IP address.

## 10.4 Troubleshooting

| Problem | What to do |
|---|---|
| "Cannot reach the server" | Make sure the API is running (`flask run`, or `docker compose up`) |
| Signed out unexpectedly | Sessions expire after 7 days without use; sign in again |
| "Too many requests" | Login is limited to 10 attempts per minute; wait a minute |
| A value is rejected | Check the unit (e.g. glucose in mg/dL, not mmol/L) and the range shown under the field |
| Assistant says "Offline mode" | No AI key is configured; answers come from the built-in explanation (this is expected) |
