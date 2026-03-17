import { SmartRule } from './smart-rule.entity';

export interface SmartRuleRepository {
  findAllByAccount(accountId: string): Promise<SmartRule[]>;
  findById(id: string): Promise<SmartRule | null>;
  save(rule: SmartRule): Promise<void>;
  delete(id: string): Promise<void>;
}
