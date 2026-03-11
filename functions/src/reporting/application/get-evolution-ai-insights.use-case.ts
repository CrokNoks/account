import { Injectable } from '@nestjs/common';
import { GetEvolutionUseCase } from './get-evolution.use-case';
import { GeminiService } from './gemini.service';
import { format } from 'date-fns';
import { AccountRepository } from '../../accounts/domain/account.repository.interface';

@Injectable()
export class GetEvolutionAIInsightsUseCase {
  constructor(
    private readonly getEvolutionUseCase: GetEvolutionUseCase,
    private readonly geminiService: GeminiService,
    private readonly accountRepository: AccountRepository,
  ) {}

  async execute(accountId: string, locale: string = 'fr'): Promise<string> {
    const account = await this.accountRepository.findById(accountId);
    const evolutionData = await this.getEvolutionUseCase.execute(accountId, true);

    if (evolutionData.length === 0) {
      return locale === 'fr' 
        ? "Pas assez de données pour analyser l'évolution." 
        : "Not enough data to analyze evolution.";
    }

    // Take last 6 periods max for analysis
    const recentData = evolutionData.slice(-6);

    const accountContext = account?.description 
      ? `Contexte du compte : ${account.description}` 
      : '';

    const prompt = `
      Agis en tant qu'analyste financier. ${accountContext}
      Analyse les tendances sur les ${recentData.length} dernières périodes :
      
      Données historiques (du plus ancien au plus récent) :
      ${recentData.map(d => {
        const dateStr = format(new Date(d.startDate), 'MM/yyyy');
        return `- ${dateStr} : Revenus ${Number(d.realIncome)/100}€, Dépenses ${Number(d.realExpenses)/100}€, Solde fin ${Number(d.realBankBalance)/100}€`;
      }).join('\n')}

      Consignes d'analyse :
      1. Identifie la tendance des revenus (croissance, stagnation, baisse).
      2. Analyse la maîtrise des dépenses sur la durée.
      3. Calcule le taux d'épargne moyen approximatif.
      4. Donne un conseil stratégique pour les 3 prochains mois basé sur ces tendances.

      Réponds en ${locale === 'fr' ? 'français' : 'anglais'} de manière structurée et analytique (max 200 mots). Utilise du Markdown (gras et listes). Pas d'introduction générique.
    `;

    return this.geminiService.generateText(prompt);
  }
}
