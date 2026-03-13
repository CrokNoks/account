export interface TagProps {
  id: string;
  accountId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Tag {
  public readonly id: string;
  public readonly accountId: string;
  public readonly name: string;
  public readonly color: string;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: TagProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.name = props.name;
    this.color = props.color;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.validate();
  }

  private validate() {
    if (!this.name || this.name.trim().length === 0) {
      throw new Error('Tag name is required');
    }
    if (this.color && !/^#[0-9A-Fa-f]{6}$/.test(this.color)) {
      throw new Error('Invalid color format (hex required)');
    }
    if (!this.accountId) {
      throw new Error('Account ID is required');
    }
  }

  static create(
    props: Omit<TagProps, 'id' | 'createdAt' | 'updatedAt'> & {
      id?: string;
      createdAt?: Date;
      updatedAt?: Date;
    },
  ): Tag {
    const now = new Date();
    return new Tag({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: props.createdAt || now,
      updatedAt: props.updatedAt || now,
    });
  }
}
