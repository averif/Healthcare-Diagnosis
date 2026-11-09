import { expect, type Page } from '@playwright/test'

/** Password of the accounts created by `seed_database` (backend/app/cli.py). */
export const DEMO_PASSWORD = process.env.E2E_PASSWORD ?? 'Demo@12345'

export const ACCOUNTS = {
  patient: 'patient@mediassist.test',
  doctor: 'doctor@mediassist.test',
  admin: 'admin@mediassist.test',
} as const

export async function login(page: Page, email: string, password = DEMO_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
}

export async function logout(page: Page) {
  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/login$/)
}
