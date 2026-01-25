# E2E Testing Implementation Plan for Account v2

**Version 1.0**  
Account v2 Development Team  
January 2026

---

## 🚀 Phase 1: Installation & Setup (1-2 days)

### 1.1 Install Playwright & Dependencies

**Run these commands in the root directory:**

```bash
# Install Playwright
npm install --save-dev @playwright/test

# Install test data faker for realistic test data
npm install --save-dev @faker-js/faker

# Install assertion library for better test assertions
npm install --save-dev @types/jest

# Install additional utilities for React testing
npm install --save-dev @testing-library/react
npm install --save-dev @testing-library/jest-dom
```

### 1.2 Initialize Playwright Configuration

```bash
# Initialize Playwright configuration
npx playwright install

# Install browsers
npx playwright install chromium firefox webkit

# Create initial configuration
npx playwright init --accept-all-markers-in-tests
```

### 1.3 Update package.json Scripts

Add these scripts to your root `package.json`:

```json
{
  "scripts": {
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:debug": "playwright test --debug",
    "e2e:codegen": "playwright codegen http://localhost:5173",
    "e2e:report": "playwright show-report",
    "test": "npm run lint && npm run test:unit && npm run e2e",
    "test:unit": "echo 'No unit tests configured yet'",
    "test:e2e:ci": "playwright test --reporter=junit --reporter=html"
  }
}
```

---

## 📁 Phase 2: File Structure Blueprint

### 2.1 Complete Directory Structure

```
account-v2/
├── e2e/
│   ├── fixtures/                    # Test data and mock responses
│   │   ├── users.json
│   │   ├── expenses.json
│   │   ├── categories.json
│   │   └── accounts.json
│   ├── pages/                       # Page Object Models
│   │   ├── BasePage.ts
│   │   ├── LoginPage.ts
│   │   ├── ExpensePage.ts
│   │   ├── CategoryPage.ts
│   │   ├── ReportPage.ts
│   │   └── AccountPage.ts
│   ├── tests/                       # Actual test files
│   │   ├── auth/
│   │   │   ├── login.spec.ts
│   │   │   └── logout.spec.ts
│   │   ├── expenses/
│   │   │   ├── crud.spec.ts
│   │   │   ├── import.spec.ts
│   │   │   └── search.spec.ts
│   │   ├── categories/
│   │   │   ├── crud.spec.ts
│   │   │   └── auto-color.spec.ts
│   │   ├── reports/
│   │   │   ├── dashboard.spec.ts
│   │   │   └── export.spec.ts
│   │   ├── accounts/
│   │   │   ├── crud.spec.ts
│   │   │   └── sharing.spec.ts
│   │   └── regression/
│   │       ├── smoke.spec.ts
│   │       └── critical-path.spec.ts
│   ├── utils/                       # Test utilities and helpers
│   │   ├── dataFactory.ts
│   │   ├── apiHelpers.ts
│   │   ├── mockHelpers.ts
│   │   └── testHelpers.ts
│   ├── hooks/                       # Custom test hooks
│   │   ├── authSetup.ts
│   │   ├── cleanup.ts
│   │   └── dataSetup.ts
│   └── config/                      # Environment configurations
│       ├── playwright.config.ts
│       ├── environments.ts
│       └── testEnv.ts
├── .github/
│   └── workflows/
│       └── e2e-tests.yml           # CI/CD integration
└── docker-compose.e2e.yml          # Test environment setup
```

---

## 🔧 Phase 3: Configuration Setup (1 day)

### 3.1 Create Playwright Configuration

Create `e2e/config/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';
import { testEnvironments } from './environments';

export default defineConfig({
  testDir: '../tests',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['line'], // Show detailed error messages
  ],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },

  globalSetup: '../hooks/authSetup.ts',
  globalTeardown: '../hooks/cleanup.ts',
});
```

### 3.2 Environment Configuration

Create `e2e/config/environments.ts`:

```typescript
export const testEnvironments = {
  development: {
    baseURL: 'http://localhost:5173',
    apiURL: 'http://localhost:5001',
    supabaseURL: process.env.VITE_SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY,
  },
  staging: {
    baseURL: 'https://staging.account-v2.firebaseapp.com',
    apiURL: 'https://staging-api.account-v2.firebaseapp.com',
    supabaseURL: process.env.STAGING_SUPABASE_URL,
    supabaseAnonKey: process.env.STAGING_SUPABASE_ANON_KEY,
  },
  production: {
    baseURL: 'https://account-v2.web.app',
    apiURL: 'https://api.account-v2.web.app',
    supabaseURL: process.env.PROD_SUPABASE_URL,
    supabaseAnonKey: process.env.PROD_SUPABASE_ANON_KEY,
  },
};
```

### 3.3 Test Data Factory

Create `e2e/utils/dataFactory.ts`:

```typescript
import { faker } from '@faker-js/faker';

export class DataFactory {
  static createTestUser() {
    return {
      email: `test-${faker.internet.email()}`,
      password: 'TestPassword123!',
      name: faker.person.fullName(),
    };
  }

  static createExpense(overrides = {}) {
    return {
      amount: faker.number.float({ min: 1, max: 1000, precision: 0.01 }),
      description: faker.lorem.words(3),
      category: faker.helpers.arrayElement(['food', 'transport', 'housing', 'entertainment']),
      date: faker.date.past().toISOString().split('T')[0],
      account: 'Main Account',
      ...overrides,
    };
  }

  static createCategory(overrides = {}) {
    return {
      name: faker.commerce.productName(),
      color: faker.internet.color(),
      budget: faker.number.float({ min: 100, max: 5000, precision: 0.01 }),
      ...overrides,
    };
  }

  static createAccount(overrides = {}) {
    return {
      name: `${faker.finance.accountName()} ${faker.string.alphanumeric(4)}`,
      type: faker.helpers.arrayElement(['checking', 'savings', 'credit']),
      balance: faker.number.float({ min: 0, max: 10000, precision: 0.01 }),
      ...overrides,
    };
  }
}
```

---

## 🎯 Phase 4: Priority Test Cases (2-3 days)

### 4.1 Critical Path Tests (Implement First)

#### 4.1.1 Authentication Flow

Create `e2e/tests/auth/login.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../../pages/LoginPage';
import { DataFactory } from '../../utils/dataFactory';

test.describe('Authentication', () => {
  let loginPage: LoginPage;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    await page.goto('/');
  });

  test('should allow user to login with valid credentials', async ({ page }) => {
    const user = DataFactory.createTestUser();
    
    await loginPage.login(user.email, user.password);
    
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await loginPage.login('invalid@test.com', 'wrongpassword');
    
    await expect(loginPage.errorMessage).toBeVisible();
    await expect(loginPage.errorMessage).toContainText('Invalid credentials');
  });

  test('should handle session persistence', async ({ page, context }) => {
    const user = DataFactory.createTestUser();
    
    await loginPage.login(user.email, user.password);
    await page.reload();
    
    await expect(page).toHaveURL('/dashboard');
  });
});
```

#### 4.1.2 Expense CRUD Operations

Create `e2e/tests/expenses/crud.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { ExpensePage } from '../../pages/ExpensePage';
import { DataFactory } from '../../utils/dataFactory';

test.describe('Expense Management', () => {
  let expensePage: ExpensePage;

  test.beforeEach(async ({ page }) => {
    expensePage = new ExpensePage(page);
    await page.goto('/expenses');
    await expensePage.waitForLoad();
  });

  test('should create a new expense', async ({ page }) => {
    const expenseData = DataFactory.createExpense();
    
    await expensePage.createExpense(expenseData);
    
    await expect(page).toHaveURL('/expenses');
    await expect(expensePage.getExpenseRow(expenseData.description)).toBeVisible();
    await expect(expensePage.getExpenseCell(expenseData.description, 'amount')).toContainText(expenseData.amount.toString());
  });

  test('should edit an existing expense', async ({ page }) => {
    const originalData = DataFactory.createExpense();
    const updatedData = DataFactory.createExpense();
    
    await expensePage.createExpense(originalData);
    await expensePage.editExpense(originalData.description, updatedData);
    
    await expect(expensePage.getExpenseRow(updatedData.description)).toBeVisible();
    await expect(expensePage.getExpenseRow(originalData.description)).not.toBeVisible();
  });

  test('should delete an expense', async ({ page }) => {
    const expenseData = DataFactory.createExpense();
    
    await expensePage.createExpense(expenseData);
    await expensePage.deleteExpense(expenseData.description);
    
    await expect(expensePage.getExpenseRow(expenseData.description)).not.toBeVisible();
  });

  test('should filter expenses by category', async ({ page }) => {
    const foodExpense = DataFactory.createExpense({ category: 'food' });
    const transportExpense = DataFactory.createExpense({ category: 'transport' });
    
    await expensePage.createExpense(foodExpense);
    await expensePage.createExpense(transportExpense);
    
    await expensePage.filterByCategory('food');
    
    await expect(expensePage.getExpenseRow(foodExpense.description)).toBeVisible();
    await expect(expensePage.getExpenseRow(transportExpense.description)).not.toBeVisible();
  });
});
```

#### 4.1.3 Category Management

Create `e2e/tests/categories/crud.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { CategoryPage } from '../../pages/CategoryPage';
import { DataFactory } from '../../utils/dataFactory';

test.describe('Category Management', () => {
  let categoryPage: CategoryPage;

  test.beforeEach(async ({ page }) => {
    categoryPage = new CategoryPage(page);
    await page.goto('/categories');
  });

  test('should create a new category', async ({ page }) => {
    const categoryData = DataFactory.createCategory();
    
    await categoryPage.createCategory(categoryData);
    
    await expect(categoryPage.getCategoryRow(categoryData.name)).toBeVisible();
    await expect(categoryPage.getCategoryColor(categoryData.name)).toHaveAttribute('style', expect.stringContaining(categoryData.color));
  });

  test('should auto-assign colors to categories', async ({ page }) => {
    const categories = [
      DataFactory.createCategory({ name: 'Food' }),
      DataFactory.createCategory({ name: 'Transport' }),
      DataFactory.createCategory({ name: 'Housing' }),
    ];
    
    for (const category of categories) {
      await categoryPage.createCategory(category);
    }
    
    await categoryPage.autoColorCategories();
    
    // Verify colors are different
    const colors = await Promise.all(
      categories.map(cat => categoryPage.getCategoryColor(cat.name).getAttribute('style'))
    );
    
    const uniqueColors = new Set(colors);
    expect(uniqueColors.size).toBeGreaterThan(1);
  });
});
```

### 4.2 Page Object Models

Create `e2e/pages/BasePage.ts`:

```typescript
import { Page, Locator } from '@playwright/test';

export class BasePage {
  readonly page: Page;
  readonly loadingSpinner: Locator;
  readonly notifications: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"]');
    this.notifications = page.locator('[data-testid="notification"]');
  }

  async waitForLoad() {
    await this.page.waitForLoadState('networkidle');
    await expect(this.loadingSpinner).not.toBeVisible({ timeout: 10000 });
  }

  async getNotificationText(): Promise<string> {
    await this.notifications.waitFor({ state: 'visible' });
    return this.notifications.textContent() || '';
  }

  async waitForNotification(message: string) {
    await this.page.waitForSelector(`[data-testid="notification"]:has-text("${message}")`);
  }
}
```

Create `e2e/pages/LoginPage.ts`:

```typescript
import { Page, Locator } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly errorMessage: Locator;
  readonly googleLoginButton: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.locator('input[name="email"]');
    this.passwordInput = page.locator('input[name="password"]');
    this.loginButton = page.locator('button[type="submit"]');
    this.errorMessage = page.locator('[data-testid="error-message"]');
    this.googleLoginButton = page.locator('[data-testid="google-login"]');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.loginButton.click();
    await this.waitForLoad();
  }

  async loginWithGoogle() {
    await this.googleLoginButton.click();
    // Handle OAuth flow implementation
  }
}
```

---

## 🔗 Phase 5: Integration Strategy (2-3 days)

### 5.1 CI/CD Integration

Create `.github/workflows/e2e-tests.yml`:

```yaml
name: E2E Tests

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]
  workflow_dispatch:

jobs:
  e2e-tests:
    timeout-minutes: 30
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright Browsers
        run: npx playwright install --with-deps

      - name: Start backend services
        run: |
          cd functions
          npm ci
          npm run build
          npm run serve &
          sleep 30

      - name: Run E2E tests
        run: npm run test:e2e:ci
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
          VITE_NEST_API_URL: ${{ secrets.VITE_NEST_API_URL }}

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30

      - name: Upload test videos
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-videos
          path: test-results/
          retention-days: 7
```

### 5.2 Docker Test Environment

Create `docker-compose.e2e.yml`:

```yaml
version: '3.8'
services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.e2e
    ports:
      - "5173:5173"
    environment:
      - VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
      - VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
      - VITE_NEST_API_URL=http://backend:5001
    depends_on:
      - backend
      - supabase

  backend:
    build: ./functions
    ports:
      - "5001:5001"
    environment:
      - SUPABASE_URL=${SUPABASE_URL}
      - SUPABASE_SERVICE_KEY=${SUPABASE_SERVICE_KEY}
    depends_on:
      - supabase

  supabase:
    image: supabase/postgres:15
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=test_db
    volumes:
      - supabase_data:/var/lib/postgresql/data

volumes:
  supabase_data:
```

### 5.3 Integration with Existing Jest Tests

Create `e2e/utils/apiHelpers.ts`:

```typescript
import { APIRequestContext, expect } from '@playwright/test';
import { DataFactory } from './dataFactory';

export class APIHelpers {
  constructor(private request: APIRequestContext) {}

  async createTestUser(userData?: any) {
    const user = userData || DataFactory.createTestUser();
    const response = await this.request.post('/api/auth/register', { data: user });
    expect(response.ok()).toBeTruthy();
    return { ...user, id: (await response.json()).id };
  }

  async createExpense(expenseData: any, userId: string) {
    const expense = DataFactory.createExpense(expenseData);
    const response = await this.request.post(`/api/expenses`, {
      data: { ...expense, userId }
    });
    expect(response.ok()).toBeTruthy();
    return { ...expense, id: (await response.json()).id };
  }

  async cleanupTestData(userId: string) {
    await this.request.delete(`/api/test-data/cleanup`, {
      data: { userId }
    });
  }
}
```

---

## ⚠️ Phase 6: Risk Mitigation

### 6.1 Common Issues & Solutions

| Risk | Impact | Mitigation Strategy |
|------|--------|-------------------|
| **Flaky tests** | High | - Use explicit waits (`waitForSelector`) <br> - Implement retry logic <br> - Use test data factory for consistent data <br> - Isolate tests (cleanup before/after) |
| **Authentication tokens** | High | - Use environment-specific tokens <br> - Implement token refresh logic <br> - Store secrets in GitHub Actions secrets |
| **Browser compatibility** | Medium | - Test on all target browsers <br> - Use Playwright's cross-browser support <br> - Monitor browser-specific failures |
| **CI/CD performance** | Medium | - Run tests in parallel <br> - Use caching for dependencies <br> - Only run E2E on critical paths |
| **Test data management** | High | - Implement test data isolation <br> - Use transaction rollback <br> - Clean up after each test |

### 6.2 Performance Optimization

```typescript
// e2e/config/playwright.config.ts (performance optimizations)
export default defineConfig({
  // ... existing config
  
  workers: process.env.CI ? 4 : undefined, // Parallel execution
  
  use: {
    // Reduce video recording overhead
    video: process.env.CI ? 'retain-on-failure' : 'off',
    
    // Optimize screenshot settings
    screenshot: process.env.CI ? 'only-on-failure' : 'off',
    
    // Reduce trace overhead
    trace: process.env.CI ? 'on-first-retry' : 'off',
  },
  
  // Optimize test execution
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        // Reduce animation delays
        navigationTimeout: 10000,
        actionTimeout: 5000,
      },
    },
    // ... other browsers
  ],
});
```

### 6.3 Monitoring & Alerting

```typescript
// e2e/utils/testHelpers.ts
export class TestHelpers {
  static async capturePerformanceMetrics(page: Page, testName: string) {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByType('paint')[0]?.startTime,
        firstContentfulPaint: performance.getEntriesByType('paint')[1]?.startTime,
      };
    });

    // Log metrics for monitoring
    console.log(`Performance metrics for ${testName}:`, metrics);
    
    // Assert on performance thresholds
    expect(metrics.domContentLoaded).toBeLessThan(3000);
    expect(metrics.firstContentfulPaint).toBeLessThan(2000);
  }
}
```

---

## 📅 Implementation Timeline

| Phase | Duration | Dependencies | Deliverables |
|-------|----------|--------------|--------------|
| **Phase 1: Setup** | 1-2 days | None | Playwright installed, scripts configured |
| **Phase 2: Structure** | 1 day | Phase 1 | Complete directory structure created |
| **Phase 3: Configuration** | 1 day | Phase 1 | Playwright config, environments, data factory |
| **Phase 4: Priority Tests** | 2-3 days | Phase 3 | Auth, expenses, categories tests implemented |
| **Phase 5: Integration** | 2-3 days | Phase 4 | CI/CD pipeline, Docker environment, API helpers |
| **Phase 6: Monitoring** | 1-2 days | Phase 5 | Performance metrics, risk mitigation in place |

**Total Timeline: 8-14 days**

---

## 🚀 Quick Start Commands

```bash
# 1. Install everything
npm install --save-dev @playwright/test @faker-js/faker @testing-library/react @testing-library/jest-dom

# 2. Initialize Playwright
npx playwright install && npx playwright install --with-deps

# 3. Run first test (after creating basic structure)
npm run e2e:codegen http://localhost:5173

# 4. Run all tests
npm run e2e

# 5. Debug tests
npm run e2e:debug

# 6. View reports
npm run e2e:report
```

---

## 📋 Success Criteria

- [ ] All critical user journeys automated
- [ ] Tests pass consistently across browsers
- [ ] CI/CD pipeline runs E2E tests on PRs
- [ ] Test execution time < 10 minutes
- [ ] Coverage of > 80% critical paths
- [ ] Performance thresholds enforced
- [ ] Test data properly isolated
- [ ] Failure debugging with videos/screenshots

---

## 🎯 Next Steps

1. **Start with Phase 1**: Run the installation commands
2. **Create basic test structure**: Copy the directory blueprint
3. **Implement smoke tests**: Focus on auth + expense creation
4. **Set up CI**: Create the GitHub Actions workflow
5. **Expand coverage**: Add remaining critical paths
6. **Monitor & optimize**: Review performance and flaky tests

This plan provides a complete, actionable roadmap for implementing comprehensive E2E testing for the Account v2 application. Start with Phase 1 and work through each phase systematically.