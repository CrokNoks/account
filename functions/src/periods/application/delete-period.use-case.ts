import { Injectable, Logger } from '@nestjs/common';
import { ensureBelongsToAccount } from '../../shared/domain/account-ownership';
import {
  PeriodDeletionPlan,
  PeriodRepository,
} from '../domain/period.repository.interface';

export interface DeletePeriodCommand {
  accountId: string;
  periodId: string;
}

/**
 * Suppression d'une période (spec suppression-periode-propre). La règle (périmètre des
 * suppressions, réouverture) est écrite une seule fois en SQL ; ce service vérifie que la
 * période est bien celle du compte, délègue, puis logue.
 */
@Injectable()
export class DeletePeriodUseCase {
  private readonly logger = new Logger(DeletePeriodUseCase.name);

  constructor(private readonly periodRepository: PeriodRepository) {}

  async execute(command: DeletePeriodCommand): Promise<void> {
    await this.ensureOwned(command);
    const result = await this.periodRepository.delete(command.periodId);

    // Mesure d'impact : sans libellé ni montant.
    this.logger.log({
      event: 'period_deleted',
      accountId: command.accountId,
      periodId: command.periodId,
      removedPending: result.removedPending,
      keptTransactions: result.keptTransactions,
      reopenedPeriodId: result.reopenedPeriodId,
      origin: result.origin,
    });
  }

  /** Ce que la suppression ferait ; n'écrit rien, n'engage pas la suppression. */
  async preview(command: DeletePeriodCommand): Promise<PeriodDeletionPlan> {
    await this.ensureOwned(command);
    return this.periodRepository.previewDelete(command.periodId);
  }

  private async ensureOwned(command: DeletePeriodCommand): Promise<void> {
    ensureBelongsToAccount(
      await this.periodRepository.findById(command.periodId),
      command.accountId,
      'Period',
    );
  }
}
