import { Injectable } from '@nestjs/common';
import { GetBudgetBreakdownUseCase } from './get-budget-breakdown.use-case';
import { GetPeriodStatsUseCase } from './get-period-stats.use-case';
import { GeminiService } from './gemini.service';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';

@Injectable()
export class GetAIInsightsUseCase {
  constructor(
    private readonly getBudgetBreakdownUseCase: GetBudgetBreakdownUseCase,
    private readonly getPeriodStatsUseCase: GetPeriodStatsUseCase,
    private readonly geminiService: GeminiService,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(
    accountId: string,
    periodId: string,
    locale: string = 'fr',
  ): Promise<string> {
    const account = await this.accountRepository.findById(accountId);
    const breakdown = await this.getBudgetBreakdownUseCase.execute(
      accountId,
      periodId,
    );
    const stats = await this.getPeriodStatsUseCase.execute(accountId, periodId);

    const accountContext = account?.description
      ? `Contexte du compte : ${account.description}`
      : '';

    const prompt = `
      Agis en tant qu'expert en finances personnelles. ${accountContext}
      Analyse les données suivantes pour la période actuelle :
      - Revenus réels : ${Number(stats.realIncome) / 100}€ (Prévu: ${Number(stats.plannedIncome) / 100}€)
      - Dépenses réelles : ${Number(stats.realExpenses) / 100}€ (Prévu: ${Number(stats.plannedExpenses) / 100}€)
      - Solde prévisionnel fin de mois : ${Number(stats.forecastBalance) / 100}€

      Détail par catégorie (Top dépenses) :
      ${breakdown.expenses
        .slice(0, 8)
        .map(
          (c) =>
            `- ${c.name}: ${Number(c.real) / 100}€ (Budget: ${Number(c.budget) / 100}€, ${c.percentage}% consommé)`,
        )
        .join('\n')}

      Inclus aussi l'épargne : ${
        breakdown.savings.reduce((sum, s) => sum + Number(s.real), 0) / 100
      }€

      Consignes d'analyse :
      1. Identifie la santé financière globale (équilibre revenus/dépenses).
      2. Détecte les dépassements de budget critiques.
      3. Propose une action concrète et motivante pour améliorer la situation ou félicite si tout est parfait.
      4. Si les dépenses sont élevées par rapport aux revenus, suggère une priorité de réduction.

      Réponds en ${locale === 'fr' ? 'français' : 'anglais'} de manière concise (max 150 mots). Utilise du Markdown (gras et listes à puces). Pas d'introduction générique, entre directement dans le vif du sujet.
    `;

    return this.geminiService.generateText(prompt);
  }
}
