export interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: string;
  categoryId: string | null;
  predicted?: boolean;
  /** Set when the row cannot be imported (it is highlighted and never sent). */
  invalidReason?: 'amount' | 'date';
  /** Unchecked: not sent to the import (already present in the account by default; the user can check it again). */
  excluded?: boolean;
  /** Transaction of the account identical to this line (date, label). */
  duplicateOf?: { date: string; description: string };
  /** Transaction of the account with the same amount a few days apart (flag only, the line stays checked). */
  nearOf?: { date: string; description: string };
}

export type ImportStep = 'upload' | 'mapping' | 'validation';

export interface ImportMapping {
  date: string;
  description: string;
  amount: string;
  debit: string;
  credit: string;
}
