import { test, expect } from '@playwright/test';

test.describe('Locale switch', () => {
  test('switches UI language via cookie', async ({ page, context }) => {
    await context.addCookies([
      {
        name: 'myshop_locale',
        value: 'ru',
        domain: '127.0.0.1',
        path: '/',
      },
    ]);
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: /навигац/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel('Главная', { exact: true })).toBeVisible();
  });
});

test.describe('Mobile layout', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('bottom navigation is visible on catalog', async ({ page }) => {
    await page.goto('/catalog');
    await expect(page.getByRole('navigation', { name: /navigatsiya|навигац/i })).toBeVisible();
    await expect(page.getByLabel(/Bosh sahifa|Главная/)).toBeVisible();
    await expect(page.getByLabel(/Savatcha|Корзина/)).toBeVisible();
  });
});
