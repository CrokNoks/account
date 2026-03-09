import { Injectable } from '@nestjs/common';
import { GetBudgetBreakdownUseCase } from './get-budget-breakdown.use-case';
import { GetPeriodStatsUseCase } from './get-period-stats.use-case';
import { GeminiService } from './gemini.service';

@Injectable()
export class GetAIInsightsUseCase {
  constructor(
    private readonly getBudgetBreakdownUseCase: GetBudgetBreakdownUseCase,
    private readonly getPeriodStatsUseCase: GetPeriodStatsUseCase,
    private readonly geminiService: GeminiService,
  ) {}

  async execute(accountId: string, periodId: string, locale: string = 'fr'): Promise<string> {
    const breakdown = await this.getBudgetBreakdownUseCase.execute(accountId, periodId);
    const stats = await this.getPeriodStatsUseCase.execute(accountId, periodId);

    const prompt = `
      Agis en tant qu'expert en finances personnelles. Analyse les données suivantes pour la période actuelle :
      - Revenus réels : ${Number(stats.realIncome) / 100}€ (Prévu: ${Number(stats.plannedIncome) / 100}€)
      - Dépenses réelles : ${Number(stats.realExpenses) / 100}€ (Prévu: ${Number(stats.plannedExpenses) / 100}€)
      - Solde prévisionnel fin de mois : ${Number(stats.forecastBalance) / 100}€

      Détail par catégorie (Top dépenses) :
      ${breakdown.expenses.slice(0, 5).map(c => `- ${c.name}: ${Number(c.real) / 100}€ (Budget: ${Number(c.budget) / 100}€, ${c.percentage}% consommé)`).join('\n')}

      Donne-moi 3 points clés (courts et percutants) :
      1. Une observation sur la santé financière globale.
      2. Une alerte sur une catégorie qui dépasse le budget (si applicable).
      3. Un conseil concret pour optimiser le budget.

      Réponds en ${locale === 'fr' ? 'français' : 'anglais'} de manière amicale et motivante. Utilise du Markdown léger (gras).
    `;

    return this.geminiService.generateText(prompt);
  }
}
