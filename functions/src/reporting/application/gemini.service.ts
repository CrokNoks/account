import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosError } from 'axios';

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

@Injectable()
export class GeminiService {
  private readonly apiKey: string;
  private readonly apiUrl =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent';

  private cache = new Map<string, { text: string; timestamp: number }>();
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
      console.log(
        '[GeminiService] Calling Gemini API (gemini-flash-latest)...',
      );
      const response = await axios.post<GeminiResponse>(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        },
      );

      const result = response.data.candidates[0].content.parts[0].text;
      this.cache.set(prompt, { text: result, timestamp: Date.now() });
      return result;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 429) {
        console.error(
          'Gemini Quota Error details:',
          JSON.stringify(axiosError.response?.data, null, 2),
        );
        return "Le quota d'analyse IA est temporairement dépassé (10 requêtes/min en gratuit). Veuillez réessayer dans une minute.";
      }
      console.error(
        'Gemini API Error:',
        JSON.stringify(
          axiosError.response?.data || axiosError.message,
          null,
          2,
        ),
      );
      return "Désolé, l'IA ne semble pas disponible sur ce projet Google Cloud.";
    }
  }

  /**
   * Generates content from an image and a text prompt
   * @param prompt The text instructions
   * @param base64Image The image in base64 format (without data:image/xxx;base64, prefix)
   * @param mimeType The mime type of the image (e.g. image/jpeg)
   */
  async analyzeImage(
    prompt: string,
    base64Image: string,
    mimeType: string,
  ): Promise<string> {
    if (!this.apiKey) {
      throw new Error("L'IA n'est pas configurée (clé API manquante).");
    }

    try {
      console.log('[GeminiService] Calling Gemini API for image analysis...');
      const response = await axios.post<GeminiResponse>(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
        },
      );

      if (!response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        throw new Error('Structure de réponse Gemini invalide');
      }

      return response.data.candidates[0].content.parts[0].text;
    } catch (error) {
      const axiosError = error as AxiosError;
      console.error(
        'Gemini Image API Error:',
        JSON.stringify(
          axiosError.response?.data || axiosError.message,
          null,
          2,
        ),
      );
      throw axiosError;
    }
  }
}
