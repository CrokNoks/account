export interface LowPoint {
  /** ISO du jour, comme les événements de la courbe. */
  date: string;
  /** Solde de fin de journée, en centimes. */
  balance: bigint;
}

/**
 * Plus bas des soldes de fin de journée, d'aujourd'hui à la fin de l'horizon.
 * Les événements d'un même jour sont additionnés avant comparaison ; en cas d'égalité,
 * le premier jour est conservé. Un jour sans événement a le solde de la veille et ne
 * peut pas battre un solde déjà vu : seuls le jour 0 et les jours porteurs sont examinés.
 * `events` est trié par jour.
 */
export function computeLowPoint(
  startDay: Date,
  startBalance: bigint,
  events: { date: string; amount: bigint }[],
): LowPoint {
  const startIso = startDay.toISOString();
  let balance = startBalance;
  let best: LowPoint | null = null;
  let index = 0;

  // Événements d'aujourd'hui : le jour 0 est évalué après eux.
  while (index < events.length && events[index].date === startIso) {
    balance += events[index].amount;
    index++;
  }
  best = { date: startIso, balance };

  while (index < events.length) {
    const date = events[index].date;
    while (index < events.length && events[index].date === date) {
      balance += events[index].amount;
      index++;
    }
    if (balance < best.balance) best = { date, balance };
  }
  return best;
}
