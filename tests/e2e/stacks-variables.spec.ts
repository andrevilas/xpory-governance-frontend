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
    await page.waitForURL(/\/app\/stacks\/variables/);

    await expect(page.getByRole('heading', { name: 'Variáveis declaradas' })).toBeVisible();
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

  test('remove variaveis selecionadas em massa', async ({ page }) => {
    await login(page);
    await page.goto('/app/stacks/variables');
    await page.waitForURL(/\/app\/stacks\/variables/);

    const table = page.locator(selectors.stacksVariables.variablesTable);
    await expect(table).toBeVisible();

    const rows = table.locator('tbody tr');
    await expect(rows).toHaveCount(7);

    await rows.nth(0).locator('input[type="checkbox"]').check();
    await rows.nth(1).locator('input[type="checkbox"]').check();

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Remover selecionadas/i }).click();

    await expect(rows).toHaveCount(5);
  });
});
