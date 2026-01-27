import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { setupApiMocks } from './helpers/mockApi';
import { selectors } from './helpers/selectors';

test.describe('Auditing', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('lista resultados e filtra por imagem', async ({ page }) => {
    await login(page);
    await page.goto('/app/auditing');

    await expect(page.locator(selectors.auditing.table)).toBeVisible();

    const rows = page.locator(selectors.auditing.table).locator('tbody tr');
    await expect(rows).toHaveCount(2);

    await page.fill(selectors.auditing.filterImage, 'front');
    await expect(rows).toHaveCount(1);
    await expect(page.getByText('xpory/front')).toBeVisible();
  });
});
