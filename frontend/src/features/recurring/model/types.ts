export interface RecurringTransaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: string;
  dayOfMonth: number;
}

export interface CreateRecurringTransactionData {
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: string;
  dayOfMonth: number;
}

export interface DeleteRecurringTransactionData {
  accountId: string;
  id: string;
}

export interface UpdateRecurringTransactionData {
  accountId: string;
  id: string;
  data: {
    categoryId?: string | null;
    description?: string;
    amount?: string;
    dayOfMonth?: number;
  };
}
