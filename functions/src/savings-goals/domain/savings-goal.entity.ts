export interface SavingsGoalProps {
  id: string;
  accountId: string;
  name: string;
  targetAmount: bigint;
  currentAmount: bigint;
  deadline: Date | null;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export class SavingsGoal {
  public readonly id: string;
  public readonly accountId: string;
  public readonly name: string;
  public readonly targetAmount: bigint;
  public readonly currentAmount: bigint;
  public readonly deadline: Date | null;
  public readonly color: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: SavingsGoalProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.name = props.name;
    this.targetAmount = props.targetAmount;
    this.currentAmount = props.currentAmount;
    this.deadline = props.deadline;
    this.color = props.color || '#3b82f6';
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.validate();
  }

  private validate() {
    if (!this.accountId) throw new Error('Account ID is required');
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Name is required');
    }
    if (this.targetAmount <= BigInt(0)) {
      throw new Error('Target amount must be positive');
    }
  }

  static create(props: Omit<SavingsGoalProps, 'id' | 'createdAt' | 'updatedAt' | 'currentAmount'> & { 
    id?: string, 
    currentAmount?: bigint 
  }): SavingsGoal {
    const now = new Date();
    return new SavingsGoal({
      ...props,
      id: props.id || crypto.randomUUID(),
      currentAmount: props.currentAmount || BigInt(0),
      createdAt: now,
      updatedAt: now,
    });
  }
}
