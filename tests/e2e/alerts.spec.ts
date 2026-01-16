import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { setupApiMocks } from './helpers/mockApi';
import { selectors } from './helpers/selectors';

test.describe('Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('abre configuracoes de notificacoes', async ({ page }) => {
    await login(page);
    await page.goto('/app/alerts');

    await expect(page.locator(selectors.notifications.configLink)).toBeVisible();
    await page.locator(selectors.notifications.configLink).click();
    await expect(page).toHaveURL(/\/app\/notifications\/recipients$/);
  });

  test('filtra logs por canal e status', async ({ page }) => {
    await login(page);
    await page.goto('/app/alerts');

    const filters = page.getByRole('combobox');
    await filters.nth(0).selectOption({ label: 'SMS' });
    await filters.nth(1).selectOption({ label: 'Falha' });
    const logItems = page.locator('ul.log-list > li');
    await expect(logItems).toHaveCount(1);
    const logItem = logItems.first();
    await expect(logItem).toContainText('SMS');
    await expect(logItem).toContainText('FAILED');
  });
});
