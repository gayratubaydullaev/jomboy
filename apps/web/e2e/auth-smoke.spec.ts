import { test, expect } from '@playwright/test';

test.describe('Auth smoke', () => {
  test('login page loads and shows form', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('register page loads', async ({ page }) => {
    await page.goto('/auth/register');
    await expect(page).toHaveURL(/\/auth\/register/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('protected admin route redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/auth\/login/);
    expect(page.url()).toContain('next=');
  });
});
