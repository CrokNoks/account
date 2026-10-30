import { Injectable } from '@nestjs/common';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { TransactionRepository } from '../../transactions/domain/transaction.repository.interface';
import {
  startOfDay,
  subDays,
  addDays,
  eachDayOfInterval,
  format,
} from 'date-fns';

export interface NetWorthDataPoint {
  date: string;
  amount: string;
}

export interface NetWorthResponse {
  currentTotal: string;
  history: NetWorthDataPoint[];
}

@Injectable()
export class GetNetWorthUseCase {
  constructor(
    private readonly accountRepository: AccountRepository,
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(): Promise<NetWorthResponse> {
    // 1. Get all accounts for this user
    // Note: RLS ensures we only get accounts the user has access to
    const accounts = await this.accountRepository.findAllForUser();
    if (accounts.length === 0) {
      return { currentTotal: '0', history: [] };
    }

    // 2. Un seul chargement des transactions par compte. Le solde de fin de
    // journée de chaque jour des 30 derniers jours (aujourd'hui inclus) est
    // calculé en appliquant les transactions jour par jour ; les transactions
    // datées après aujourd'hui ne comptent ni dans le total ni dans l'historique.
    const today = startOfDay(new Date());
    const startDate = subDays(today, 30);
    const endOfToday = addDays(today, 1); // exclu
    const days = eachDayOfInterval({ start: startDate, end: today });
    const dayKeys = days.map((day) => format(day, 'yyyy-MM-dd'));

    let currentTotal = BigInt(0);
    const totalByDay = new Map<string, bigint>(
      dayKeys.map((key) => [key, BigInt(0)]),
    );

    for (const account of accounts) {
      const transactions =
        await this.transactionRepository.findAllByAccountUnpaginated(
          account.id,
        );

      // Solde au début de la fenêtre (fin de la veille du premier jour)
      let running = account.initialBalance;
      const deltaByDay = new Map<string, bigint>();
      for (const t of transactions) {
        if (t.date >= endOfToday) continue;
        if (t.date < startDate) {
          running += t.amount;
          continue;
        }
        const key = format(t.date, 'yyyy-MM-dd');
        deltaByDay.set(key, (deltaByDay.get(key) ?? BigInt(0)) + t.amount);
      }

      for (const key of dayKeys) {
        running += deltaByDay.get(key) ?? BigInt(0);
        totalByDay.set(key, (totalByDay.get(key) ?? BigInt(0)) + running);
      }
      currentTotal += running;
    }

    // 3. Historique : un point par jour
    const history: NetWorthDataPoint[] = dayKeys.map((key) => ({
      date: key,
      amount: (totalByDay.get(key) ?? BigInt(0)).toString(),
    }));

    return {
      currentTotal: currentTotal.toString(),
      history,
    };
  }
}
