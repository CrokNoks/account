import * as natural from 'natural';
import { extractWords, NOISE_WORDS } from './description-words';
import { PredictCategoryUseCase } from './predict-category.use-case';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { MatchSmartRulesUseCase } from '../../smart-rules/application/match-smart-rules.use-case';
import { Transaction } from '../domain/transaction.entity';

describe('extractWords', () => {
  it('returns nothing for an empty description', () => {
    expect(extractWords('')).toEqual([]);
    expect(extractWords('   ')).toEqual([]);
  });

  it('removes accents before stemming (same stem with or without accent, any case)', () => {
    expect(extractWords('Électricité')).toEqual(['electricit']);
    expect(extractWords('ELECTRICITE')).toEqual(['electricit']);
    expect(extractWords('electricité')).toEqual(extractWords('ÉLECTRICITE'));
  });

  it('gives the same word to close French forms', () => {
    expect(extractWords('abonnements')).toEqual(extractWords('abonnement'));
    expect(extractWords('abonnement mobile')).toContain(
      extractWords('abonnements')[0],
    );
  });

  it('removes French stop words', () => {
    expect(extractWords('Électricité de la France')).not.toContain('de');
    expect(extractWords('de la et du pour')).toEqual([]);
  });

  it('keeps only the stems of the merchant in a multi-line bank label', () => {
    expect(
      extractWords('Paiement par carte\nX2909 E.Leclerc 24/10 - E.Leclerc'),
    ).toEqual(['leclerc', 'leclerc']);
  });

  it('gives the same words whatever the card, the date and the references', () => {
    expect(
      extractWords('Paiement par carte\nX0053 E.Leclerc 03/11 - E.Leclerc'),
    ).toEqual(
      extractWords(
        'Paiement par carte\nX2909 E.Leclerc 24/10/2026 - E.Leclerc',
      ),
    );
  });

  it('removes the noise on every line of a multi-line label', () => {
    expect(
      extractWords(
        'Prélèvement\nSEPA PRLV EDF\nRéf 99\nMDT FR12ZZZ123456 D12-3456789\nEchéance 12/10',
      ),
    ).toEqual(['edf']);
  });

  it('removes operation-type lines', () => {
    for (const line of [
      'Paiement par carte',
      'Prélèvement',
      'Virement émis',
      'Virement en votre faveur',
      'Virement reçu',
      'Retrait',
      'Cotisation',
      'Frais',
      'Échéance',
      'Remise',
      'Chèque',
    ]) {
      expect(extractWords(`${line}\nSpotify`)).toEqual(extractWords('Spotify'));
      expect(extractWords(line)).toEqual([]);
    }
  });

  it('removes card numbers, dates and SEPA identifiers', () => {
    expect(extractWords('X1234 Spotify')).toEqual(extractWords('Spotify'));
    expect(extractWords('Spotify 3/9')).toEqual(extractWords('Spotify'));
    expect(extractWords('Spotify 03/09/2026')).toEqual(extractWords('Spotify'));
    expect(extractWords('Spotify FR12ZZZABCDEF')).toEqual(
      extractWords('Spotify'),
    );
  });

  it('removes words with at least as many digits as letters, keeps the others', () => {
    expect(extractWords('q731bz5520 9876501234 d12 Spotify')).toEqual(
      extractWords('Spotify'),
    );
    expect(extractWords('1Password')).toHaveLength(1);
    expect(extractWords('bebe9')).toHaveLength(1);
  });

  it('lists the noise words explicitly', () => {
    expect([...NOISE_WORDS].sort()).toEqual(
      [
        'sepa',
        'prlv',
        'cb',
        'carte',
        'paiement',
        'prelevement',
        'virement',
        'emis',
        'recu',
        'faveur',
        'echeance',
        'ref',
        'mdt',
        'ou',
        'mme',
        'mlle',
      ].sort(),
    );
  });

  it.each([...NOISE_WORDS].filter((w) => w.length >= 2))(
    'ignores the noise word "%s"',
    (word) => {
      expect(extractWords(`${word} Spotify`)).toEqual(extractWords('Spotify'));
    },
  );
});

/**
 * CA8 — mesure hors ligne sur un jeu ANONYMISÉ : uniquement des noms de
 * commerçants ; cartes, dates et références sont inventées.
 */
describe('accuracy before / after (anonymised set)', () => {
  type Row = [description: string, category: string];

  // L'historique vient surtout d'une carte ; les libellés à prédire d'une autre.
  const card = (n: number, day: string, name: string, number = 2909) =>
    `Paiement par carte\nX${number} ${name} ${day} - ${name}`;
  const newCard = (day: string, name: string) => card(0, day, name, 530);

  const history: Row[] = [
    [card(1, '24/10', 'E.Leclerc'), 'courses'],
    [card(2, '12/09', 'E.Leclerc'), 'courses'],
    [card(3, '03/08', 'U Express'), 'courses'],
    [card(4, '11/07', 'Action'), 'courses'],
    [card(5, '05/10', 'Mj Restauration'), 'resto'],
    [card(5, '19/10', 'Mj Restauration'), 'resto'],
    [card(6, '07/10', "McDonald's"), 'resto'],
    [card(7, '09/10', 'O Fournil des Amis'), 'resto'],
    [card(8, '15/09', "L'épi d'or"), 'resto'],
    [card(9, '17/09', 'Giband'), 'resto'],
    [card(10, '19/09', 'Pizzeria Exemple'), 'resto'],
    [card(11, '21/09', 'Snack Exemple'), 'resto'],
    [card(12, '02/10', 'Pharmacie Exemple'), 'sante'],
    [card(13, '03/09', 'SG Santé'), 'sante'],
    [
      'Prélèvement\nSEPA Électricité de France\nRéf Q731BZ5520 FR12ZZZ123456',
      'energie',
    ],
    ['Prélèvement\nSEPA Primagaz\nRéf 9876501234', 'energie'],
    ['Prélèvement\nSEPA Orange abonnement mobile\nRéf 8851', 'telecom'],
    ['Prélèvement\nSEPA Orange fibre\nRéf 8852', 'telecom'],
    [card(14, '01/10', 'Spotify'), 'loisirs'],
    [card(15, '01/09', 'Canal+'), 'loisirs'],
    [card(16, '04/10', 'Amazon Prime'), 'loisirs'],
    [card(17, '06/10', '1Password'), 'loisirs'],
    ['Prélèvement\nSEPA MMA assurance auto\nRéf 7701', 'assurance'],
    ['Prélèvement\nSEPA EPS surveillance\nRéf 7702', 'assurance'],
    [card(18, '08/10', 'Bip&Go'), 'transport'],
    [card(19, '10/10', 'Boulangerie Exemple'), 'resto'],
    [card(20, '11/10', 'Brasserie Exemple'), 'resto'],
    [card(21, '12/10', 'Crêperie Exemple'), 'resto'],
  ];

  const toPredict: Row[] = [
    [newCard('03/11', 'E.Leclerc'), 'courses'],
    [newCard('04/11', 'U Express'), 'courses'],
    [newCard('05/11', 'Action'), 'courses'],
    [newCard('06/11', 'McDonald'), 'resto'],
    [newCard('07/11', 'Mj Restauration'), 'resto'],
    [newCard('08/11', 'Giband'), 'resto'],
    [newCard('09/11', 'Pharmacie Exemple'), 'sante'],
    ['ELECTRICITE', 'energie'],
    [newCard('13/11', 'CREPERIE'), 'resto'],
    ['Prélèvement\nSEPA Primagaz\nRéf 1122334455', 'energie'],
    ['Prélèvement\nSEPA Orange abonnements mobile\nRéf 8860', 'telecom'],
    [newCard('10/11', 'Spotify'), 'loisirs'],
    [newCard('11/11', 'Amazon Prime'), 'loisirs'],
    ['Prélèvement\nSEPA MMA assurance\nRéf 7710', 'assurance'],
    ['Prélèvement\nSEPA EPS\nRéf 7711', 'assurance'],
    [newCard('12/11', 'Bip&Go'), 'transport'],
  ];

  const trainingTransactions = () =>
    history.map(([description, categoryId]) =>
      Transaction.create({
        accountId: 'acc-1',
        categoryId,
        date: new Date('2026-03-01'),
        description,
        amount: BigInt(-100),
        reconciled: false,
        pending: false,
      }),
    );

  /** Ancienne logique : minuscules + racine anglaise, sans retrait du bruit. */
  const predictBefore = (description: string): string | null => {
    const stem = (t: string) =>
      natural.PorterStemmer.tokenizeAndStem(t.toLowerCase());
    const known = new Set(history.flatMap(([d]) => stem(d)));
    if (!stem(description).some((w) => known.has(w))) return null;
    const classifier = new natural.BayesClassifier();
    for (const [d, c] of history) classifier.addDocument(d.toLowerCase(), c);
    classifier.train();
    return (
      classifier.getClassifications(description.toLowerCase())[0]?.label ?? null
    );
  };

  it('predicts more categories correctly than the previous logic', async () => {
    const repository = {
      findAllByAccountUnpaginated: jest
        .fn()
        .mockResolvedValue(trainingTransactions()),
    };
    const matchRules = {
      execute: jest.fn().mockResolvedValue({ categoryId: null, tagIds: [] }),
    };
    const useCase = new PredictCategoryUseCase(
      repository as unknown as TransactionRepository,
      matchRules as unknown as MatchSmartRulesUseCase,
    );

    let before = 0;
    let after = 0;
    for (const [description, expected] of toPredict) {
      if (predictBefore(description) === expected) before++;
      if ((await useCase.execute('acc-1', description)).categoryId === expected)
        after++;
    }

    const rate = (n: number) =>
      `${n}/${toPredict.length} (${Math.round((100 * n) / toPredict.length)} %)`;
    console.log(
      `CA8 — bonnes catégories : avant ${rate(before)}, après ${rate(after)}`,
    );

    expect(after).toBeGreaterThan(before);
  });
});
