import { centsToInputString, parseAmountToCents } from '@/shared/lib/format';

/** Un budget tel que lu par l'écran (centimes, texte). */
export interface SavedBudget {
  categoryId: string;
  amountAllocated: string;
}

/** Saisies non enregistrées : texte tapé par catégorie. */
export type Drafts = Record<string, string>;

export type DraftError = 'unreadable' | 'negative';

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
    // Le champ montre la valeur absolue (le signe du budget n'a pas d'effet, tous les calculs la prennent) :
    // la retaper telle quelle n'est pas un changement, le budget négatif enregistré est renvoyé tel quel.
    if (cents === null || (cents !== savedCents(reference, categoryId) && cents !== abs(savedCents(reference, categoryId))))
      changed[categoryId] = text;
  }
  return changed;
}

export const hasChanges = (reference: SavedBudget[], drafts: Drafts): boolean =>
  Object.keys(changedDrafts(reference, drafts)).length > 0;

/** Saisies refusées : illisibles ou négatives (un budget négatif déjà enregistré, non modifié, reste accepté). */
export function draftErrors(reference: SavedBudget[], drafts: Drafts): Record<string, DraftError> {
  const errors: Record<string, DraftError> = {};
  for (const [categoryId, text] of Object.entries(changedDrafts(reference, drafts))) {
    const cents = draftCents(text);
    if (cents === null) errors[categoryId] = 'unreadable';
    else if (cents < ZERO) errors[categoryId] = 'negative';
  }
  return errors;
}

/**
 * Liste complète à envoyer : tous les budgets lus, tels quels (signe compris) sauf ceux saisis,
 * plus les catégories saisies qui n'avaient pas de budget. Un champ vidé vaut 0 (l'API ne l'enregistre pas).
 */
export function buildBudgets(reference: SavedBudget[], drafts: Drafts): SavedBudget[] {
  const changed = changedDrafts(reference, drafts);
  const toAmount = (text: string) => (draftCents(text) ?? ZERO).toString();
  const list = reference.map((b) =>
    b.categoryId in changed ? { categoryId: b.categoryId, amountAllocated: toAmount(changed[b.categoryId]) } : { ...b },
  );
  for (const [categoryId, text] of Object.entries(changed)) {
    if (!reference.some((b) => b.categoryId === categoryId)) list.push({ categoryId, amountAllocated: toAmount(text) });
  }
  return list;
}

/**
 * Valeur du champ : ce qui est tapé, sinon l'enregistré en valeur absolue, au format de la langue
 * (vide pour une catégorie sans budget). Un budget négatif modifié est enregistré en positif.
 */
export function displayValue(reference: SavedBudget[], drafts: Drafts, categoryId: string, locale: string): string {
  if (categoryId in drafts) return drafts[categoryId];
  const cents = savedCents(reference, categoryId);
  return cents === ZERO ? '' : centsToInputString(abs(cents), locale);
}
