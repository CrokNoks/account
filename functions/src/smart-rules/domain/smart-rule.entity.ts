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
  public pattern: string;
  public categoryId: string | null;
  public tagIds: string[];
  public priority: number;
  public readonly createdAt: Date;
  public updatedAt: Date;

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

  public updatePattern(pattern: string) {
    this.pattern = pattern;
    this.touch();
  }

  public updateCategory(categoryId: string | null) {
    this.categoryId = categoryId;
    this.touch();
  }

  public updateTags(tagIds: string[]) {
    this.tagIds = tagIds;
    this.touch();
  }

  public updatePriority(priority: number) {
    this.priority = priority;
    this.touch();
  }

  private touch() {
    this.updatedAt = new Date();
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
