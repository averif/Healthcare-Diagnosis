import { expect, test } from '@playwright/test'
import { ACCOUNTS, login } from './helpers'

test.describe('Doctor', () => {
  test.beforeEach(async ({ page }) => login(page, ACCOUNTS.doctor))

  test('reviews a pending assessment from the queue', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible()
    await page.getByRole('link', { name: 'View' }).first().click()
    await expect(page).toHaveURL(/\/predictions\/\d+$/)

    await page.getByLabel('Your verdict').selectOption('agree')
    await page.getByLabel(/Notes for the patient/).fill('E2E: agree, follow up in two weeks.')
    await page.getByRole('button', { name: 'Save review' }).click()

    await expect(page.getByText('Agrees with the assessment', { exact: true })).toBeVisible()
    await expect(page.getByText('E2E: agree, follow up in two weeks.')).toBeVisible()
    await expect(page.getByText('Reviewed', { exact: true })).toBeVisible()
  })

  test('runs an assessment for an assigned patient', async ({ page }) => {
    await page.getByRole('link', { name: 'My patients' }).click()
    await page
      .getByRole('row', { name: /Priya Singh/ })
      .getByRole('link', { name: 'Open' })
      .click()
    await page.getByRole('link', { name: 'Run assessment' }).click()
    await page.getByRole('link', { name: /Liver Disease/ }).click()
    await expect(page.getByText('Assessment for Priya Singh')).toBeVisible()
    await page.getByRole('button', { name: 'Fill example' }).click()
    await page.getByRole('button', { name: 'Get assessment' }).click()
    await expect(page.getByRole('heading', { name: 'Liver disease assessment' })).toBeVisible()
    await expect(page.getByText(/requested by Dr\. Saman Verma/)).toBeVisible()
  })

  test('sees model performance but not admin pages', async ({ page }) => {
    await page.getByRole('link', { name: 'Model performance' }).click()
    await expect(page.getByRole('heading', { name: 'Confusion matrix' })).toBeVisible()
    await page.getByRole('tab', { name: 'Symptom Checker' }).click()
    await expect(page.getByText('Why this module uses a Random Forest')).toBeVisible()

    await page.goto('/admin/users')
    await expect(page).toHaveURL(/\/dashboard$/)
  })
})

test.describe('Admin', () => {
  test.beforeEach(async ({ page }) => login(page, ACCOUNTS.admin))

  test('creates a doctor account and the action is audited', async ({ page }) => {
    const email = `dr.e2e.${Date.now()}@mediassist.test`
    await page.getByRole('link', { name: 'Users' }).click()
    await page.getByRole('button', { name: 'Create user' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Full name').fill('Dr. E2E Test')
    await dialog.getByLabel('Email').fill(email)
    await dialog.getByLabel('Role').selectOption('doctor')
    await dialog.getByLabel('Temporary password').fill('Doctor2026x')
    await dialog.getByRole('button', { name: 'Create user' }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByText(email)).toBeVisible()

    await page.getByRole('link', { name: 'Audit log' }).click()
    await expect(page.getByText('admin.user_create').first()).toBeVisible()
  })

  test('assigns a doctor to a patient', async ({ page }) => {
    await page.getByRole('link', { name: 'Patients' }).click()
    const select = page.getByLabel('Assigned doctor for Aarav Sharma')
    await select.selectOption({ label: 'Dr. Rahul Mehta' })
    // wait for the save to land (the controlled select shows the server value), then reload
    const selected = select.locator('option:checked')
    await expect(selected).toHaveText('Dr. Rahul Mehta')
    await page.reload()
    await expect(selected).toHaveText('Dr. Rahul Mehta')
  })
})
