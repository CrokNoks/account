export interface TransactionProps {
  id: string;
  accountId: string;
  categoryId: string | null;
  periodId?: string | null;
  date: Date;
  description: string;
  amount: bigint;
  reconciled: boolean;
  paymentMethod?: string | null;
  notes?: string | null;
  metadata: Record<string, any> | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export class Transaction {
  public readonly id: string;
  public readonly accountId: string;
  public readonly categoryId: string | null;
  public readonly periodId?: string | null;
  public readonly date: Date;
  public readonly description: string;
  public readonly amount: bigint;
  public readonly reconciled: boolean;
  public readonly paymentMethod?: string | null;
  public readonly notes?: string | null;
  public readonly metadata: Record<string, any> | undefined;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: TransactionProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.categoryId = props.categoryId;
    this.periodId = props.periodId;
    this.date = props.date;
    this.description = props.description;
    this.amount = props.amount;
    this.reconciled = props.reconciled;
    this.paymentMethod = props.paymentMethod;
    this.notes = props.notes;
    this.metadata = props.metadata;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.validate();
  }

  private validate() {
    if (!this.accountId) throw new Error('Account ID is required');
    if (!this.description || this.description.trim().length === 0) {
      throw new Error('Description is required');
    }
    if (this.amount === undefined || this.amount === null) {
      throw new Error('Amount is required');
    }
  }

  static create(props: Omit<TransactionProps, 'id' | 'createdAt' | 'updatedAt'> & { id?: string; createdAt?: Date; updatedAt?: Date }): Transaction {
    const now = new Date();
    return new Transaction({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: props.createdAt || now,
      updatedAt: props.updatedAt || now,
      reconciled: props.reconciled ?? false,
      metadata: props.metadata || {},
    });
  }
}
