import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { GeminiService } from './gemini.service';

jest.mock('axios');
const post = axios.post as jest.Mock;

const reply = (text: string) => ({
  data: { candidates: [{ content: { parts: [{ text }] } }] },
});

const service = (apiKey: string | undefined = 'secret-key') =>
  new GeminiService({
    get: jest.fn().mockReturnValue(apiKey),
  } as unknown as ConfigService);

describe('GeminiService', () => {
  beforeEach(() => {
    post.mockReset();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => jest.restoreAllMocks());

  describe('generateText', () => {
    it('returns the text of the first candidate', async () => {
      post.mockResolvedValue(reply('Analyse'));

      expect(await service().generateText('prompt')).toBe('Analyse');
      expect(post).toHaveBeenCalledWith(
        expect.stringContaining('?key=secret-key'),
        { contents: [{ parts: [{ text: 'prompt' }] }] },
      );
    });

    it('caches the answer of an identical prompt for 15 minutes', async () => {
      jest.useFakeTimers();
      post.mockResolvedValue(reply('Analyse'));
      const gemini = service();

      await gemini.generateText('prompt');
      await gemini.generateText('prompt');
      expect(post).toHaveBeenCalledTimes(1);

      jest.advanceTimersByTime(15 * 60 * 1000 + 1);
      await gemini.generateText('prompt');
      expect(post).toHaveBeenCalledTimes(2);
      jest.useRealTimers();
    });

    it('does not share the cache between different prompts', async () => {
      post.mockResolvedValue(reply('Analyse'));
      const gemini = service();

      await gemini.generateText('a');
      await gemini.generateText('b');

      expect(post).toHaveBeenCalledTimes(2);
    });

    // Comportement actuel documenté (docs/reporting.md) : les erreurs reviennent
    // comme du texte normal, sans appel réseau quand la clé manque.
    it('returns a message without calling the API when the key is missing', async () => {
      expect(await service('').generateText('prompt')).toBe(
        "L'IA n'est pas configurée (clé API manquante).",
      );
      expect(post).not.toHaveBeenCalled();
    });

    it('returns a quota message on HTTP 429', async () => {
      post.mockRejectedValue({ response: { status: 429, data: {} } });

      expect(await service().generateText('prompt')).toMatch(
        /quota d'analyse IA est temporairement dépassé/,
      );
    });

    it('returns an unavailability message on any other error, without caching it', async () => {
      post.mockRejectedValueOnce(new Error('network'));
      const gemini = service();

      expect(await gemini.generateText('prompt')).toBe(
        "Désolé, l'IA ne semble pas disponible sur ce projet Google Cloud.",
      );

      post.mockResolvedValue(reply('Analyse'));
      expect(await gemini.generateText('prompt')).toBe('Analyse');
    });
  });

  describe('analyzeImage', () => {
    it('sends the prompt and the inline image', async () => {
      post.mockResolvedValue(reply('{}'));

      expect(
        await service().analyzeImage('prompt', 'BASE64', 'image/png'),
      ).toBe('{}');
      expect(post).toHaveBeenCalledWith(expect.any(String), {
        contents: [
          {
            parts: [
              { text: 'prompt' },
              { inline_data: { mime_type: 'image/png', data: 'BASE64' } },
            ],
          },
        ],
      });
    });

    it('throws when the key is missing', async () => {
      await expect(
        service('').analyzeImage('p', 'x', 'image/png'),
      ).rejects.toThrow("L'IA n'est pas configurée");
      expect(post).not.toHaveBeenCalled();
    });

    it('throws on an empty response', async () => {
      post.mockResolvedValue({ data: { candidates: [] } });

      await expect(
        service().analyzeImage('p', 'x', 'image/png'),
      ).rejects.toThrow('Structure de réponse Gemini invalide');
    });

    it('rethrows API errors', async () => {
      const error = { response: { status: 500, data: 'boom' } };
      post.mockRejectedValue(error);

      await expect(service().analyzeImage('p', 'x', 'image/png')).rejects.toBe(
        error,
      );
    });
  });
});
