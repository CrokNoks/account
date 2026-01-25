import { test as base, type TestFixture, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

// Test user types
interface TestUser {
  email: string;
  password: string;
  role: 'admin' | 'user';
}

// Simple auth fixtures for testing
type AuthFixtures = {
  authenticatedUser: TestUser;
  adminUser: TestUser;
};

export const authFixtures = base.extend<AuthFixtures>({
  // Authenticated user for regular tests
  authenticatedUser: async ({ browser }, use): Promise<TestUser> => {
    const timestamp = Date.now();
    return {
      email: `test-${timestamp}@account-e2e.com`,
      password: 'TestSecurePass123!',
      role: 'user'
    };
  },

  // Admin user for admin tests
  adminUser: async ({ browser }, use): Promise<TestUser> => {
    return {
      email: process.env.E2E_ADMIN_EMAIL || 'admin@account-e2e.com',
      password: process.env.E2E_ADMIN_PASSWORD || 'AdminPass123!',
      role: 'admin'
    };
  }
});

export { authFixtures as test, expect };