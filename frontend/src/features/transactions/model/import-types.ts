export interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  categoryId: string | null;
  predicted?: boolean;
  /** Set when the row cannot be imported (it is highlighted and never sent). */
  invalidReason?: 'amount' | 'date';
}

export type ImportStep = 'upload' | 'mapping' | 'validation';

export interface ImportMapping {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
}
