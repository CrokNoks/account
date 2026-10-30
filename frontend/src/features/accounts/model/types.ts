export interface Account {
  id: string;
  name: string;
  description: string | null;
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
