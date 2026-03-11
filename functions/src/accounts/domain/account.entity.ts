export interface AccountProps {
  id: string;
  name: string;
  ownerId: string;
  description?: string | null;
  initialBalance?: bigint;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Account {
  public readonly id: string;
  public readonly name: string;
  public readonly ownerId: string;
  public readonly description: string | null;
  public readonly initialBalance: bigint;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: AccountProps) {
    this.id = props.id;
    this.name = props.name;
    this.ownerId = props.ownerId;
    this.description = props.description ?? null;
    this.initialBalance = props.initialBalance ?? 0n;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }
}
