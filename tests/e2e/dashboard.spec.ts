import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { selectors } from './helpers/selectors';

test.describe('Dashboard', () => {
  test('exibe KPIs e cards', async ({ page }) => {
    await login(page);
    await expect(page.locator(selectors.dashboard.summaryCards)).toBeVisible();
    await expect(page.locator(selectors.dashboard.kpiInventory)).toBeVisible();
    await expect(page.locator(selectors.dashboard.kpiAlerts)).toBeVisible();
    await expect(page.locator(selectors.dashboard.kpiUpdates)).toBeVisible();
  });

  test('lista stacks e abre detalhe com auditoria', async ({ page }) => {
    await login(page);
    await expect(page.locator(selectors.inventory.table)).toBeVisible();
    await page.waitForSelector(`${selectors.inventory.table} tbody tr`);
    await page
      .locator(selectors.inventory.table)
      .locator('tbody tr')
      .first()
      .getByRole('button', { name: 'Detalhes' })
      .click();
    await expect(page.locator(selectors.inventory.hostname)).toBeVisible();
    await expect(page.locator(selectors.audit.table)).toBeVisible();
    await page.fill(selectors.audit.filter, 'xpory');
    await expect(page.locator(selectors.audit.table)).toBeVisible();
    await page.click(selectors.audit.export);
  });
});
