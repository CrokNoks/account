export interface Account {
  id: string;
  name: string;
  /** Propriétaire du compte : seul lui peut le modifier et le partager. */
  ownerId: string;
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
