export enum CategoryType {
  EXPENSE = 'expense',
  INCOME = 'income',
  TRANSFER = 'transfer',
  SAVINGS = 'savings',
}

export interface CategoryProps {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  type: CategoryType;
  accountId?: string | null;
  budget?: bigint | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Category {
  public readonly id: string;
  public readonly name: string;
  public readonly description?: string | null;
  public readonly color: string;
  public readonly type: CategoryType;
  public readonly accountId?: string | null;
  public readonly budget?: bigint | null;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: CategoryProps) {
    this.id = props.id;
    this.name = props.name;
    this.description = props.description;
    this.color = props.color;
    this.type = props.type;
    this.accountId = props.accountId;
    this.budget = props.budget;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.validate();
  }

  private validate() {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Category name is required');
    }
    if (!Object.values(CategoryType).includes(this.type)) {
      throw new Error('Invalid category type');
    }
    if (this.color && !/^#[0-9A-Fa-f]{6}$/.test(this.color)) {
      throw new Error('Invalid color format (hex required)');
    }
  }

  static create(
    props: Omit<CategoryProps, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): Category {
    const now = new Date();
    return new Category({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: props.createdAt || now,
      updatedAt: props.updatedAt || now,
    });
  }
}
