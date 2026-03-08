export interface PeriodProps {
  id: string;
  accountId: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Period {
  public readonly id: string;
  public readonly accountId: string;
  public readonly startDate: Date;
  public readonly endDate: Date;
  public readonly isActive: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: PeriodProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.validate();
  }

  private validate() {
    if (!this.accountId) throw new Error('Account ID is required');
    if (this.endDate <= this.startDate) {
      throw new Error('End date must be after start date');
    }
  }

  static create(props: Omit<PeriodProps, 'id' | 'createdAt' | 'updatedAt' | 'isActive'> & { id?: string; createdAt?: Date; updatedAt?: Date; isActive?: boolean }): Period {
    const now = new Date();
    return new Period({
      ...props,
      id: props.id || crypto.randomUUID(),
      isActive: props.isActive ?? true,
      createdAt: props.createdAt || now,
      updatedAt: props.updatedAt || now,
    });
  }
}
