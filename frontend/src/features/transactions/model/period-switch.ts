/**
 * Bascule de période déclenchée par le serveur (catégorie « déclencheur de période »).
 * Le serveur la joint à la réponse d'une création, d'une modification, d'une
 * modification en lot (objet) ou d'un import (tableau, portée par chaque élément).
 */
export interface PeriodSwitch {
  closed: { id: string; startDate: string; endDate: string };
  opened: { id: string; startDate: string; endDate: string };
  /** Nombre de bascules (un import peut en enchaîner plusieurs) ; closed/opened décrivent la dernière. */
  count: number;
  /** La transaction a pris la date du jour en sortant du pending. */
  dateChanged: boolean;
  /** Import : récurrentes en attente supprimées car leur équivalent est importé. */
  removedPending?: number;
  /** Import : récurrentes encore en attente dans la période clôturée. */
  remainingPending?: number;
}

/** Lit la bascule d'une réponse de l'API (objet ou tableau), `null` s'il n'y en a pas. */
export function extractPeriodSwitch(response: unknown): PeriodSwitch | null {
  const holder = Array.isArray(response) ? response.find((item) => item?.periodSwitch) : response;
  const value = (holder as { periodSwitch?: PeriodSwitch } | null | undefined)?.periodSwitch;
  return value && value.opened && value.closed ? value : null;
}
