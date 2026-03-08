import { Period } from './period.entity';

export abstract class PeriodRepository {
  abstract findById(id: string): Promise<Period | null>;
  abstract findLastByAccount(accountId: string): Promise<Period | null>;
  abstract findAllByAccount(accountId: string): Promise<Period[]>;
  abstract save(period: Period): Promise<void>;
  abstract delete(id: string): Promise<void>;
}
