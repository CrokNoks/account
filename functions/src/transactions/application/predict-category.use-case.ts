import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import { MatchSmartRulesUseCase } from '../../smart-rules/application/match-smart-rules.use-case';
import * as natural from 'natural';
import { extractWords } from './description-words';

@Injectable()
export class PredictCategoryUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
    private readonly matchRulesUseCase: MatchSmartRulesUseCase,
  ) {}

  async execute(
    accountId: string,
    description: string,
  ): Promise<{ categoryId: string | null; tagIds?: string[] }> {
    if (!description || description.trim().length < 3) {
      return { categoryId: null };
    }

    // 1. Try smart rules first (Explicit user configuration)
    const ruleMatch = await this.matchRulesUseCase.execute(
      accountId,
      description,
    );
    if (ruleMatch.categoryId || ruleMatch.tagIds.length > 0) {
      return {
        categoryId: ruleMatch.categoryId,
        tagIds: ruleMatch.tagIds,
      };
    }

    // 2. Fallback to ML classifier (Historical data)
    const transactions =
      await this.transactionRepository.findAllByAccountUnpaginated(accountId);

    // Filtrer uniquement celles qui ont une catégorie
    const trainingData = transactions.filter(
      (t) => t.categoryId && t.description,
    );

    if (trainingData.length === 0) {
      return { categoryId: null };
    }

    // Un seul traitement des mots (accents, français, bruit bancaire) pour le
    // contrôle « mot connu » et le classifieur : ils ne peuvent pas diverger.
    const documents = trainingData
      .map((t) => ({
        words: extractWords(t.description),
        label: t.categoryId!,
      }))
      .filter((d) => d.words.length > 0);

    // Aucun mot utile connu : on ne propose rien plutôt que la catégorie la
    // plus fréquente.
    const knownWords = new Set(documents.flatMap((d) => d.words));
    const words = extractWords(description);

    if (!words.some((word) => knownWords.has(word))) {
      return { categoryId: null };
    }

    const classifier = new natural.BayesClassifier();

    for (const d of documents) {
      classifier.addDocument(d.words, d.label);
    }

    classifier.train();

    const classifications = classifier.getClassifications(words);

    if (classifications.length > 0) {
      // Les classifications sont triées par valeur (le plus probable en premier)
      const bestMatch = classifications[0];
      return { categoryId: bestMatch.label };
    }

    return { categoryId: null };
  }
}
