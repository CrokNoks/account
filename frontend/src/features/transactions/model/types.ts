export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string | null;
  periodId: string | null;
  date: string;
  description: string;
  amount: string;
  reconciled: boolean;
  pending: boolean;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  tagIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface FindTransactionsOptions {
  periodId?: string | null;
  search?: string;
  categoryId?: string | null;
  tagIds?: string; // Comma-separated string
  ids?: string; // Comma-separated transaction ids (exact selection)
  minAmount?: string;
  maxAmount?: string;
  reconciled?: boolean;
  pending?: boolean;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedTransactions {
  data: Transaction[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
