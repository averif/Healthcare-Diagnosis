import { expect, test } from '@playwright/test'
import { ACCOUNTS, login } from './helpers'

test.describe('Patient journey', () => {
  // the history test filters the assessments created by the tests before it
  test.describe.configure({ mode: 'serial' })
  test.beforeEach(async ({ page }) => login(page, ACCOUNTS.patient))

  test('diabetes assessment: validation, explained result, assistant and PDF report', async ({
    page,
  }) => {
    await page.getByRole('link', { name: 'New assessment' }).first().click()
    await page.getByRole('link', { name: /Diabetes/ }).click()

    // out-of-range value is rejected before reaching the server
    await page.getByLabel('Plasma glucose (2-h OGTT)').fill('900')
    await page.getByRole('button', { name: 'Get assessment' }).click()
    await expect(page.getByText('Must be between 40 and 300 mg/dL.')).toBeVisible()

    await page.getByRole('button', { name: 'Fill example' }).click()
    await page.getByRole('button', { name: 'Get assessment' }).click()

    await expect(page).toHaveURL(/\/predictions\/\d+$/)
    await expect(page.getByRole('heading', { name: 'Diabetes assessment' })).toBeVisible()
    await expect(page.getByText('Why this result?')).toBeVisible()
    await expect(page.getByText(/Together they add up exactly to the final \d+%/)).toBeVisible()
    await expect(page.getByText('Pending review')).toBeVisible()

    // AI assistant (offline rules provider in tests)
    await page.getByRole('button', { name: 'Why is my risk this level?' }).click()
    await expect(page.getByText(/The model's result was driven mostly by/)).toBeVisible()
    await page.getByLabel('Your question').fill('What dose of metformin should I take?')
    await page.getByRole('button', { name: 'Send' }).click()
    await expect(page.getByText(/can't advise on medicines/)).toBeVisible()

    // PDF report download
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Download PDF report' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^MediAssist-RPT-[0-9A-F]{8}\.pdf$/)
  })

  test('symptom checker warns about red-flag symptoms and triages urgently', async ({ page }) => {
    await page.goto('/assess/symptom')
    const search = page.getByLabel('Search symptoms')

    await search.fill('chest')
    await page.getByLabel('Chest pain').check()
    await page.getByRole('button', { name: 'Check symptoms' }).click()
    await expect(page.getByText('Select at least two symptoms.')).toBeVisible()

    await search.fill('breath')
    await page.getByLabel('Breathlessness').check()
    await search.fill('sweat')
    await page.getByLabel('Sweating').check()
    await expect(page.getByText('Some of these symptoms can be serious')).toBeVisible()

    await page.getByRole('button', { name: 'Check symptoms' }).click()
    await expect(page.getByText('Heart attack').first()).toBeVisible()
    await expect(page.getByText('Important warning')).toBeVisible()
    await expect(page.getByText(/go to the nearest emergency department/)).toBeVisible()
  })

  test('history can be filtered by module', async ({ page }) => {
    await page.getByRole('link', { name: 'My history' }).click()
    await page.getByLabel('Module').selectOption('symptom')
    await expect(page).toHaveURL(/disease=symptom/)
    const modules = page.locator('tbody tr td:nth-child(2)')
    await expect(modules.first()).toBeVisible()
    for (const text of await modules.allTextContents()) expect(text).toBe('Symptom checker')
  })
})
