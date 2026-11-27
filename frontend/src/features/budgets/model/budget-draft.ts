import { centsToInputString, parseAmountToCents } from '@/shared/lib/format';

/** Un budget tel que lu par l'écran (centimes, texte). */
export interface SavedBudget {
  categoryId: string;
  amountAllocated: string;
}

/** Saisies non enregistrées : texte tapé par catégorie. */
export type Drafts = Record<string, string>;

export type DraftError = 'unreadable' | 'negative';

/**
 * Sens des catégories de virement, tel que calculé par le back (`direction`) : jamais recalculé ici.
 * Une catégorie absente de la table n'est pas un virement.
 */
export type Direction = 'outgoing' | 'incoming';
export type Directions = Record<string, Direction>;

/** Table des sens à partir de lignes du back ; seules celles qui portent un `direction` sont des virements. */
export function directionsOf(items: Array<{ categoryId: string; direction?: Direction }>): Directions {
  const table: Directions = {};
  for (const item of items) if (item.direction) table[item.categoryId] = item.direction;
  return table;
}

const ZERO = BigInt(0);

const abs = (n: bigint): bigint => (n < ZERO ? -n : n);

const savedCents = (reference: SavedBudget[], categoryId: string): bigint => {
  const found = reference.find((b) => b.categoryId === categoryId);
  return found ? BigInt(found.amountAllocated) : ZERO;
};

/** Cents d'une saisie : champ vide = 0, null si illisible. */
const draftCents = (text: string): bigint | null => (text.trim() === '' ? ZERO : parseAmountToCents(text));

/**
 * Saisies qui diffèrent vraiment de l'enregistré (montant égal, ou 0 pour une catégorie sans budget :
 * pas de changement). Un texte illisible compte comme un changement : il doit être corrigé.
 */
export function changedDrafts(reference: SavedBudget[], drafts: Drafts): Drafts {
  const changed: Drafts = {};
  for (const [categoryId, text] of Object.entries(drafts)) {
    const cents = draftCents(text);
    // Le champ montre la valeur absolue (le sens d'un virement se lit à la section, pas dans le champ) :
    // la retaper telle quelle n'est pas un changement, le budget négatif enregistré est renvoyé tel quel.
    if (cents === null || (cents !== savedCents(reference, categoryId) && cents !== abs(savedCents(reference, categoryId))))
      changed[categoryId] = text;
  }
  return changed;
}

export const hasChanges = (reference: SavedBudget[], drafts: Drafts): boolean =>
  Object.keys(changedDrafts(reference, drafts)).length > 0;

/**
 * Saisies refusées : illisibles, ou négatives hors virement (un budget négatif déjà enregistré, non modifié,
 * reste accepté ; un montant négatif tapé sur un virement en fait un sortant).
 */
export function draftErrors(reference: SavedBudget[], drafts: Drafts, directions: Directions): Record<string, DraftError> {
  const errors: Record<string, DraftError> = {};
  for (const [categoryId, text] of Object.entries(changedDrafts(reference, drafts))) {
    const cents = draftCents(text);
    if (cents === null) errors[categoryId] = 'unreadable';
    else if (cents < ZERO && !(categoryId in directions)) errors[categoryId] = 'negative';
  }
  return errors;
}

/**
 * Montant à enregistrer pour un texte saisi. Un virement garde son sens : sortant = négatif, entrant = positif
 * (le sens vient du back : signe du budget enregistré, à défaut signe du réel, entrant sans budget ni opération).
 * Un négatif tapé sur un virement est gardé tel quel (sortant). Hors virement, le texte est pris tel quel.
 */
function signedCents(text: string, categoryId: string, directions: Directions): bigint {
  const cents = draftCents(text) ?? ZERO;
  if (cents === ZERO || cents < ZERO) return cents;
  return directions[categoryId] === 'outgoing' ? -cents : cents;
}

/**
 * Liste complète à envoyer : tous les budgets lus, tels quels (signe compris) sauf ceux saisis,
 * plus les catégories saisies qui n'avaient pas de budget. Un champ vidé vaut 0 (l'API ne l'enregistre pas).
 */
export function buildBudgets(reference: SavedBudget[], drafts: Drafts, directions: Directions): SavedBudget[] {
  const changed = changedDrafts(reference, drafts);
  const toAmount = (categoryId: string, text: string) => signedCents(text, categoryId, directions).toString();
  const list = reference.map((b) =>
    b.categoryId in changed
      ? { categoryId: b.categoryId, amountAllocated: toAmount(b.categoryId, changed[b.categoryId]) }
      : { ...b },
  );
  for (const [categoryId, text] of Object.entries(changed)) {
    if (!reference.some((b) => b.categoryId === categoryId)) list.push({ categoryId, amountAllocated: toAmount(categoryId, text) });
  }
  return list;
}

/**
 * Valeur du champ : ce qui est tapé, sinon l'enregistré en valeur absolue, au format de la langue
 * (vide pour une catégorie sans budget). Le sens d'un virement se lit à la section (Dépenses / Revenus).
 */
export function displayValue(reference: SavedBudget[], drafts: Drafts, categoryId: string, locale: string): string {
  if (categoryId in drafts) return drafts[categoryId];
  const cents = savedCents(reference, categoryId);
  return cents === ZERO ? '' : centsToInputString(abs(cents), locale);
}
