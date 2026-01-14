import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { selectors } from './helpers/selectors';

test.describe('Alerts', () => {
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
});
