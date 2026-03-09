export interface AccountShareProps {
  id?: string;
  accountId: string;
  userId: string;
  userEmail?: string;
  permission: 'read' | 'write';
  createdAt?: Date;
}

export class AccountShare {
  public readonly id?: string;
  public readonly accountId: string;
  public readonly userId: string;
  public readonly userEmail?: string;
  public readonly permission: 'read' | 'write';
  public readonly createdAt: Date;

  constructor(props: AccountShareProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.userId = props.userId;
    this.userEmail = props.userEmail;
    this.permission = props.permission;
    this.createdAt = props.createdAt ?? new Date();
  }
}
