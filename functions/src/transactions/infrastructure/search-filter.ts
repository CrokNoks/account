/**
 * Filtre PostgREST `.or(...)` pour la recherche texte : la saisie est cherchée
 * telle quelle (sous-chaîne, sans tenir compte de la casse) dans description
 * ou notes. Règle écrite une seule fois, partagée par toutes les listes.
 *
 * - Opérateur `imatch` (regex insensible à la casse) et non `ilike` : PostgREST
 *   transforme `*` en `%` dans un `ilike`, sans moyen de l'échapper ; en regex,
 *   chaque caractère spécial est neutralisé par un antislash (`\ ^ $ . | ? * + ( ) [ ] { }`).
 * - La valeur est mise entre guillemets doubles PostgREST (`\` et `"` échappés) :
 *   virgule, parenthèses et point ne peuvent plus ajouter de condition au OR.
 */
export function buildSearchFilter(search: string): string {
  const regexEscaped = search.replace(/[\\^$.|?*+()[\]{}]/g, '\\$&');
  const quoted = regexEscaped.replace(/[\\"]/g, '\\$&');
  const pattern = `"${quoted}"`;
  return `description.imatch.${pattern},notes.imatch.${pattern}`;
}
