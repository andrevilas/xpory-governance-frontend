import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { selectors } from './helpers/selectors';

test.describe('Auth', () => {
  test('login valido', async ({ page }) => {
    await login(page);
    await expect(page.locator(selectors.dashboard.summaryCards)).toBeVisible();
  });

  test('login invalido', async ({ page }) => {
    await page.goto('/login');
    await page.fill(selectors.auth.email, 'invalid@example.com');
    await page.fill(selectors.auth.password, 'wrong');
    await page.click(selectors.auth.submit);
    await expect(page.getByText('Falha ao autenticar')).toBeVisible();
  });

  test('logout encerra sessao', async ({ page }) => {
    await login(page);
    await page.click(selectors.auth.logout);
    await expect(page).toHaveURL(/\/login/);
  });
});
