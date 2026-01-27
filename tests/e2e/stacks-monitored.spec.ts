import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { setupApiMocks } from './helpers/mockApi';
import { selectors } from './helpers/selectors';

test.describe('Stacks monitored', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('aplica cores do status e abre comparativo de redeploy', async ({ page }) => {
    await login(page);
    await page.goto('/app/stacks-monitored');

    const apiRow = page.locator('tr', { hasText: 'xpory-api' });
    await expect(apiRow.locator('.status-dot')).toHaveClass(/warn/);

    const frontRow = page.locator('tr', { hasText: 'xpory-front' });
    await expect(frontRow.locator('.status-dot')).toHaveClass(/ok/);

    const workerRow = page.locator('tr', { hasText: 'xpory-worker' });
    await expect(workerRow.locator('.status-dot')).toHaveClass(/down/);

    await apiRow.getByRole('button', { name: 'Redeploy' }).click();

    await expect(page.locator(selectors.redeploy.tabConfirm)).toBeVisible();
    await page.click(selectors.redeploy.tabImages);
    await expect(page.locator(selectors.redeploy.imagesTable)).toBeVisible();

    await page.click(selectors.redeploy.tabVariables);
    await expect(page.locator(selectors.redeploy.variablesTable)).toBeVisible();

    await page.fill(selectors.redeploy.variablesSearch, 'LOG_LEVEL');
    const rows = page.locator(selectors.redeploy.variablesTable).locator('tbody tr');
    await expect(rows).toHaveCount(1);
  });
});
