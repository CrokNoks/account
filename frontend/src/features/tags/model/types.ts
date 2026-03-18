export interface Tag {
  id: string;
  accountId: string;
  name: string;
  color?: string;
}

export interface TagSummary {
  tagId: string;
  name: string;
  color: string;
  transactionCount: number;
  totalAmount: string;
}

export interface TagCategoryBreakdown {
  categoryId: string | null;
  name: string;
  amount: string;
  percentage: number;
}

export interface TagRecentTransaction {
  id: string;
  description: string;
  date: string;
  amount: string;
}

export interface TagDetails {
  summary: TagSummary;
  categoryBreakdown: TagCategoryBreakdown[];
  recentTransactions: TagRecentTransaction[];
}

export interface TagDetail {
  tag: Tag;
  totalAmount: string;
  transactionCount: number;
  transactions: any[];
}
