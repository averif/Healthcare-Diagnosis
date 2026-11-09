import { expect, test } from '@playwright/test'
import { ACCOUNTS, login, logout } from './helpers'

test.describe('Authentication', () => {
  test('a new patient can register and is guided to complete their profile', async ({ page }) => {
    const email = `e2e.${Date.now()}@mediassist.test`
    await page.goto('/')
    await page.getByRole('link', { name: 'Create a free account' }).click()

    // client-side validation
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.getByText('Enter your full name.')).toBeVisible()
    await expect(
      page.getByText('Please confirm you understand this is not a diagnosis.'),
    ).toBeVisible()

    await page.getByLabel('Full name').fill('Riya E2E')
    await page.getByLabel('Email').fill(email)
    await page.getByRole('textbox', { name: 'Password', exact: true }).fill('E2eTest2026')
    await page.getByLabel('Confirm password').fill('E2eTest2026')
    await page.getByRole('checkbox').check()
    await page.getByRole('button', { name: 'Create account' }).click()

    await expect(page).toHaveURL(/\/profile\?welcome=1$/)
    await expect(page.getByText('Welcome to MediAssist!')).toBeVisible()

    await page.getByLabel('Date of birth').fill('1990-06-15')
    await page.getByLabel('Height (cm)').fill('165')
    await page.getByLabel('Weight (kg)').fill('60')
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByText('Saved.')).toBeVisible()
    await expect(page.getByText('22', { exact: true })).toBeVisible() // BMI 60 / 1.65²
  })

  test('wrong password shows an error and protected pages require sign-in', async ({ page }) => {
    await page.goto('/history')
    await expect(page).toHaveURL(/\/login$/)

    await page.getByLabel('Email').fill(ACCOUNTS.patient)
    await page.getByLabel('Password').fill('not-the-password1')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toHaveText('Invalid email or password.')
  })

  test('signing out ends the session', async ({ page }) => {
    await login(page, ACCOUNTS.patient)
    await logout(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login$/)
  })
})
