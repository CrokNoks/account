import { Injectable } from '@nestjs/common';
import { TransactionRepository } from '../domain/transaction.repository.interface';
import * as natural from 'natural';

@Injectable()
export class PredictCategoryUseCase {
  constructor(
    private readonly transactionRepository: TransactionRepository,
  ) {}

  async execute(accountId: string, description: string): Promise<{ categoryId: string | null }> {
    if (!description || description.trim().length < 3) {
      return { categoryId: null };
    }

    // Récupérer toutes les transactions pour avoir le maximum de données d'entraînement
    const transactions = await this.transactionRepository.findAllByAccount(accountId);
    
    // Filtrer uniquement celles qui ont une catégorie
    const trainingData = transactions.filter(t => t.categoryId && t.description);
    
    if (trainingData.length === 0) {
      return { categoryId: null };
    }

    const classifier = new natural.BayesClassifier();
    
    for (const t of trainingData) {
      classifier.addDocument(t.description.toLowerCase(), t.categoryId!);
    }
    
    classifier.train();
    
    const classifications = classifier.getClassifications(description.toLowerCase());
    
    if (classifications.length > 0) {
      // Les classifications sont triées par valeur (le plus probable en premier)
      const bestMatch = classifications[0];
      return { categoryId: bestMatch.label };
    }

    return { categoryId: null };
  }
}
