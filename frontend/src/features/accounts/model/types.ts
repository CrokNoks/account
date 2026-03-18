export interface Account {
  id: string;
  name: string;
  type: string;
  description: string | null;
  currency: string;
  initialBalance: string;
  balance?: string;
}

export interface AccountShare {
  id: string;
  accountId: string;
  userEmail: string;
  role: 'owner' | 'viewer' | 'editor';
  createdAt: string;
}
