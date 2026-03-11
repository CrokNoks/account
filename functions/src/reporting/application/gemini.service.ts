import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class GeminiService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';
  
  private cache = new Map<string, { text: string, timestamp: number }>();
  private readonly CACHE_TTL = 1000 * 60 * 15; // 15 minutes

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('GEMINI_API_KEY') || '';
  }

  async generateText(prompt: string): Promise<string> {
    if (!this.apiKey) {
      return "L'IA n'est pas configurée (clé API manquante).";
    }

    const cached = this.cache.get(prompt);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.text;
    }

    try {
      console.log('[GeminiService] Calling Gemini API (gemini-flash-latest)...');
      const response = await axios.post(`${this.apiUrl}?key=${this.apiKey}`, {
        contents: [{
          parts: [{ text: prompt }]
        }]
      });

      const result = response.data.candidates[0].content.parts[0].text;
      this.cache.set(prompt, { text: result, timestamp: Date.now() });
      return result;
    } catch (error: any) {
      if (error.response?.status === 429) {
        console.error('Gemini Quota Error details:', JSON.stringify(error.response?.data, null, 2));
        return "Quota de 0 détecté. Veuillez vérifier votre compte sur Google AI Studio (Plan 'Pay-as-you-go' gratuit requis).";
      }
      console.error('Gemini API Error:', JSON.stringify(error.response?.data || error.message, null, 2));
      return "Désolé, l'IA ne semble pas disponible sur ce projet Google Cloud.";
    }
  }
}
