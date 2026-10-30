/** Identifiants constants des tests e2e : les colonnes d'id sont de type uuid et les routes les valident (400 sinon). */
export const uuid = (n: number) =>
  `00000000-0000-4000-8000-${n.toString().padStart(12, '0')}`;

/** Compte de l'utilisateur authentifié dans les tests. */
export const ACC = uuid(101);
