import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { setupApiMocks } from './helpers/mockApi';
import { selectors } from './helpers/selectors';

test.describe('Updates', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('carrega fluxo de aprovacao', async ({ page }) => {
    await login(page);
    await page.goto('/app/updates');

    await expect(page.locator(selectors.update.policies)).toBeVisible();
    await expect(page.locator(selectors.update.dryRun)).toBeDisabled();
    await expect(page.locator(selectors.update.submit)).toBeDisabled();

    await page.getByRole('button', { name: 'Aprovar atualizacao' }).click();
    await expect(page.locator(selectors.update.dryRun)).toBeEnabled();
    await expect(page.locator(selectors.update.submit)).toBeEnabled();
  });

  test('executa update e apresenta status', async ({ page }) => {
    await login(page);
    await page.goto('/app/updates');

    await page.getByRole('button', { name: 'Aprovar atualizacao' }).click();
    await page.locator(selectors.update.submit).click();
    await expect(page.getByText('Status atual: success')).toBeVisible();
    await expect(page.getByText('Pre-update')).toBeVisible();
    await expect(page.getByText('Post-update')).toBeVisible();
    await expect(page.getByText('OK')).toBeVisible();
  });
});
