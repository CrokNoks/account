# Dette de tests : SQL en une commande, prévisionnel figé

## Le problème
Les 4 tests SQL de `supabase/tests/` ne se lancent qu'à la main avec psql : une régression SQL peut partir en prod sans que la vérification complète la voie. Deux cas du solde prévisionnel (budget prévu supérieur au réel avec une transaction sans catégorie ; virement entre comptes) ne sont figés par aucun test, donc un changement du calcul passerait inaperçu. Six erreurs prettier traînent dans `functions/test/validation.e2e-spec.ts`.

## Critères d'acceptation
- [ ] CA1 — Étant donné Supabase local démarré, quand on lance la commande SQL unique, alors les 4 tests (`repair_mojibake`, `repair_lost_accents`, `widen_balance_cards`, `utility_functions_privileges`) s'exécutent et la commande rend un code de sortie 0.
- [ ] CA2 — Étant donné une assertion SQL qui échoue (ou un fichier qui plante), quand on lance la commande, alors elle rend un code de sortie non nul et dit quel fichier a échoué ; les fichiers suivants ne masquent pas l'échec.
- [ ] CA3 — Étant donné Supabase local arrêté, quand on lance la commande, alors elle échoue avec un message qui dit de démarrer Supabase local (pas de faux vert).
- [ ] CA4 — Étant donné la description de la vérification complète du projet, quand on la lit, alors elle inclut la commande SQL, avec le prérequis « Supabase local démarré ».
- [ ] CA5 — Étant donné une période où le budget prévu dépasse le réel (revenus et dépenses) et une transaction sans catégorie, quand on calcule les stats, alors le prévisionnel prend le prévu pour revenus et dépenses et ajoute la transaction sans catégorie à son montant réel (test dans `get-period-stats.use-case.spec.ts`).
- [ ] CA6 — Étant donné un virement entre deux comptes sans catégorie, quand on calcule les stats du compte d'où part l'argent (transaction négative), alors le prévisionnel de ce compte baisse du montant ; et quand on calcule celles du compte qui reçoit (transaction positive), alors son prévisionnel monte du même montant. Les deux sens sont figés.
- [ ] CA7 — Étant donné le dossier `functions/test`, quand on lance `npx eslint test` dans `functions`, alors il ne remonte plus d'erreur prettier, sans changement de comportement des tests.

## Règle critique
Le prévisionnel d'un compte compte les transactions sans catégorie à leur montant réel (signe compris, `pending` comprises), en plus de max(réel, prévu). Les tests CA5 et CA6 sont écrits en premier ; ils passent sans changer le code (le calcul ne change pas : on le fige). Pour vérifier qu'ils protègent vraiment, le développeur casse temporairement le calcul (par exemple en ignorant les transactions sans catégorie) et constate que les tests échouent.

## Mesure d'impact
- Indicateur qui doit bouger : régressions SQL ou de calcul du prévisionnel parties en prod sans détection (cible : zéro).
- Équipe qui en profite : Performance (moins de vérifications à la main).
- Comment on le mesure : les 4 tests SQL et les 2 cas du prévisionnel tournent et sont verts dans la vérification complète (sortie de la commande).

## Exploitation
- En prod : rien, aucun code applicatif ne change. En local : la commande SQL affiche le fichier lancé et le fichier en échec.
- Retour arrière : revert du commit concerné.
- Feature flag : non.

## Parties sensibles
Aucune. Le calcul du prévisionnel touche l'argent mais ne change pas : on ajoute des tests seulement.

## Ce qui change dans l'existant
Aucune règle de `docs/` ne change. `docs/reporting.md` (ligne « Solde prévisionnel », colonne « Testée ») pourra mentionner les deux cas figés.

## Fichiers concernés
- Modifier : `functions/src/reporting/application/get-period-stats.use-case.spec.ts` — CA5 et CA6 (fabrique `tx(amount, categoryId, flags)` et mocks existants ; le test « uses the planned amounts… » ligne 185 couvre le prévu > réel sans transaction sans catégorie)
- Modifier : `functions/test/validation.e2e-spec.ts` — corrections prettier (~l.797-805)
- Modifier : `package.json` (racine) — script de la commande SQL unique ; la forme technique est au choix du développeur (script npm ou shell), emplacement possible `supabase/tests/`
- Modifier : `README.md` (racine) — documenter la commande SQL et le prérequis Supabase local, comme étape de la vérification complète. Aucun fichier du dépôt ne définit aujourd'hui la « vérification complète » (elle n'existe que dans les rapports des agents ; `functions/README.md` ne décrit que `npm run test:e2e`). Le développeur la précise là.
- Tests SQL existants, à lancer sans les modifier : `supabase/tests/repair_mojibake_test.sql`, `repair_lost_accents_test.sql`, `widen_balance_cards_test.sql`, `utility_functions_privileges_test.sql`
- Connexion utilisée aujourd'hui : `psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f <fichier>` (port 54322 de Supabase local, `supabase/config.toml`)

## Hors périmètre
- CI (`.github/workflows/*.yml`) : décision de Lucas, local seulement.
- Changement du calcul du prévisionnel.
- Autres tests, réécriture des tests SQL existants.

## Hypothèses
- Les 4 fichiers SQL passent aujourd'hui sur une base Supabase locale à jour (non revérifié ici) ; si l'un échoue, le développeur le signale sans le réécrire.
- Les virements entre comptes sans catégorie sont testés par compte (stats calculées par compte et par période), pas en un seul appel couvrant les deux comptes.
- `psql` est installé sur le poste de Lucas (déjà utilisé à la main).
- Le mot de passe `postgres` de l'URL locale est celui de Supabase local par défaut, sans secret.

## Points ouverts
Aucun.
