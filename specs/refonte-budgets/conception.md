# Conception — refonte-budgets (2 parties sensibles)

Tout montant : centimes entiers, `bigint` côté back, texte dans les réponses. Aucun flottant.

---

## Partie 1 — Simulation du prévu

### Ce que ça calcule
Comptes de la période + liste complète de budgets saisis → le `forecastBalance` que donneraient les stats après enregistrement de ces budgets, plus l'effet de chaque côté (revenus, dépenses). Lecture seule.

### Algorithme (fonction pure `computePeriodForecast`, `reporting/domain/period-forecast.ts`)
Entrées : `startBalance`, `categories[{id,type}]`, `realByCategory`, `uncategorized`, `budgets[{categoryId, amount}]`.
1. `planned(cat)` = |montant du budget de la catégorie|, ou 0 si absent. Un budget à 0 ou absent, c'est la même chose (|0| = 0).
2. Pour chaque catégorie : type `income` ou `transfer` → ajoute le réel à `realIncome` et `planned` à `plannedIncome` ; sinon (`expense`, `savings`) → `realExpenses`, `plannedExpenses`.
3. `maxIncome = max(realIncome, plannedIncome)` (réel sans valeur absolue, comme aujourd'hui).
4. `maxAbsExpenses = max(|realExpenses|, |plannedExpenses|)`.
5. `forecastBalance = startBalance + maxIncome − maxAbsExpenses + uncategorized` (sans catégorie : `pending` comprises, au réel).
Retourne les totaux des étapes 2 à 5. C'est un déplacement à l'identique du code de `get-period-stats.use-case.ts:86-133`, sans changement de formule ni d'ordre de traitement.

### Données et structure
- `get-period-stats.use-case.ts` appelle la fonction, réponse inchangée (la composition `computeForecastComposition` reçoit les mêmes totaux).
- Le chargement des entrées (compte, période, catégories, départ, transactions de la période, regroupement réel par catégorie / sans catégorie) est lui aussi partagé : petite fonction `loadPeriodForecastInput` (`reporting/application/`), utilisée par les stats et la simulation. Sinon le réel serait calculé à deux endroits.
- Nouvelle route : `POST :accountId/periods/:periodId/reporting/forecast-simulation`, dans `reporting.controller.ts`. Body : `{ budgets: [{categoryId, amountAllocated}] }` (mêmes DTO et `IsCents` que `PUT :id/budgets`). C'est la liste complète : une catégorie absente = sans budget (comme après un `PUT`). Les budgets enregistrés ne sont pas lus pour la simulation (sauf pour la ligne « enregistré », voir réponse).
- POST et non GET : 30 à 60 catégories × UUID + montant ne tiennent pas proprement dans une URL. La route ne contient aucun appel d'écriture (`save`, `replaceForPeriod`) ; le cas d'usage ne reçoit que des dépôts en lecture utilisés (pas d'injection de `UpdatePeriodBudgetsUseCase`).
- Réponse : `{ forecastBalance, savedForecastBalance, delta, incomeEffect, expensesEffect, plannedIncome, plannedExpenses, realIncome, realExpenses }`, tout en centimes texte. `savedForecastBalance` = la même fonction avec les budgets enregistrés (donc égal à `forecastBalance` des stats). `delta = forecastBalance − savedForecastBalance`. `incomeEffect = maxIncome_simulé − maxIncome_enregistré` ; `expensesEffect = −(maxAbsExpenses_simulé − maxAbsExpenses_enregistré)` ; `delta = incomeEffect + expensesEffect`.
- Droits identiques aux stats : `SupabaseAuthGuard` + dépôts sous le jeton de l'appelant (RLS) + même contrôle compte/période → 404 « Account or Period not found ». Un membre en lecture seule obtient 200 (il lit déjà les stats) ; un anonyme 401 ; un autre utilisateur connecté 404. Les catégories du body sont vérifiées avec `AccountReferencesService.ensureCategories` (comme le PUT) ; catégorie en double dans le body → 400 ; montant illisible → 400. Les négatifs sont acceptés (valeur absolue, comme le PUT).

### CA3 : savoir qu'un budget n'a pas d'effet
Le front compare la ligne saisie à l'enregistré. Une ligne de dépenses/épargne modifiée est « sans effet » si `plannedExpenses` simulé ≠ enregistré **et** `expensesEffect == 0` ; idem revenus/virements avec `incomeEffect`. Un côté dont la valeur change un peu (franchit le réel) a un effet non nul : pas de message. Le back calcule, le front n'a aucune formule d'argent. Limite : le message se rapporte au côté, pas à la ligne seule (deux lignes du même côté modifiées dont une seule compte : message selon l'effet du côté). Doute 1 ci-dessous.

### Limiter les appels sans chiffre périmé
- Le front envoie la simulation après 300 ms sans frappe (debounce), avec une `queryKey` contenant la liste de budgets saisie. Chaque saisie annule la requête précédente (abort) et la réponse d'une saisie plus ancienne est ignorée : seule la réponse de la dernière valeur est affichée.
- Tant que la réponse de la dernière valeur n'est pas arrivée, le chiffre affiché est grisé avec « calcul en cours » (jamais l'ancien chiffre présenté comme à jour), et Enregistrer reste possible mais le chiffre affiché ne dit « égal aux stats » qu'après réponse. Après un enregistrement réussi, la requête est invalidée et le prévu affiché est celui des stats.
- Pas d'appel pour une saisie illisible/négative (erreur affichée à l'écran) ; pas d'appel s'il n'y a aucune différence avec l'enregistré (le prévu affiché = stats).

### Exploitation
Aucun log ajouté (décision de la spec). Erreurs 4xx/5xx visibles dans les journaux HTTP existants. Retour arrière : revert ; les stats gardent la même fonction, la route disparaît seule.

### Alternative écartée
Copier la formule en JS dans le front et simuler sans appel : instantané, mais deux règles à tenir identiques (la maquette ignore déjà sans-catégorie et le max des revenus). Écartée par la spec (« pas de copie ») ; le prix est un aller-retour réseau par saisie, géré par le debounce.

### Cas de test (écrits avant le code ; fichier `period-forecast.spec.ts` pour la fonction pure, `get-period-stats.use-case.spec.ts` + spec de la simulation pour la parité)
Départ 100000 sauf mention.

| Entrées | Attendu | Pourquoi |
| --- | --- | --- |
| Dépenses : réel −50000, prévu 30000 | prévu = 100000 − 50000 = 50000 | max(réel, prévu) côté dépenses : le réel gagne |
| Dépenses : réel −30000, prévu 50000 | 50000 | le prévu gagne |
| Revenus : réel 200000, prévu 150000 | 100000 + 200000 | max côté revenus : le réel gagne |
| Revenus : réel 100000, prévu 150000 | 100000 + 150000 | le prévu gagne (revenus prévus) |
| Revenu prévu 150000 sans réel ; type `transfer` prévu 20000 sans réel | +170000 | virements comptés comme revenus |
| Épargne : réel −10000, prévu 40000 | −40000 | `savings` compté dans les dépenses |
| Sans catégorie −2000 (dont une `pending`) + dépense prévue 30000 sans réel | 100000 − 30000 − 2000 | sans catégorie compté au réel, hors budgets |
| Budget 0 sur catégorie avec réel −10000, aucune autre | = même catégorie sans budget (planned 0 ; −10000) | 0 traité comme absent |
| Budget stocké −40000 vs +40000 (même catégorie) | résultats identiques | valeur absolue |
| Budget abaissé 80000 → 20000 sur A (réel −50000), B budget 30000 réel −100000 (planned 110000 → 50000 < réel 150000) | `delta` 0, `expensesEffect` 0, `plannedExpenses` change | CA3 : sans effet |
| Même cas, B budget 100000 | `expensesEffect` ≠ 0 | pas de message quand ça bouge |
| Budget qui fait franchir le réel (planned 110000 → 160000 vs réel 150000) | `expensesEffect = −10000` | effet partiel |
| Corps = budgets enregistrés (dont négatif, dont 0 absent) | `forecastBalance` simulation == `forecastBalance` stats, `delta` = 0 | parité (règle critique) |
| Mêmes fixtures que les tests existants des stats | réponses des stats identiques à l'octet (spec existante verte sans modification) | non-régression de l'extraction |
| Corps vide `[]` | tous budgets absents | liste complète |
| Simulation | `replaceForPeriod`, `save`, `delete` jamais appelés | aucune écriture |
| Compte/période d'un autre compte ; période inexistante | 404 | droits = stats |
| Catégorie d'un autre compte ; doublon ; montant « abc » | 404/400/400 | validation |
| `.http` : anonyme / autre utilisateur / membre lecture seule | 401 / 404 / 200 | droits (réel) |
| Tri, front, fonction pure : ligne à budget 0 avec du réel | classée **avant** toutes les lignes à budget > 0 (ratio infini), entre elles par |réel| décroissant | division par 0 : hypothèse de la spec « dépassée, en haut » |
| Tri : catégorie sans budget ni réel | **en dernier** des dépenses/épargne, par nom | rien à consommer |
| Tri : budget > 0, réel 0 (0 %) | après les % > 0, avant « sans budget ni réel » | 0 % ≠ sans budget |
| Tri : % égaux | ordre par nom (stable) | déterminisme |
| Tri : comparaison de deux ratios | par produit croisé en `bigint` (`|réelA|·|budgetB|` vs `|réelB|·|budgetA|`), jamais de flottant | pas d'arrondi ; 100,00 % vs 100,01 % distincts |
| Tri : revenus et virements | restent après dépenses/épargne | CA1 |
| Front, saisie : réponses d'appels croisés (2e arrive avant la 1re) | seul le résultat de la dernière valeur s'affiche | pas de chiffre périmé |

---

## Partie 2 — Détection du changement concurrent (CA6)

### Ce que ça décide
`PUT :id/budgets` + contenu vu à l'ouverture (`expectedBudgets`) → refuse (409) si le contenu enregistré (catégorie → montant) n'est plus celui-là, sinon remplace. Vérification et écriture indivisibles.

### Options comparées
| | A. Comparaison dans `replace_period_budgets` (SQL), verrou dans la transaction | B. Comparaison dans le cas d'usage (lire, comparer, puis `rpc`) | C. Colonne de version sur `periods` + trigger |
| --- | --- | --- | --- |
| Indivisible | oui (un verrou + une transaction) | **non** : deux enregistrements simultanés lisent le même état et passent tous deux | oui |
| Migration | oui, une fonction (pas de table) | non | oui, colonne + trigger, plus de portée (création de période, montants par défaut…) |
| Complexité | faible (≈ 15 lignes SQL) | faible mais incorrecte | élevée ; le front doit porter un numéro en plus |
| Dit la spec | contenu, pas version | contenu | version (spec la rejette : « le contenu ») |

**Recommandation : A.** B est exclue : elle ne tient pas la règle d'indivisibilité.

### L'algorithme (A)
Nouvelle migration (ex. `20261107100000_replace_period_budgets_expected.sql`) : `DROP FUNCTION replace_period_budgets(uuid, jsonb)` puis `CREATE` avec un 3e paramètre `p_expected jsonb DEFAULT NULL` (sinon deux surcharges ambiguës), `REVOKE/GRANT` refaits, `SECURITY INVOKER` conservé.
1. Contrôles existants (p_period_id, tableau, period_id).
2. Si `p_expected IS NOT NULL` : vérifier que c'est un tableau ; `pg_advisory_xact_lock(hashtextextended(p_period_id::text, 0))` (verrou levé à la fin de la transaction ; pas de `FOR UPDATE` sur `periods` pour ne pas dépendre de la politique UPDATE).
3. Comparer en ensemble, **montants à 0 ignorés des deux côtés** : `(courant EXCEPT attendu) ∪ (attendu EXCEPT courant)` non vide → `RAISE EXCEPTION 'budgets changed' USING ERRCODE = 'P0409'`.
4. `DELETE` puis `INSERT` comme avant. Le second enregistrement simultané attend le verrou, relit (READ COMMITTED : nouvelle photo à chaque instruction) et se voit refusé.
Comparaison exacte des montants stockés (−40000 ≠ 40000) : le front renvoie ce qu'il a lu.

Back : `expectedBudgets?: BudgetInitDto[]` ajouté à `UpdateBudgetsDto` (`IsOptionalNotNull`, `ValidateNested`). Le cas d'usage le transmet (filtré des 0) ; `BudgetRepository.replaceForPeriod(periodId, instances, expected?)` n'envoie `p_expected` que s'il est fourni. Le dépôt traduit `error.code === 'P0409'` en `BudgetsChangedError extends ConflictError`.

### Code d'erreur et forme de la réponse
HTTP **409**, corps `{ "statusCode": 409, "error": "Conflict", "code": "BUDGETS_CHANGED", "message": "Budgets of this period changed since they were loaded" }`. Le 409 « catégorie en double » existe déjà : le front se fie à `code`, pas au statut ni au texte. Cela demande que `DomainExceptionFilter` ajoute `code` quand l'erreur en porte un (fichier hors « Fichiers concernés », +1 spec). Sans ce changement, la seule voie serait de comparer le message : fragile. Pas de budgets courants dans la réponse : le front recharge `GET :id/budgets` (CA6). Doute 2.

### Compatibilité
- Autres appelants du `PUT` : le seul est le front (`use-update-period-budgets.ts`, via la feuille supprimée et le nouvel écran) ; aucun `.http` ni script ne l'appelle. **`expectedBudgets` absent = pas de contrôle, comportement actuel** (dernier arrivé gagne). `[]` présent = « je n'ai vu aucun budget » : contrôlé.
- Front actuellement en production (n'envoie pas `expectedBudgets`) : continue de fonctionner dans tous les ordres de déploiement. Ancien back + nouvelle migration : l'appel à deux paramètres nommés résout vers la nouvelle fonction (défaut NULL). Nouveau back + ancienne base : tant que `expectedBudgets` est absent le dépôt n'envoie pas `p_expected` → fonctionne ; avec `expectedBudgets` il échoue (500) : ordre à tenir **migration, puis back, puis front**. Rien n'est poussé ni appliqué par moi.
- Retour arrière : revert du code et d'une migration inverse (recréer l'ancienne fonction à deux paramètres) ; aucune donnée.
- Limite connue : A→B→A (même contenu qu'à l'ouverture) n'est pas détecté ; l'état étant identique, rien n'est perdu.

### Règles côté front (testées côté front, pas sensibles en soi)
`expectedBudgets` = la liste lue à l'ouverture, **gelée tant qu'il y a des saisies non enregistrées** : un rechargement en arrière-plan ne la remplace pas, sinon il masquerait le changement de l'autre personne. Après un enregistrement réussi ou un 409 (après rechargement), la référence redevient la liste rechargée.

### Exploitation
Aucun log ajouté (spec). Le 409 `BUDGETS_CHANGED` est repérable dans les journaux HTTP. Pas de feature flag.

### Alternative écartée
Version par hash du contenu calculé en SQL et renvoyé par `GET` : plus compact à envoyer, mais impose un nouveau champ de lecture et une fonction de hash à tenir identique entre lecture et écriture. Pour 60 lignes au plus, envoyer la liste est plus simple.

### Cas de test (écrits avant le code ; `update-period-budgets.use-case.spec.ts`, `supabase-budget.repository.spec.ts`, filtre, test SQL `supabase/tests/replace_period_budgets_expected_test.sql`, `.http`)
| Entrées | Attendu | Pourquoi |
| --- | --- | --- |
| Attendu == courant | écrit, 200 | cas nominal « comme avant » |
| Un montant différent | 409 `BUDGETS_CHANGED`, base inchangée | CA6 |
| Catégorie ajoutée ou supprimée par l'autre | 409 | changement de contenu |
| `expectedBudgets` absent (ancien front) | écrit, pas de contrôle | compatibilité |
| `expectedBudgets: []`, base vide / non vide | écrit / 409 | vide est une valeur |
| Ligne stockée à 0 d'un côté, absente de l'autre | égal, écrit | 0 = absent |
| Négatif stocké −40000 : attendu −40000 / attendu 40000 | écrit / 409 | comparaison exacte |
| Deux enregistrements simultanés avec le même attendu (2 sessions psql + 2 `curl &`) | un 200, un 409 `BUDGETS_CHANGED` | indivisible |
| Double onglet : A enregistre, B (attendu périmé) enregistre | 409 ; après rechargement B enregistre | CA6 |
| Doublon de catégorie dans le body | 409 **sans** `code` | distinct du changement concurrent |
| Dépôt : erreur RPC `P0409` | `BudgetsChangedError` ; autre code : comportement actuel | traduction |
| Dépôt : `expected` non fourni | `p_expected` absent des paramètres du `rpc` | déploiement ancienne base |
| Filtre : erreur avec `code` / sans | `code` dans le corps / corps inchangé | non-régression des autres 409 |
| Lecture seule + attendu juste | 403 (RLS) comme aujourd'hui | droits inchangés |
| Insertion qui échoue après vérification OK | anciens budgets conservés | atomicité existante |
| Front : rechargement en arrière-plan avec saisies | référence inchangée ; 409 au clic | pas de masquage |

---

## Fichiers occupés
Partie 1 : `reporting/domain/period-forecast.ts` (+spec), `reporting/application/load-period-forecast-input.ts` (nouveau, nom indicatif), cas d'usage de simulation (+spec), `get-period-stats.use-case.ts`, `reporting.controller.ts`, `reporting.module.ts`, `get-period-stats.use-case.spec.ts`, `http/budgets-simulation.http`. Front : fonction de tri, hook de simulation (debounce).
Partie 2 : migration `supabase/migrations/2026110…_replace_period_budgets_expected.sql`, `supabase/tests/replace_period_budgets_expected_test.sql`, `update-period-budgets.use-case.ts` (+spec), `periods.controller.ts` (DTO), `budget.repository.interface.ts`, `supabase-budget.repository.ts` (+spec), `shared/domain/errors.ts` ou domaine budgets (`BudgetsChangedError`), `shared/infrastructure/domain-exception.filter.ts` (+spec), front `use-update-period-budgets.ts`.

## Écarts à la liste « Fichiers concernés » de la spec
`load-period-forecast-input.ts`, `domain-exception.filter.ts` (+ spec), `errors.ts` (ou fichier d'erreur du domaine budgets), test SQL, `use-update-period-budgets.ts` front. Tous petits.

## Doutes à trancher
1. « Sans effet » est calculé par côté (revenus / dépenses), pas par ligne : deux lignes de dépenses modifiées en même temps affichent le même verdict. Acceptable ?
2. Ajouter `code` au filtre d'exceptions (recommandé) ou comparer le message (fragile) ?
3. Après un 409, les saisies non enregistrées sont remplacées par les montants rechargés (CA6 : « rechargés »). Les saisies de Lucas sont perdues ; je n'ajoute rien pour les conserver.
4. Simulation en POST (corps = liste complète) : « route de lecture » au sens « aucune écriture », pas au sens du verbe HTTP.
5. Le « réel » de la simulation inclut `pending` (stats), différent du réel de la répartition utilisé pour la colonne « reste » : déjà noté par la spec ; la parité porte sur le prévu uniquement.
6. Vérifié : `budget-breakdown` compte déjà les `pending` (aucun filtre, `get-budget-breakdown.use-case.ts:50-62`), donc le tri sur son réel respecte « factures en attente comprises ». Sa colonne `percentage` est arrondie et inversée pour les dépenses : le tri recalcule le ratio depuis `real` et `budget`, il n'utilise pas `percentage`.
