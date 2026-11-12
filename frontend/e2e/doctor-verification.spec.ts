import { expect, test } from '@playwright/test'
import { ACCOUNTS, login } from './helpers'

test.describe('Doctor self-registration', () => {
  test('a doctor applies, waits for review, and gets access once an admin approves', async ({
    page,
    browser,
  }) => {
    const stamp = Date.now()
    const email = `dr.apply.${stamp}@mediassist.test`
    const license = `E2E-${stamp}`

    await page.goto('/register')
    await page.getByRole('radio', { name: 'Doctor' }).click()
    await expect(page.getByText('Doctor accounts are verified by an administrator')).toBeVisible()

    // licence fields are required for doctors
    await page.getByRole('button', { name: 'Submit application' }).click()
    await expect(page.getByText('Enter your licence number.')).toBeVisible()

    await page.getByLabel('Full name').fill('Dr. Apply E2E')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('E2eTest2026')
    await page.getByLabel('Confirm password').fill('E2eTest2026')
    await page.getByLabel('Licence number').fill(license)
    await page.getByLabel('Issuing authority').fill('Karnataka Medical Council')
    await page.getByLabel('Hospital').fill('E2E General Hospital')
    await page.getByLabel('Registration certificate').setInputFiles({
      name: 'licence.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\n% e2e certificate\n'),
    })
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Submit application' }).click()

    await expect(page).toHaveURL(/\/application$/)
    await expect(
      page.getByRole('heading', { name: 'Your application is under review' }),
    ).toBeVisible()
    await expect(page.getByText('Received')).toBeVisible()

    // doctor pages stay locked while pending
    await page.goto('/patients')
    await expect(page).toHaveURL(/\/application$/)

    // an admin approves the application in another session
    const adminContext = await browser.newContext()
    const admin = await adminContext.newPage()
    await login(admin, ACCOUNTS.admin)
    await admin.getByRole('link', { name: 'Applications' }).click()
    const row = admin.getByRole('row', { name: new RegExp(email) })
    await expect(row.getByText(license)).toBeVisible()
    await expect(row.getByRole('button', { name: 'View document' })).toBeVisible()
    await row.getByRole('button', { name: 'Approve Dr. Apply E2E' }).click()
    await expect(row).toBeHidden() // the pending list refreshes
    await admin.getByRole('link', { name: 'Audit log' }).click()
    await expect(admin.getByText('admin.doctor_approve').first()).toBeVisible()
    await adminContext.close()

    // the applicant now gets the doctor workspace
    await page.goto('/application')
    await expect(page).toHaveURL(/\/dashboard$/)
    await page.getByRole('link', { name: 'My patients' }).click()
    await expect(page).toHaveURL(/\/patients$/)
  })

  test('an admin rejects an application with a reason the applicant sees', async ({
    page,
    browser,
  }) => {
    const stamp = Date.now()
    const email = `dr.reject.${stamp}@mediassist.test`

    await page.goto('/register')
    await page.getByRole('radio', { name: 'Doctor' }).click()
    await page.getByLabel('Full name').fill('Dr. Reject E2E')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('E2eTest2026')
    await page.getByLabel('Confirm password').fill('E2eTest2026')
    await page.getByLabel('Licence number').fill(`REJ-${stamp}`)
    await page.getByLabel('Issuing authority').fill('Goa Medical Council')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Submit application' }).click()
    await expect(page).toHaveURL(/\/application$/)

    const adminContext = await browser.newContext()
    const admin = await adminContext.newPage()
    await login(admin, ACCOUNTS.admin)
    await admin.getByRole('link', { name: 'Applications' }).click()
    await admin
      .getByRole('row', { name: new RegExp(email) })
      .getByRole('button', { name: 'Reject Dr. Reject E2E' })
      .click()
    const dialog = admin.getByRole('dialog')
    await dialog.getByLabel('Reason').fill('Licence number not found in the council register.')
    await dialog.getByRole('button', { name: 'Reject' }).click()
    await expect(dialog).toBeHidden()
    await adminContext.close()

    await page.reload()
    await expect(
      page.getByRole('heading', { name: 'Your application was not approved' }),
    ).toBeVisible()
    await expect(page.getByText('Licence number not found in the council register.')).toBeVisible()
  })
})
