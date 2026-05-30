import { test, expect } from '@playwright/test';

test.describe('Checkout smoke', () => {
  test('catalog and checkout pages load', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page).toHaveURL(/\/catalog/);

    await page.goto('/checkout');
    await expect(page.locator('body')).toBeVisible();
  });

  test('telegram checkout route loads', async ({ page }) => {
    await page.goto('/telegram-app/checkout');
    await expect(page.locator('body')).toBeVisible();
  });
});
