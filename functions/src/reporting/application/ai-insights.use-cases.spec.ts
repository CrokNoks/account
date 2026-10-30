import { GetAIInsightsUseCase } from './get-ai-insights.use-case';
import { GetEvolutionAIInsightsUseCase } from './get-evolution-ai-insights.use-case';
import { GetBudgetBreakdownUseCase } from './get-budget-breakdown.use-case';
import { GetPeriodStatsUseCase } from './get-period-stats.use-case';
import {
  EvolutionDataPoint,
  GetEvolutionUseCase,
} from './get-evolution.use-case';
import { GeminiService } from './gemini.service';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';
import { Account } from '../../accounts/domain/account.entity';

const breakdownItem = (name: string, real: number, budget = 0) => ({
  categoryId: name,
  name,
  real: String(real),
  budget: String(budget),
  remaining: '0',
  percentage: 50,
});

describe('AI insights use cases', () => {
  let gemini: { generateText: jest.Mock<Promise<string>, [string]> };
  let accounts: { findById: jest.Mock };

  const prompt = () => gemini.generateText.mock.calls[0][0];

  beforeEach(() => {
    gemini = {
      generateText: jest
        .fn<Promise<string>, [string]>()
        .mockResolvedValue('Analyse IA'),
    };
    accounts = {
      findById: jest.fn().mockResolvedValue(
        new Account({
          id: 'acc-1',
          name: 'Courant',
          ownerId: 'u-1',
          description: 'Compte joint du foyer',
        }),
      ),
    };
  });

  describe('GetAIInsightsUseCase', () => {
    let breakdown: { execute: jest.Mock };
    let stats: { execute: jest.Mock };

    const useCase = () =>
      new GetAIInsightsUseCase(
        breakdown as unknown as GetBudgetBreakdownUseCase,
        stats as unknown as GetPeriodStatsUseCase,
        gemini as unknown as GeminiService,
        accounts as unknown as AccountRepository,
      );

    beforeEach(() => {
      breakdown = {
        execute: jest.fn().mockResolvedValue({
          income: [],
          expenses: Array.from({ length: 10 }, (_, i) =>
            breakdownItem(`dep${i}`, -1000 * (i + 1), 5000),
          ),
          savings: [
            breakdownItem('livret', -20000),
            breakdownItem('pel', -5050),
          ],
          transfers: [],
        }),
      };
      stats = {
        execute: jest.fn().mockResolvedValue({
          realIncome: '250000',
          plannedIncome: '240000',
          realExpenses: '-123456',
          plannedExpenses: '100000',
          forecastBalance: '98765',
        }),
      };
    });

    it('returns the Gemini answer for the period', async () => {
      expect(await useCase().execute('acc-1', 'per-1')).toBe('Analyse IA');
      expect(breakdown.execute).toHaveBeenCalledWith('acc-1', 'per-1');
      expect(stats.execute).toHaveBeenCalledWith('acc-1', 'per-1');
    });

    it('puts amounts in euros and the account context in the prompt', async () => {
      await useCase().execute('acc-1', 'per-1');

      expect(prompt()).toContain('Contexte du compte : Compte joint du foyer');
      expect(prompt()).toContain('Revenus réels : 2500€ (Prévu: 2400€)');
      expect(prompt()).toContain('Dépenses réelles : -1234.56€ (Prévu: 1000€)');
      expect(prompt()).toContain('Solde prévisionnel fin de mois : 987.65€');
      expect(prompt()).toContain("Inclus aussi l'épargne : -250.5€");
    });

    it('lists only the first 8 expense categories', async () => {
      await useCase().execute('acc-1', 'per-1');

      expect(prompt()).toContain('- dep7: -80€ (Budget: 50€, 50% consommé)');
      expect(prompt()).not.toContain('dep8');
    });

    it('asks for French by default and English otherwise', async () => {
      await useCase().execute('acc-1', 'per-1');
      await useCase().execute('acc-1', 'per-1', 'en');

      expect(gemini.generateText.mock.calls[0][0]).toContain(
        'Réponds en français',
      );
      expect(gemini.generateText.mock.calls[1][0]).toContain(
        'Réponds en anglais',
      );
    });

    it('omits the account context when the account has no description', async () => {
      accounts.findById.mockResolvedValue(null);

      await useCase().execute('acc-1', 'per-1');

      expect(prompt()).not.toContain('Contexte du compte');
    });
  });

  describe('GetEvolutionAIInsightsUseCase', () => {
    let evolution: { execute: jest.Mock };

    const useCase = () =>
      new GetEvolutionAIInsightsUseCase(
        evolution as unknown as GetEvolutionUseCase,
        gemini as unknown as GeminiService,
        accounts as unknown as AccountRepository,
      );

    const point = (month: number): EvolutionDataPoint => ({
      periodId: `p${month}`,
      startDate: new Date(2026, month - 1, 1).toISOString(),
      endDate: '',
      isActive: false,
      realIncome: '250000',
      realExpenses: '-180000',
      forecastBalance: '0',
      realBankBalance: '70000',
      categories: {},
    });

    beforeEach(() => {
      evolution = {
        execute: jest
          .fn()
          .mockResolvedValue([1, 2, 3, 4, 5, 6, 7, 8].map(point)),
      };
    });

    it('analyzes closed periods only', async () => {
      expect(await useCase().execute('acc-1')).toBe('Analyse IA');
      expect(evolution.execute).toHaveBeenCalledWith('acc-1', true);
    });

    it('sends the last 6 periods in euros', async () => {
      await useCase().execute('acc-1');

      expect(prompt()).toContain('sur les 6 dernières périodes');
      expect(prompt()).not.toContain('- 02/2026');
      expect(prompt()).toContain(
        '- 03/2026 : Revenus 2500€, Dépenses -1800€, Solde fin 700€',
      );
      expect(prompt()).toContain('- 08/2026');
    });

    it.each([
      ['fr', "Pas assez de données pour analyser l'évolution."],
      ['en', 'Not enough data to analyze evolution.'],
    ])(
      'answers without calling Gemini when there is no closed period (%s)',
      async (locale, message) => {
        evolution.execute.mockResolvedValue([]);

        expect(await useCase().execute('acc-1', locale)).toBe(message);
        expect(gemini.generateText).not.toHaveBeenCalled();
      },
    );
  });
});
