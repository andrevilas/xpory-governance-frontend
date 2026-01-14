import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { setupApiMocks } from './helpers/mockApi';
import { selectors } from './helpers/selectors';

test.describe('Alerts', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('toggle notificacoes', async ({ page }) => {
    await login(page);
    await page.goto('/app/alerts');

    await expect(page.locator(selectors.notifications.emailToggle)).toBeVisible();
    await expect(page.locator(selectors.notifications.smsToggle)).toBeVisible();

    await page.locator(selectors.notifications.emailToggle).click();
    await page.locator(selectors.notifications.smsToggle).click();
    await expect(page.locator(selectors.notifications.save)).toBeVisible();
    await page.locator(selectors.notifications.save).click();

    await expect(page.getByText('Ultima gravacao')).toBeVisible();
  });

  test('filtra logs por canal e status', async ({ page }) => {
    await login(page);
    await page.goto('/app/alerts');

    const filters = page.getByRole('combobox');
    await filters.nth(0).selectOption({ label: 'SMS' });
    await filters.nth(1).selectOption({ label: 'Falha' });
    const logItems = page.locator('ul.log-list > li');
    await expect(logItems).toHaveCount(1);
    await expect(page.getByText('SMS')).toBeVisible();
    await expect(page.getByText('FAILED')).toBeVisible();
  });
});
