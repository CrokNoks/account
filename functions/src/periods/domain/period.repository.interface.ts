import { Period } from './period.entity';
import { BudgetInstance } from '../../budgets/domain/budget-instance.entity';
import { Transaction } from '../../transactions/domain/transaction.entity';

/** Une bascule à écrire : clôture de `closedId` puis ouverture de `opened` et de ses budgets. */
export interface PeriodSwitchWrite {
  closedId: string;
  /** Nouvelle fin de la période close (la veille de la déclencheuse). */
  closeEnd: Date;
  opened: Period;
  budgets: BudgetInstance[];
}

export interface PeriodSwitchWriteResult {
  /** Faux si une autre bascule est passée avant : les lignes sont écrites sans bascule. */
  switched: boolean;
  /** `pending` récurrentes réellement supprimées (nettoyage de l'import ; 0 si la bascule est perdue). */
  removed: number;
}

export abstract class PeriodRepository {
  abstract findById(id: string): Promise<Period | null>;
  abstract findLastByAccount(accountId: string): Promise<Period | null>;
  abstract findAllByAccount(accountId: string): Promise<Period[]>;
  abstract save(period: Period): Promise<void>;
  /**
   * Crée la période, ses budgets et les transactions issues des récurrentes dans
   * une seule transaction base de données, en désactivant les autres périodes
   * actives du compte : tout est écrit, ou rien. Lève `ConflictError` si deux
   * budgets visent la même catégorie.
   */
  abstract createWithBudgets(
    period: Period,
    budgets: BudgetInstance[],
    transactions: Transaction[],
  ): Promise<void>;
  /**
   * Bascule atomique (fonction SQL `apply_period_switches`) : verrouille l'active,
   * clôt/ouvre les périodes dans l'ordre, écrit les transactions et rattache les
   * transactions déjà saisies, ou ne change rien (erreur). Si l'active n'est plus
   * `expectedActiveId` (déclenchement concurrent), seules les transactions sont
   * écrites, sans période planifiée : `switched: false`.
   * `generated` (récurrentes injectées, prochaine paie) n'est écrit que si la bascule a lieu.
   * `removePendingIds` : `pending` du compte à supprimer dans la même transaction, seulement
   * si la bascule a lieu ; une ligne n'étant plus `pending` n'est pas supprimée.
   * `update` : mode modification, les lignes de `transactions` doivent exister (verrou puis
   * vérification dans la base) ; sinon rien n'est écrit et l'erreur est NotFound.
   */
  abstract applyPeriodSwitches(
    accountId: string,
    expectedActiveId: string,
    switches: PeriodSwitchWrite[],
    transactions: Transaction[],
    generated: Transaction[],
    removePendingIds?: string[],
    update?: boolean,
  ): Promise<PeriodSwitchWriteResult>;
  abstract delete(id: string): Promise<void>;
}
