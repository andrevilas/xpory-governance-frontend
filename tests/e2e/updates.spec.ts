import { test, expect } from '@playwright/test';

import { login } from './helpers/auth';
import { selectors } from './helpers/selectors';

test.describe('Updates', () => {
  test('carrega fluxo de aprovacao', async ({ page }) => {
    await login(page);
    await page.goto('/app/updates');

    await expect(page.locator(selectors.update.policies)).toBeVisible();
    await expect(page.locator(selectors.update.dryRun)).toBeDisabled();
    await expect(page.locator(selectors.update.submit)).toBeDisabled();

    await page.getByRole('button', { name: 'Aprovar atualizacao' }).click();
    await expect(page.locator(selectors.update.dryRun)).toBeEnabled();
    await expect(page.locator(selectors.update.submit)).toBeEnabled();
  });
});
