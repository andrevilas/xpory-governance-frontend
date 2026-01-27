import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { setupApiMocks } from './helpers/mockApi';
import { selectors } from './helpers/selectors';

test.describe('Stacks variables', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('filtra variaveis e abre modal por instancia', async ({ page }) => {
    await login(page);
    await page.goto('/app/stacks/variables');

    await expect(page.locator(selectors.stacksVariables.variablesTable)).toBeVisible();

    const rows = page.locator(selectors.stacksVariables.variablesTable).locator('tbody tr');
    await expect(rows).toHaveCount(7);

    await page.fill(selectors.stacksVariables.search, 'APP_ENV');
    await expect(rows).toHaveCount(1);

    await page.selectOption(selectors.stacksVariables.instanceSelect, 'instance-1');
    await expect(page.locator(selectors.stacksVariables.instanceTable)).toBeVisible();

    const instanceRows = page.locator(selectors.stacksVariables.instanceTable).locator('tbody tr');
    await expect(instanceRows).toHaveCount(7);

    await instanceRows.first().getByRole('button', { name: 'Salvar' }).click();
    await expect(page.getByRole('status')).toContainText('Variável da instância salva com sucesso.');
  });
});
