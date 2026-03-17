export interface SmartRuleProps {
  id: string;
  accountId: string;
  pattern: string;
  categoryId: string | null;
  tagIds: string[];
  priority: number;
  createdAt: Date;
  updatedAt: Date;
}

export class SmartRule {
  public readonly id: string;
  public readonly accountId: string;
  public readonly pattern: string;
  public readonly categoryId: string | null;
  public readonly tagIds: string[];
  public readonly priority: number;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: SmartRuleProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.pattern = props.pattern;
    this.categoryId = props.categoryId;
    this.tagIds = props.tagIds || [];
    this.priority = props.priority;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  public matches(description: string): boolean {
    const lowerDesc = description.toLowerCase();
    const lowerPattern = this.pattern.toLowerCase();
    
    // Simple substring match for now, could be regex later
    return lowerDesc.includes(lowerPattern);
  }

  static create(props: Omit<SmartRuleProps, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): SmartRule {
    const now = new Date();
    return new SmartRule({
      ...props,
      id: props.id || crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    });
  }
}
