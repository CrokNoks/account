import * as natural from 'natural';
import { FRENCH_STOP_WORDS } from './french-stop-words';

/** Sigles bancaires sans ambiguïté (déjà sans accent). */
export const NOISE_WORDS: ReadonlySet<string> = new Set([
  'sepa',
  'prlv',
  'cb',
  'mdt',
  'ref',
  'mme',
  'mlle',
]);

/**
 * Expressions entières de bruit (sans accent), retirées où qu'elles soient dans
 * la ligne. Leurs mots seuls (« carte », « paiement », « virement »…) restent
 * utiles : « Carte Noire », « Virement Dupont ».
 */
export const NOISE_PHRASES: readonly string[] = [
  'paiement par carte',
  'virement en votre faveur',
  'virement emis',
  'virement recu',
  'prelevement',
  'echeance',
];

const NOISE_PHRASES_PATTERN = new RegExp(
  `\\b(?:${NOISE_PHRASES.join('|')})\\b`,
  'g',
);

/** Une ligne entière qui n'indique que le type d'opération. */
const OPERATION_LINE = /^(retrait|cotisation|frais|remise|cheque)$/;

const CARD_NUMBER = /\bx\d{3,}\b/g;
const DATE = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g;
const SEPA_IDENTIFIER = /\b[a-z]{2}\d{2}zzz\w*/g;

function normalize(line: string): string {
  return line
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

// Liste française (accentuée), comparée sans accents.
const STOP_WORDS: ReadonlySet<string> = new Set(
  FRENCH_STOP_WORDS.map(normalize),
);

/**
 * Référence / code à retirer : uniquement des chiffres, ou au moins 4
 * caractères avec au moins autant de chiffres que de lettres. « 24h », « u2 »,
 * « d12 », « 1password » et « bebe9 » restent.
 */
function isReference(word: string): boolean {
  const digits = (word.match(/\d/g) ?? []).length;
  if (digits === word.length) return true;
  return word.length >= 4 && digits >= word.length - digits;
}

/**
 * Transforme un libellé en racines utiles : sans accents, sans bruit bancaire,
 * sans mots vides français. Utilisé à la fois pour « mot connu » et pour le
 * classifieur, afin que les deux ne divergent jamais.
 */
export function extractWords(description: string): string[] {
  const words: string[] = [];

  for (const rawLine of description.split('\n')) {
    const line = normalize(rawLine).replace(/\s+/g, ' ').trim();
    if (!line || OPERATION_LINE.test(line.replace(/[^a-z ]/g, '').trim())) {
      continue;
    }

    const kept = line
      .replace(CARD_NUMBER, ' ')
      .replace(DATE, ' ')
      .replace(SEPA_IDENTIFIER, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(NOISE_PHRASES_PATTERN, ' ')
      .split(' ')
      .filter(
        (w) =>
          w.length >= 2 &&
          !NOISE_WORDS.has(w) &&
          !STOP_WORDS.has(w) &&
          !isReference(w),
      );

    if (kept.length > 0) {
      words.push(
        ...natural.PorterStemmerFr.tokenizeAndStem(kept.join(' '), true),
      );
    }
  }

  return words;
}
