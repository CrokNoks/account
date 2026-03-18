export interface SmartRule {
  id: string;
  accountId: string;
  pattern: string;
  categoryId: string | null;
  tagIds: string[];
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSmartRuleData {
  accountId: string;
  data: Partial<SmartRule>;
}

export interface UpdateSmartRuleData {
  accountId: string;
  id: string;
  data: Partial<SmartRule>;
}

export interface DeleteSmartRuleData {
  accountId: string;
  id: string;
}
