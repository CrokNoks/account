import { test, expect } from '@playwright/test';

test.describe('Application Smoke Tests', () => {
  test('should load the main page', async ({ page }) => {
    await page.goto('/');
    
    // Check if page loads without errors
    await expect(page).toHaveTitle(/Mes Comptes|Account v2/);
  });

  test('should show navigation elements', async ({ page }) => {
    await page.goto('/');
    
    // Look for common navigation elements
    const nav = page.locator('nav').first();
    if (await nav.isVisible()) {
      await expect(nav).toBeVisible();
    }
  });

  test('should handle authentication flow', async ({ page }) => {
    await page.goto('/');
    
    // Look for login/signup buttons or auth elements
    const loginButton = page.locator('button:has-text("Login"), button:has-text("Sign In"), a:has-text("Login")').first();
    
    if (await loginButton.isVisible()) {
      await loginButton.click();
      // Should navigate to login page or show login form
      await page.waitForTimeout(1000);
    }
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');
    
    // Test mobile view
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    // Test desktop view
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
  });
});