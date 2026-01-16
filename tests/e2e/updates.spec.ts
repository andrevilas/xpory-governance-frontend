import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { setupApiMocks } from './helpers/mockApi';
import { selectors } from './helpers/selectors';

test.describe('Updates', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('carrega fluxo de aprovação', async ({ page }) => {
    await login(page);
    await page.goto('/app/updates');

    await expect(page.locator(selectors.update.policies)).toBeVisible();
    await expect(page.locator(selectors.update.dryRun)).toBeDisabled();
    await expect(page.locator(selectors.update.submit)).toBeDisabled();

    await page.getByRole('button', { name: 'Aprovar atualização' }).click();
    await expect(page.locator(selectors.update.dryRun)).toBeEnabled();
    await expect(page.locator(selectors.update.submit)).toBeEnabled();
  });

  test('executa update e apresenta status', async ({ page }) => {
    await login(page);
    await page.goto('/app/updates');

    await page.getByRole('button', { name: 'Aprovar atualização' }).click();
    await page.locator(selectors.update.submit).click();
    await expect(page.getByText('Status atual: success')).toBeVisible();
    const healthSection = page.getByRole('heading', { name: 'Indicadores de health' }).locator('..');
    await expect(healthSection.locator('.health-item')).toContainText(['Pre-update', 'Post-update']);
    await expect(healthSection.locator('.health-item strong')).toHaveText(['OK', 'OK']);
  });
});
