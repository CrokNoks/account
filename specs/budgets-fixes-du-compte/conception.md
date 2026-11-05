# Conception — budgets fixes du compte (2 parties sensibles)

## Partie 1 — Calcul du montant proposé

### Ce que ça calcule ou décide
Entrées : montant configuré de la catégorie (ou absent), liste des montants de ses récurrentes. Sortie : le montant proposé en centimes (bigint).
- Création de période : configuré (non nul) sinon 0. Jamais de moyenne, jamais de récurrentes.
- Écran de configuration : configuré non nul sinon somme des récurrentes (0 s'il n'y en a pas).

### L'algorithme
Deux fonctions pures, dans `functions/src/budgets/domain/proposed-amount.ts` (nouveau, < 30 lignes) :

```ts
// Création de période (draft-init)
export function proposedAmountForPeriod(configured: bigint | undefined): bigint {
  return configured ?? 0n;               // une ligne à 0 donne 0 : même résultat que « absente »
}
// Écran de configuration
export function proposedAmountForConfigScreen(
  configured: bigint | undefined,
  recurringAmounts: bigint[],
): bigint {
  if (configured !== undefined && configured !== 0n) return configured; // négatif conservé tel quel
  return recurringAmounts.reduce((s, a) => s + a, 0n);                   // [] -> 0n
}
```

### Données et structure
- `GetPeriodDraftUseCase` (modifié) : charge la configuration via `BudgetRepository.findTemplatesByAccount(accountId): Promise<Array<{ categoryId: string; amount: bigint }>>` (signature fixée ici ; le repo lit `budget_templates.amount_base`, BIGINT), construit une `Map`, appelle `proposedAmountForPeriod` par catégorie. Plus de lecture des récurrentes dans ce use case : le repo récurrentes est retiré du constructeur (et du spec). `getHistoricalStatsByAccount` reste, pour min/moy/max indicatifs (`avgReal` inchangé).
- L'écran de configuration (use case non sensible, du mode standard) appellera `proposedAmountForConfigScreen`, sans réimplémenter la règle. Rien n'est écrit par la lecture (CA3).
- Seule la lecture est concernée ; `POST /periods` et `PUT :id/budgets` ne touchent pas la configuration (CA6, CA8).

### Arrondis, limites et cas particuliers
Centimes entiers, bigint, aucun arrondi. Priorité : configuré non nul > (écran seul) somme des récurrentes > 0. Configuré négatif ou 0 : négatif gardé, 0 = non configuré. Somme des récurrentes avec les signes de `rt.amount`, comme le code actuel (hypothèse : on ne change pas la convention).

### Exploitation
Log structuré dans le draft : `accountId`, nombre de catégories, nombre configurées non nulles (pas de montants ni de noms). Retour arrière : revert du code (le brouillon retrouve moyenne/récurrentes) ; les lignes en base restent inertes.

### Alternative écartée
Dupliquer la règle dans chaque use case : écarté (la règle est écrite une fois, deux fonctions pures voisines).

### Cas de test (écrits avant le code)
`proposed-amount.spec.ts` (fonctions pures) et `get-period-draft.use-case.spec.ts` (les cas « avgReal » et « récurrentes » sont remplacés).

| Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- |
| Draft : configuré 50000 + récurrentes 12000 + historique avg 30000 | `defaultAllocated` = "50000" ; avg/min/max inchangés | CA1 |
| Draft : non configuré + récurrentes + historique | "0" ; `avgReal` toujours rempli | CA2, règle critique |
| Draft : compte sans période ni config | "0" pour toutes les catégories | CA2 |
| Draft : ligne configurée à 0 + récurrentes | "0" | 0 = non configuré |
| Draft : configuré négatif (-8000) | "-8000" | signe non imposé |
| Draft : config d'une catégorie absente de la liste des catégories | ignorée, pas d'erreur | catégorie supprimée |
| Écran : configuré 50000 + récurrentes 12000 | 50000 | configuré gagne |
| Écran : non configuré + récurrentes 12000 et 3050 | 15050 | somme |
| Écran : ligne à 0 + récurrentes 12000 | 12000 | 0 = non configuré |
| Écran : non configuré, sans récurrente | 0 | CA3 |
| Écran : configuré négatif + récurrentes | le négatif | pas de somme sur un configuré |

## Partie 2 — Migration de reprise

### Ce que ça décide
Pour chaque compte ayant des périodes : copier vers `budget_templates` le budget de chaque catégorie dans la période la plus récente du compte, uniquement là où la ligne est absente ou à 0. Jamais d'écrasement d'une ligne non nulle ; rejouable. Récurrentes jamais reprises.

### SQL envisagé
Fichier `supabase/migrations/20261105100100_backfill_budget_templates.sql` (horodatage > dernier existant 20261101100700), une seule instruction, donc atomique :

```sql
INSERT INTO public.budget_templates (account_id, category_id, amount_base)
SELECT p.account_id, bi.category_id, bi.amount_allocated
FROM (
  SELECT DISTINCT ON (account_id) id, account_id
  FROM public.periods
  ORDER BY account_id, end_date DESC, start_date DESC, id   -- même tri que findLastByAccount (end_date desc)
) p
JOIN public.budget_instances bi ON bi.period_id = p.id
WHERE bi.amount_allocated <> 0          -- copier un 0 ne sert à rien
ON CONFLICT (account_id, category_id) DO UPDATE
  SET amount_base = EXCLUDED.amount_base
  WHERE public.budget_templates.amount_base = 0;   -- jamais d'écrasement d'une ligne non nulle
```

Points de conception : `is_fixed` laissé au défaut ; `UNIQUE(account_id, category_id)` existe déjà (cible du `ON CONFLICT`) ; le trigger `updated_at` s'applique ; la migration tourne avec les droits du propriétaire (pas de RLS). Pas de nouvelle fonction persistante. Tri : `end_date DESC` PostgreSQL place les NULL en premier, comme le tri Supabase du code actuel ; une période ouverte serait donc retenue (cohérent avec le brouillon). Le `start_date DESC, id` ne sert qu'à départager.

Lecture de « par catégorie » : la période la plus récente est celle du compte (spec, hypothèse « catégorie sans budget dans la période la plus récente reste sans ligne »). Aucune reprise dans une période plus ancienne.

### Arrondis, limites
Centimes BIGINT copiés tels quels (les deux colonnes sont BIGINT depuis `20260307000000_migrate_to_v2.sql`). Budget négatif : copié (≠ 0). Budget 0 : rien n'est inséré. Ligne existante à 0 + budget non nul : remplie. Ligne non nulle : intacte (y compris si le budget récent diffère).

### Vérification avant `db push` en prod (lecture seule, à lancer avant)
1. `SELECT count(*), count(*) FILTER (WHERE amount_base <> 0) FROM budget_templates;` : lignes existantes, dont non nulles (qui seront gardées).
2. `SELECT count(*) FROM periods WHERE end_date IS NULL;` : si > 0, vérifier que la « plus récente » retenue est voulue.
3. `SELECT count(*) FROM budget_instances bi JOIN (dernière période par compte) …` : nombre de lignes que la reprise va écrire.
4. Après push : nombre de lignes de configuration par compte (`SELECT account_id, count(*) FROM budget_templates GROUP BY 1`), à comparer à l'estimation du point 3.
Retour arrière : la migration n'altère aucune période ; les lignes ajoutées sont inertes si le code est revert.

### Exploitation
Pas de log SQL ; compter via les requêtes ci-dessus. Pas de donnée personnelle dans les sorties.

### Alternative écartée
Fonction SQL réutilisable (`backfill_budget_templates()`) : ajouterait une fonction à protéger (voir migration `revoke_utility_functions`). Une instruction rejouable suffit ; le test inclut le fichier de migration (`\ir`) pour tester le vrai SQL, pas une copie.

### Cas de test
`supabase/tests/backfill_budget_templates_test.sql` (format des tests existants, lancé par `npm run test:sql`, dans une transaction annulée ; inclut la migration via `\ir ../migrations/…`).

| Situation | Résultat attendu | Pourquoi |
| --- | --- | --- |
| Compte avec 2 périodes, budgets différents, aucune ligne | lignes = budgets de la période à `end_date` la plus récente | CA4 |
| Ligne existante à 0 | remplie | CA4 |
| Ligne existante non nulle (≠ budget récent) | inchangée | CA5 |
| Rejeu (migration incluse 2 fois) avec lignes non nulles | même état, aucune erreur, aucun doublon | CA5, rejouable |
| Rejeu après que Lucas a changé une valeur non nulle | valeur de Lucas gardée | CA5 |
| Budget négatif dans la période récente | ligne = valeur négative | signe copié |
| Budget 0 dans la période récente, pas de ligne | aucune ligne créée | rien à reprendre |
| Budget 0 récent, ligne existante non nulle | inchangée | pas d'écrasement |
| Catégorie sans budget dans la période récente, présente dans une plus ancienne | pas de ligne | hypothèse spec |
| Compte sans période | rien | CA2 |
| Récurrentes présentes | jamais reprises | CA4 |
| Deux comptes | chacun sa propre période récente, pas de mélange | isolation |

## Cas du canard (écriture de la configuration, partie non sensible mais cadrée ici)
- Enregistrement de plusieurs lignes : **une seule requête `upsert`** (un seul ordre SQL, donc tout ou rien) sur `(account_id, category_id)`. Avant l'écriture, le use case vérifie que chaque `categoryId` appartient au compte (`findAllByAccount`) et qu'il n'y a pas de doublon ; sinon 400, aucune écriture (la RLS ne vérifie pas l'appartenance de la catégorie).
- Catégorie supprimée pendant que l'écran est ouvert : l'ID n'appartient plus au compte, donc tout le lot est refusé (400/409, rien d'écrit) ; le front recharge la liste. Catégorie ajoutée pendant ce temps : absente du payload, donc sans ligne (0), visible au rechargement.
- Montants : entiers en centimes (chaîne numérique, bigint) ; non entier, NaN, hors bigint : 400.

## Fichiers de la partie sensible (le mode standard n'y touche pas)
- `functions/src/budgets/domain/proposed-amount.ts` et `proposed-amount.spec.ts` (nouveaux)
- `functions/src/periods/application/get-period-draft.use-case.ts` et `.spec.ts`
- `supabase/migrations/20261105100100_backfill_budget_templates.sql` (nouveau)
- `supabase/tests/backfill_budget_templates_test.sql` (nouveau)

Dépendance : le use case du brouillon utilise `BudgetRepository.findTemplatesByAccount` (signature ci-dessus). Le mode standard l'ajoute (interface, repo Supabase, spec du repo) dans le premier incrément ; sinon le mode implementation l'ajoute.

## Incréments non sensibles prévus (mode standard)
1. Repo : `findTemplatesByAccount` et `saveTemplates(accountId, items)` (un `upsert` unique) + spec du repo.
2. API : use cases lecture (toutes les catégories, montant configuré ou proposition via `proposedAmountForConfigScreen`, donc dépend du fichier sensible : laissé au mode `implementation` si le fichier n'existe pas encore) et écriture (validations ci-dessus) + routes dans `periods.controller.ts` (ex. `GET/PUT /:accountId/budget-templates`), droits identiques aux périodes, tests CA7.
3. Front : écran de configuration, `types.ts`, `fr.json`/`en.json`, `create-period-dialog.tsx` (stats indicatives).
4. `http/budgets-fixes.http` (CA1 à CA8 en réel, utilisateurs jetables) ; requête SQL de mesure (catégories en dépassement par période : `amount_allocated` contre la somme réelle des transactions par catégorie), exécutée avant d'être donnée.
