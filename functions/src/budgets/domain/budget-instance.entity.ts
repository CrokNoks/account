export interface BudgetInstanceProps {
  id: string;
  periodId: string;
  categoryId: string;
  amountAllocated: bigint;
  createdAt: Date;
  updatedAt: Date;
}

export class BudgetInstance {
  public readonly id: string;
  public readonly periodId: string;
  public readonly categoryId: string;
  public readonly amountAllocated: bigint;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: BudgetInstanceProps) {
    this.id = props.id;
    this.periodId = props.periodId;
    this.categoryId = props.categoryId;
    this.amountAllocated = props.amountAllocated;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.validate();
  }

  private validate() {
    if (!this.periodId) throw new Error('Period ID is required');
    if (!this.categoryId) throw new Error('Category ID is required');
    if (this.amountAllocated === undefined || this.amountAllocated === null) {
      throw new Error('Allocated amount is required');
    }
  }

  static create(
    props: Omit<BudgetInstanceProps, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): BudgetInstance {
    const now = new Date();
    return new BudgetInstance({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: props.createdAt || now,
      updatedAt: props.updatedAt || now,
    });
  }
}
