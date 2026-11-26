import {
  occurrenceKey,
  settleOccurrences,
  SettleOccurrence,
  SettleTransaction,
} from './recurring-already-paid';

const d = (value: string) => new Date(value);

const paie = (
  date: string,
  over: Partial<SettleOccurrence> = {},
): SettleOccurrence => ({
  recurringId: 'r-paie',
  categoryId: 'c-salaire',
  description: 'Salaire',
  amount: 200000n,
  date: d(date),
  ...over,
});

const loyer = (
  date: string,
  over: Partial<SettleOccurrence> = {},
): SettleOccurrence => ({
  recurringId: 'r-loyer',
  categoryId: 'c-loyer',
  description: 'Loyer',
  amount: -80000n,
  date: d(date),
  ...over,
});

const tx = (
  id: string,
  date: string,
  over: Partial<SettleTransaction> = {},
): SettleTransaction => ({
  id,
  date: d(date),
  categoryId: 'c-salaire',
  description: 'Virement',
  amount: 200000n,
  ...over,
});

const known = new Set(['r-paie', 'r-loyer', 'r-loyer-2']);
const keyOf = (o: SettleOccurrence) => occurrenceKey(o.recurringId, o.date);

describe('settleOccurrences', () => {
  describe('lien (recurringId + échéance)', () => {
    it('règle critique : paie du 28 pointée le 26 règle l’échéance du 28', () => {
      const occ = paie('2026-11-28');
      const settled = settleOccurrences(
        [occ],
        [
          tx('t1', '2026-11-26', {
            recurringId: 'r-paie',
            dueDate: d('2026-11-28'),
          }),
        ],
        known,
      );

      expect(settled.get(keyOf(occ))).toEqual({
        txId: 't1',
        txDate: d('2026-11-26'),
      });
    });

    it('une transaction règle une seule occurrence : la paie du 28 suivant reste', () => {
      const a = paie('2026-11-28');
      const b = paie('2026-12-28');
      const settled = settleOccurrences(
        [a, b],
        [
          tx('t1', '2026-11-26', {
            recurringId: 'r-paie',
            dueDate: d('2026-11-28'),
          }),
        ],
        known,
      );

      expect(settled.has(keyOf(a))).toBe(true);
      expect(settled.has(keyOf(b))).toBe(false);
    });

    it('lit l’échéance, pas la date : loyer du 30/11 daté 01/12 règle le 30/11', () => {
      const nov = loyer('2026-11-30');
      const dec = loyer('2026-12-30');
      const settled = settleOccurrences(
        [nov, dec],
        [
          tx('t1', '2026-12-01', {
            recurringId: 'r-loyer',
            categoryId: 'c-loyer',
            amount: -80000n,
            dueDate: d('2026-11-30'),
          }),
        ],
        known,
      );

      expect(settled.get(keyOf(nov))?.txId).toBe('t1');
      expect(settled.has(keyOf(dec))).toBe(false);
    });

    it('transaction liée sans échéance (ancienne) à la même date : réglée (repli sur la date)', () => {
      const occ = paie('2026-11-28');
      const settled = settleOccurrences(
        [occ],
        [tx('t1', '2026-11-28', { recurringId: 'r-paie' })],
        known,
      );

      expect(settled.get(keyOf(occ))?.txId).toBe('t1');
    });

    it('transaction liée sans échéance redatée à 3 jours, même catégorie : réglée par équivalence', () => {
      const occ = paie('2026-11-28');
      const settled = settleOccurrences(
        [occ],
        [tx('t1', '2026-11-25', { recurringId: 'r-paie' })],
        known,
      );

      expect(settled.get(keyOf(occ))?.txId).toBe('t1');
    });

    it('transaction liée avec échéance : jamais appariée par équivalence à une autre échéance', () => {
      const occ = paie('2026-11-28');
      const settled = settleOccurrences(
        [occ],
        [
          tx('t1', '2026-11-26', {
            recurringId: 'r-paie',
            dueDate: d('2026-10-28'),
          }),
        ],
        known,
      );

      expect(settled.size).toBe(0);
    });

    it('transaction liée à une autre récurrente existante : jamais éligible à l’équivalence', () => {
      const occ = loyer('2026-11-30');
      const settled = settleOccurrences(
        [occ],
        [
          tx('t1', '2026-11-27', {
            recurringId: 'r-loyer-2',
            categoryId: 'c-loyer',
            amount: -80000n,
            dueDate: d('2026-11-27'),
          }),
        ],
        known,
      );

      expect(settled.size).toBe(0);
    });

    it('transaction liée à une récurrente supprimée : éligible à l’équivalence', () => {
      const occ = loyer('2026-11-30');
      const settled = settleOccurrences(
        [occ],
        [
          tx('t1', '2026-11-27', {
            recurringId: 'r-disparue',
            categoryId: 'c-loyer',
            amount: -80000n,
          }),
        ],
        known,
      );

      expect(settled.get(keyOf(occ))?.txId).toBe('t1');
    });
  });

  describe('équivalence (sans lien)', () => {
    const loyerTx = (id: string, date: string, over = {}) =>
      tx(id, date, { categoryId: 'c-loyer', amount: -80000n, ...over });

    it('règle à 7 jours', () => {
      const occ = loyer('2026-11-30');
      const settled = settleOccurrences(
        [occ],
        [loyerTx('t1', '2026-12-07')],
        known,
      );

      expect(settled.get(keyOf(occ))?.txId).toBe('t1');
    });

    it('ne règle pas à 8 jours', () => {
      const settled = settleOccurrences(
        [loyer('2026-11-30')],
        [loyerTx('t1', '2026-12-08')],
        known,
      );

      expect(settled.size).toBe(0);
    });

    it.each([
      ['signe opposé', { amount: 80000n }],
      ['autre catégorie', { categoryId: 'c-autre' }],
      ['sans catégorie', { categoryId: null }],
    ])('ne règle pas : %s', (_n, over) => {
      const settled = settleOccurrences(
        [loyer('2026-11-30')],
        [loyerTx('t1', '2026-11-30', over)],
        known,
      );

      expect(settled.size).toBe(0);
    });

    it('le montant n’est pas une condition', () => {
      const occ = loyer('2026-11-30');
      const settled = settleOccurrences(
        [occ],
        [loyerTx('t1', '2026-11-30', { amount: -81234n })],
        known,
      );

      expect(settled.has(keyOf(occ))).toBe(true);
    });

    it('récurrente sans catégorie : même jour, même montant, libellé contenu', () => {
      const occ = loyer('2026-11-30', { categoryId: null });
      const ok = tx('t1', '2026-11-30', {
        categoryId: null,
        description: 'PRLV LOYER nov',
        amount: -80000n,
      });

      expect(settleOccurrences([occ], [ok], known).has(keyOf(occ))).toBe(true);
      for (const bad of [
        { ...ok, description: 'Edf' },
        { ...ok, amount: -79999n },
        { ...ok, date: d('2026-11-29') },
      ]) {
        expect(settleOccurrences([occ], [bad], known).size).toBe(0);
      }
    });

    it('deux loyers à 27 et 30, une seule transaction le 28 : seul le 27 est réglé', () => {
      const a = loyer('2026-11-27');
      const b = loyer('2026-11-30', { recurringId: 'r-loyer-2' });
      const settled = settleOccurrences(
        [a, b],
        [loyerTx('t1', '2026-11-28')],
        known,
      );

      expect(settled.has(keyOf(a))).toBe(true);
      expect(settled.has(keyOf(b))).toBe(false);
    });

    it('deux transactions, deux loyers à 27 et 30 : les deux réglés sans croisement', () => {
      const a = loyer('2026-11-27');
      const b = loyer('2026-11-30', { recurringId: 'r-loyer-2' });
      const settled = settleOccurrences(
        [a, b],
        [loyerTx('t1', '2026-11-28'), loyerTx('t2', '2026-12-01')],
        known,
      );

      expect(settled.get(keyOf(a))?.txId).toBe('t1');
      expect(settled.get(keyOf(b))?.txId).toBe('t2');
    });

    it('le lien prime sur l’équivalence', () => {
      const occ = loyer('2026-11-30');
      const settled = settleOccurrences(
        [occ],
        [
          loyerTx('a-proche', '2026-11-30'),
          loyerTx('z-lie', '2026-12-05', {
            recurringId: 'r-loyer',
            dueDate: d('2026-11-30'),
          }),
        ],
        known,
      );

      expect(settled.get(keyOf(occ))?.txId).toBe('z-lie');
    });

    it('égalité d’écart : l’occurrence la plus tôt, puis la récurrente ; résultat identique à chaque appel', () => {
      const a = loyer('2026-11-27');
      const b = loyer('2026-11-29', { recurringId: 'r-loyer-2' });
      const run = () =>
        settleOccurrences([b, a], [loyerTx('t1', '2026-11-28')], known);

      const first = run();
      expect([...first.keys()]).toEqual([keyOf(a)]);
      expect([...run().keys()]).toEqual([...first.keys()]);
    });
  });

  it('sans transaction : rien, sans erreur', () => {
    expect(settleOccurrences([paie('2026-11-28')], [], known).size).toBe(0);
    expect(settleOccurrences([], [tx('t1', '2026-11-28')], known).size).toBe(0);
  });
});
