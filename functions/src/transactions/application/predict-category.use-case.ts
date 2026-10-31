import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { MatchSmartRulesUseCase } from '../../smart-rules/application/match-smart-rules.use-case';
import * as natural from 'natural';
import { extractWords } from './description-words';

type Prediction = { categoryId: string | null; tagIds?: string[] };
type PredictionModel = {
  classifier: natural.BayesClassifier;
  knownWords: Set<string>;
};

@Injectable()
export class PredictCategoryUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly matchRulesUseCase: MatchSmartRulesUseCase,
  ) {}

  async execute(accountId: string, description: string): Promise<Prediction> {
    const [prediction] = await this.executeMany(accountId, [description]);
    return prediction;
  }

  /**
   * Une prédiction par description, dans l'ordre. L'historique est lu et le
   * classifieur entraîné une seule fois, et seulement si une ligne n'est pas
   * résolue par une règle intelligente. `execute` passe par ici : un seul
   * algorithme.
   */
  async executeMany(
    accountId: string,
    descriptions: string[],
  ): Promise<Prediction[]> {
    let model: Promise<PredictionModel | null> | undefined;
    const results: Prediction[] = [];

    for (const description of descriptions) {
      if (!description || description.trim().length < 3) {
        results.push({ categoryId: null });
        continue;
      }

      // 1. Règles intelligentes d'abord (configuration explicite)
      const ruleMatch = await this.matchRulesUseCase.execute(
        accountId,
        description,
      );
      if (ruleMatch.categoryId || ruleMatch.tagIds.length > 0) {
        results.push({
          categoryId: ruleMatch.categoryId,
          tagIds: ruleMatch.tagIds,
        });
        continue;
      }

      // 2. Classifieur sur l'historique, construit à la première utilisation
      model ??= this.buildModel(accountId);
      results.push(this.classify(await model, description));
    }

    return results;
  }

  private async buildModel(accountId: string): Promise<PredictionModel | null> {
    const transactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId);

    // Filtrer uniquement celles qui ont une catégorie
    const trainingData = transactions.filter(
      (t) => t.categoryId && t.description,
    );

    if (trainingData.length === 0) {
      return null;
    }

    // Un seul traitement des mots (accents, français, bruit bancaire) pour le
    // contrôle « mot connu » et le classifieur : ils ne peuvent pas diverger.
    const documents = trainingData
      .map((t) => ({
        words: extractWords(t.description),
        label: t.categoryId!,
      }))
      .filter((d) => d.words.length > 0);

    const classifier = new natural.BayesClassifier();

    for (const d of documents) {
      classifier.addDocument(d.words, d.label);
    }

    classifier.train();

    return {
      classifier,
      knownWords: new Set(documents.flatMap((d) => d.words)),
    };
  }

  private classify(
    model: PredictionModel | null,
    description: string,
  ): Prediction {
    if (!model) {
      return { categoryId: null };
    }

    // Aucun mot utile connu : on ne propose rien plutôt que la catégorie la
    // plus fréquente.
    const words = extractWords(description);

    if (!words.some((word) => model.knownWords.has(word))) {
      return { categoryId: null };
    }

    const classifications = model.classifier.getClassifications(words);

    if (classifications.length > 0) {
      // Triées par valeur (le plus probable en premier)
      return { categoryId: classifications[0].label };
    }

    return { categoryId: null };
  }
}
