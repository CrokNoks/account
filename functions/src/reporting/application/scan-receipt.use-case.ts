import { Injectable } from '@nestjs/common';
import { GeminiService } from './gemini.service';

export interface ScanReceiptResult {
  date: string | null;
  amount: number | null;
  description: string | null;
  type: 'DEBIT' | 'CREDIT' | null;
}

interface RawScanResult {
  date: string | null;
  amount: number | null;
  description: string | null;
  type: 'DEBIT' | 'CREDIT' | null;
}

@Injectable()
export class ScanReceiptUseCase {
  constructor(private readonly geminiService: GeminiService) {}

  async execute(
    base64Image: string,
    mimeType: string,
  ): Promise<ScanReceiptResult> {
    const prompt = `
      Extrais les informations suivantes de ce ticket de caisse :
      1. La date de l'achat (format YYYY-MM-DD).
      2. Le montant total TTC (nombre uniquement, pas de devise).
      3. Le nom de l'enseigne ou du marchand (description courte).
      4. Si le ticket indique s'il s'agit d'un paiement DEBIT ou CREDIT, ajuste le montant en conséquence (négatif pour DEBIT, positif pour CREDIT).

      Réponds exclusivement au format JSON comme ceci :
      {
        "date": "2024-03-11",
        "amount": -45.50,
        "description": "Carrefour",
        "type": "DEBIT"
      }
      
      Si une information est illisible, mets null.
      Attention à ne pas confondre avec la banque CREDIT AGRICOLE.
    `;

    try {
      const response = await this.geminiService.analyzeImage(
        prompt,
        base64Image,
        mimeType,
      );

      // Clean markdown code blocks if Gemini adds them
      const jsonString = response.replace(/```json\n?|```/g, '').trim();
      const result = JSON.parse(jsonString) as RawScanResult;

      return {
        date: result.date || null,
        amount: result.amount || null,
        description: result.description || null,
        type: result.type || null,
      };
    } catch (error) {
      console.error(
        '[ScanReceiptUseCase] Error parsing Gemini response:',
        error,
      );
      return { date: null, amount: null, description: null, type: null };
    }
  }
}
