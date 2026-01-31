import { Page, expect } from '@playwright/test';

import { selectors } from './selectors';

const DEFAULT_EMAIL = 'admin@xpory.local';
const DEFAULT_PASSWORD = 'Xpory#123';

export async function login(page: Page) {
  const email = process.env.PLAYWRIGHT_USER_EMAIL ?? DEFAULT_EMAIL;
  const password = process.env.PLAYWRIGHT_USER_PASSWORD ?? DEFAULT_PASSWORD;

  await page.goto('/login');
  await page.waitForLoadState('domcontentloaded');
  await page.fill(selectors.auth.email, email);
  await page.fill(selectors.auth.password, password);
  await page.click(selectors.auth.submit);
  await expect(page).toHaveURL(/\/app\/dashboard/);
  await expect(page.locator(selectors.dashboard.summaryCards)).toBeVisible();
}
