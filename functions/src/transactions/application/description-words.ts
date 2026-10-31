import * as natural from 'natural';

/** Mots de bruit des libellés bancaires (liste explicite, déjà sans accent). */
export const NOISE_WORDS: ReadonlySet<string> = new Set([
  'sepa',
  'prlv',
  'cb',
  'carte',
  'paiement',
  'prelevement',
  'virement',
  'emis',
  'recu',
  'faveur',
  'echeance',
  'ref',
  'mdt',
  'ou',
  'mme',
  'mlle',
]);

/** Une ligne entière qui n'indique que le type d'opération. */
const OPERATION_LINE =
  /^(paiement par carte|prelevement|virement emis|virement en votre faveur|virement recu|retrait|cotisation|frais|echeance|remise|cheque)$/;

const CARD_NUMBER = /\bx\d{3,}\b/g;
const DATE = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g;
const SEPA_IDENTIFIER = /\b[a-z]{2}\d{2}zzz\w*/g;

/** Référence / code : au moins autant de chiffres que de lettres. */
function isReference(word: string): boolean {
  const digits = (word.match(/\d/g) ?? []).length;
  const letters = word.length - digits;
  return digits > 0 && digits >= letters;
}

function normalize(line: string): string {
  return line
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
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
      .split(' ')
      .filter((w) => w.length >= 2 && !NOISE_WORDS.has(w) && !isReference(w));

    if (kept.length > 0) {
      words.push(
        ...natural.PorterStemmerFr.tokenizeAndStem(kept.join(' '), false),
      );
    }
  }

  return words;
}
