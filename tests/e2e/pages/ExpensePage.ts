import { test, expect } from '@playwright/test';

// Expense Page Object Model for testing React Admin components
export class ExpensePage {
  constructor(private page: any) {}

  async goto() {
    await this.page.goto('/expenses');
  }

  async createExpense(data: {
    amount: number;
    category: string;
    description: string;
    date: string;
  }) {
    // Navigate to create page
    await this.page.locator('a[data-testid="create-expense-btn"]').click();
    
    // Fill amount
    await this.page.locator('input[name="amount"]').fill(data.amount.toString());
    
    // Select category (React Admin ReferenceField)
    await this.page.locator('[data-testid="category-field"]').click();
    await this.page.locator(`option[value="${data.category}"]`).click();
    
    // Fill description
    await this.page.locator('textarea[name="description"]').fill(data.description);
    
    // Set date
    await this.page.locator('input[name="date"]').fill(data.date);
    
    // Save expense
    await this.page.locator('button[type="submit"]').click();
    
    // Wait for success message
    await expect(this.page.locator('text=Expense created successfully')).toBeVisible();
    
    // Navigate back to list
    await expect(this.page).toHaveURL('/expenses');
  }

  async searchExpenses(query: string) {
    await this.page.locator('input[placeholder*="Search" i]').fill(query);
    
    // Wait for debounced search
    await this.page.waitForTimeout(500);
    
    // Verify results
    const searchResults = this.page.locator('[data-testid="expense-row"]');
    await expect(searchResults.first()).toContainText(query);
  }

  async filterByDateRange(fromDate: string, toDate: string) {
    await this.page.goto('/expenses');
    
    // Set date filters
    await this.page.locator('input[name="from_date"]').fill(fromDate);
    await this.page.locator('input[name="to_date"]').fill(toDate);
    
    // Apply filter
    await this.page.locator('button:has-text("Appliquer")').click();
    
    // Wait for filtered results
    await this.page.waitForLoadState('networkidle');
    
    // Verify filtered results
    const expenseRows = this.page.locator('[data-testid="expense-row"]');
    await expect(expenseRows.first()).toBeVisible();
  }

  async editExpense(id: string, data: {
    amount?: number;
    description?: string;
    date?: string;
  }) {
    // Navigate to edit page (assuming URL pattern)
    await this.page.goto(`/expenses/${id}/edit`);
    
    // Update fields if provided
    if (data.amount) {
      await this.page.locator('input[name="amount"]').clear();
      await this.page.locator('input[name="amount"]').fill(data.amount.toString());
    }
    
    if (data.description) {
      await this.page.locator('textarea[name="description"]').clear();
      await this.page.locator('textarea[name="description"]').fill(data.description);
    }
    
    if (data.date) {
      await this.page.locator('input[name="date"]').clear();
      await this.page.locator('input[name="date"]').fill(data.date);
    }
    
    // Save changes
    await this.page.locator('button[type="submit"]').click();
    
    // Wait for success
    await expect(this.page.locator('text=Expense updated successfully')).toBeVisible();
  }

  async deleteExpense(id: string) {
    await this.page.goto(`/expenses/${id}`);
    
    // Click delete button (React Admin usually has delete action)
    const deleteBtn = this.page.locator(`button[aria-label*="${id}"]`);
    await deleteBtn.click();
    
    // Confirm deletion
    const confirmBtn = this.page.locator('button:has-text("Confirmer")');
    await confirmBtn.click();
    
    // Should redirect back to list
    await expect(this.page).toHaveURL('/expenses');
  }
}