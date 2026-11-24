import { randomUUID } from 'node:crypto';
import {
  DomainValidationError,
  PeriodBeforeExistingError,
  PeriodNotLatestError,
} from '../../shared/domain/errors';

export interface PeriodProps {
  id: string;
  accountId: string;
  startDate: Date;
  endDate: Date | null;
  /** Fin estimée, lue quand `endDate` est vide (période ouverte). Jamais écrite par l'API. */
  estimatedEndDate?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Period {
  public readonly id: string;
  public readonly accountId: string;
  public readonly startDate: Date;
  public readonly endDate: Date | null;
  public readonly estimatedEndDate: Date | null;
  public readonly isActive: boolean;
  public readonly createdAt: Date;
  public readonly updatedAt: Date;

  constructor(props: PeriodProps) {
    this.id = props.id;
    this.accountId = props.accountId;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.estimatedEndDate = props.estimatedEndDate ?? null;
    this.isActive = props.isActive;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
    this.validate();
  }

  private validate() {
    if (!this.accountId)
      throw new DomainValidationError('Account ID is required');
    if (this.endDate && this.endDate < this.startDate) {
      throw new DomainValidationError('End date must be after start date');
    }
  }

  public deactivate(): Period {
    return new Period({
      ...this,
      isActive: false,
      updatedAt: new Date(),
    });
  }

  static create(
    props: Omit<
      PeriodProps,
      'id' | 'createdAt' | 'updatedAt' | 'isActive' | 'endDate'
    > & {
      id?: string;
      endDate?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
      isActive?: boolean;
    },
  ): Period {
    const now = new Date();
    return new Period({
      ...props,
      id: props.id || randomUUID(),
      endDate: props.endDate ?? null,
      isActive: props.isActive ?? true,
      createdAt: props.createdAt || now,
      updatedAt: props.updatedAt || now,
    });
  }
}

/**
 * Règle unique « dernière période » : une autre période du compte commence
 * strictement après celle-ci (dates égales tolérées ici, le chevauchement est
 * refusé par la base). Une période active compte ses dépenses sans borne de fin :
 * elle ne doit donc jamais précéder une autre période.
 */
function hasNewerPeriod(period: Period, accountPeriods: Period[]): boolean {
  return accountPeriods.some(
    (p) =>
      p.id !== period.id &&
      p.accountId === period.accountId &&
      p.startDate > period.startDate,
  );
}

/** Une période inactive ne peut être (ré)activée que si c'est la dernière du compte. */
export function ensureCanBeActivated(
  before: Period,
  after: Period,
  accountPeriods: Period[],
): void {
  if (before.isActive || !after.isActive) return;
  if (hasNewerPeriod(after, accountPeriods)) throw new PeriodNotLatestError();
}

/** Une nouvelle période (active) ne peut pas commencer avant une période existante du compte. */
export function ensureCanBeCreated(
  period: Period,
  accountPeriods: Period[],
): void {
  if (period.isActive && hasNewerPeriod(period, accountPeriods))
    throw new PeriodBeforeExistingError();
}
