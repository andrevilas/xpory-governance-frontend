import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { setupApiMocks } from './helpers/mockApi';
import { selectors } from './helpers/selectors';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

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

  test('filtra stacks e resultados de auditoria', async ({ page }) => {
    await login(page);
    await page.fill(selectors.inventory.filter, 'xpory-api');
    const rows = page.locator(selectors.inventory.table).locator('tbody tr');
    await expect(rows).toHaveCount(1);
    await rows.first().getByRole('button', { name: 'Detalhes' }).click();
    await expect(page.locator(selectors.audit.table)).toBeVisible();
    await expect(page.getByText('xpory/api')).toBeVisible();
    await page.fill(selectors.audit.filter, 'frontend');
    await expect(page.getByText('Nenhum resultado disponível.')).toBeVisible();
  });
});
