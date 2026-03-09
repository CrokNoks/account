export interface RecurringTransactionProps {
  id: string;
  accountId: string;
  categoryId: string | null;
  description: string;
  amount: bigint;
  dayOfMonth: number;
  createdAt: Date;
  updatedAt: Date;
}

export class RecurringTransaction {
  public readonly id: string;
  public readonly accountId: string;
  public readonly categoryId: string | null;
  public readonly description: string;
  public readonly amount: bigint;
  public readonly dayOfMonth: number;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: RecurringTransactionProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.categoryId = props.categoryId;
    this.description = props.description;
    this.amount = props.amount;
    this.dayOfMonth = props.dayOfMonth;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.validate();
  }

  private validate() {
    if (!this.accountId) throw new Error('Account ID is required');
    if (!this.description || this.description.trim().length === 0) {
      throw new Error('Description is required');
    }
    if (this.dayOfMonth < 1 || this.dayOfMonth > 31) {
      throw new Error('Day of month must be between 1 and 31');
    }
  }

  static create(props: Omit<RecurringTransactionProps, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: Date; updatedAt?: Date }): RecurringTransaction {
    const now = new Date();
    return new RecurringTransaction({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: props.createdAt || now,
      updatedAt: props.updatedAt || now,
    });
  }
}
