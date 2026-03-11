import { Injectable } from '@nestjs/common';
import { GeminiService } from './gemini.service';

export interface ScanReceiptResult {
  date: string | null;
  amount: number | null;
  description: string | null;
}

@Injectable()
export class ScanReceiptUseCase {
  constructor(private readonly geminiService: GeminiService) {}

  async execute(base64Image: string, mimeType: string): Promise<ScanReceiptResult> {
    const prompt = `
      Extrais les informations suivantes de ce ticket de caisse :
      1. La date de l'achat (format YYYY-MM-DD).
      2. Le montant total TTC (nombre uniquement, pas de devise).
      3. Le nom de l'enseigne ou du marchand (description courte).

      Réponds exclusivement au format JSON comme ceci :
      {
        "date": "2024-03-11",
        "amount": 45.50,
        "description": "Carrefour"
      }
      
      Si une information est illisible, mets null.
    `;

    try {
      const response = await this.geminiService.analyzeImage(prompt, base64Image, mimeType);
      
      // Clean markdown code blocks if Gemini adds them
      const jsonString = response.replace(/```json\n?|```/g, '').trim();
      const result = JSON.parse(jsonString);

      return {
        date: result.date || null,
        amount: result.amount || null,
        description: result.description || null,
      };
    } catch (error) {
      console.error('[ScanReceiptUseCase] Error parsing Gemini response:', error);
      return { date: null, amount: null, description: null };
    }
  }
}
