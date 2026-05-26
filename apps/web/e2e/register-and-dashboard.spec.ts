import { test, expect } from '@playwright/test';

/**
 * Sprint 14.2 — browser smoke: register a fresh user → land on /dashboard →
 * sidebar nav works. Asserts the auth cookie flow (httpOnly access cookie)
 * since we never inspect tokens directly.
 *
 * Assumes the API is reachable at NEXT_PUBLIC_API_URL (default: localhost
 * port set by apps/api). Locally: `pnpm --filter @mkt-seo/api dev` in
 * another terminal before running.
 */
test.describe('Auth + dashboard smoke', () => {
  test('register a new account → dashboard renders sidebar', async ({ page }) => {
    const email = `pw-${Date.now()}@test.local`;

    await page.goto('/register');
    await expect(page.getByRole('heading', { name: /Tạo tài khoản/i })).toBeVisible();

    await page.locator('#name').fill('Playwright Tester');
    await page.locator('#email').fill(email);
    await page.locator('#password').fill('P@ssw0rd123');

    await page.getByRole('button', { name: /Đăng ký|Tạo tài khoản/i }).click();

    // Dashboard layout shows the sidebar logo.
    await page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 });
    await expect(page.getByText('MKT SEO AI').first()).toBeVisible();

    // Sidebar entries we've shipped through Sprint 15.
    for (const label of ['Tổng quan', 'Pipeline', 'Từ khóa', 'Brand Voice', 'Cài đặt']) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('login page renders', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Đăng nhập|Login/i })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('landing page renders + CTA goes to register', async ({ page }) => {
    await page.goto('/landing');
    await page
      .getByRole('link', { name: /Bắt đầu|Dùng thử|Đăng ký/i })
      .first()
      .click();
    await page.waitForURL(/\/register/);
    await expect(page.getByRole('heading', { name: /Tạo tài khoản/i })).toBeVisible();
  });
});
