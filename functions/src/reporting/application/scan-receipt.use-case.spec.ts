import { ScanReceiptUseCase } from './scan-receipt.use-case';
import { GeminiService } from './gemini.service';

describe('ScanReceiptUseCase', () => {
  let gemini: { analyzeImage: jest.Mock };
  let useCase: ScanReceiptUseCase;

  const empty = { date: null, amount: null, description: null, type: null };

  beforeEach(() => {
    gemini = { analyzeImage: jest.fn() };
    useCase = new ScanReceiptUseCase(gemini as unknown as GeminiService);
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  it('sends the image to Gemini and returns the parsed fields', async () => {
    gemini.analyzeImage.mockResolvedValue(
      '{"date":"2026-03-11","amount":-45.5,"description":"Carrefour","type":"DEBIT"}',
    );

    expect(await useCase.execute('BASE64', 'image/jpeg')).toEqual({
      date: '2026-03-11',
      amount: -45.5,
      description: 'Carrefour',
      type: 'DEBIT',
    });
    expect(gemini.analyzeImage).toHaveBeenCalledWith(
      expect.stringContaining('ticket de caisse'),
      'BASE64',
      'image/jpeg',
    );
  });

  it('strips the markdown code fence around the JSON', async () => {
    gemini.analyzeImage.mockResolvedValue(
      '```json\n{"date":null,"amount":12,"description":"Boulangerie","type":"DEBIT"}\n```',
    );

    expect(await useCase.execute('x', 'image/png')).toEqual({
      date: null,
      amount: 12,
      description: 'Boulangerie',
      type: 'DEBIT',
    });
  });

  it('turns missing fields into null', async () => {
    gemini.analyzeImage.mockResolvedValue('{"description":"Leclerc"}');

    expect(await useCase.execute('x', 'image/png')).toEqual({
      ...empty,
      description: 'Leclerc',
    });
  });

  // Comportement actuel : un montant de 0 est rendu comme illisible (null).
  it('returns null for an amount of 0', async () => {
    gemini.analyzeImage.mockResolvedValue('{"amount":0}');

    expect((await useCase.execute('x', 'image/png')).amount).toBeNull();
  });

  // Comportement actuel documenté (docs/reporting.md) : une erreur renvoie
  // quatre champs vides au lieu d'une erreur.
  it.each([
    ['an invalid JSON answer', () => Promise.resolve('pas du json')],
    ['a Gemini failure', () => Promise.reject(new Error('quota'))],
  ])('returns empty fields on %s', async (_, answer) => {
    gemini.analyzeImage.mockImplementation(answer);

    expect(await useCase.execute('x', 'image/png')).toEqual(empty);
  });
});
