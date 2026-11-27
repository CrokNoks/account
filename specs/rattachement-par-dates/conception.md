# Conception — fenêtre de période, composition à 6 lignes, choix des pending supprimées

## Ce que ça calcule ou décide
- **Fenêtre** : (transaction, période, catégorie déclencheuse du compte) → la transaction compte-t-elle dans les totaux de la période ? Une seule fonction, appelée partout (CA1 à CA3, CA5).
- **Composition** : mêmes transactions de fenêtre → 6 lignes dont la somme est le prévu au centime (CA4).
- **Suppression** : période → quelles `pending` récurrentes disparaissent, par leurs dates (CA7, CA8).

## L'algorithme

### 1. Fenêtre (domain/period-window.ts, fonction pure)
```ts
interface WindowPeriod { startDate: Date; endDate: Date | null; isActive: boolean; triggerCategoryId: string | null }
interface WindowTransaction { date: Date; pending: boolean; categoryId?: string | null; metadata?: Record<string, any> }
isInPeriodWindow(t, period): boolean
isNextPaie(t, period): boolean   // exportée, utilisée par le test et la liste
```
Règle, dans l'ordre :
1. `t.date < startDate` → false.
2. Période **fermée** : `endDate === null` → true (comportement actuel inchangé, voir point à trancher) ; sinon `t.date <= endDate`.
3. Période **active** : `isNextPaie(t, period)` → false ; sinon true (la fin n'est qu'indicative).
`isNextPaie` = période active ET `endDate !== null` ET `triggerCategoryId !== null` ET `t.pending` ET `t.categoryId === triggerCategoryId` ET `metadata.recurringId` non vide ET `t.date > endDate` (strict, dates sans heure). Plus aucune condition sur le montant ni sur `reconciled`.

Disparaissent : `isLateReconciledIncome`, `LateIncomeTransaction`. `periodLoadEndDate` reste (active → `undefined`, fermée → fin) : c'est la borne demandée au dépôt.

### 2. D'où viennent les données (côté use cases)
- `triggerCategoryId` = la catégorie du compte avec `isPeriodTrigger` (`Category.isPeriodTrigger`, au plus une par compte). Tous les use cases chargent déjà `categoryRepository.findAllByAccount` (stats/simulation via `loadPeriodForecastInput`, évolution, anomalies, tag, breakdown) ; sinon un appel est ajouté.
- Un petit constructeur `toWindowPeriod(period, categories): WindowPeriod` (même fichier) pour ne pas répéter la recherche de la catégorie.
- `recurringId` = `transaction.metadata.recurringId` (déjà posé par la bascule, `period-switch.ts:437-459`) : `Transaction` satisfait `WindowTransaction` tel quel, aucun nouveau champ.

### 3. Chargement par le dépôt
- Active : `findAllByAccountUnpaginated(accountId, { startDate })` **sans borne de fin** (même quand `endDate` existe) puis `filterPeriodWindow`. Fermée : `{ startDate, endDate }`. Fermée sans fin : `{ startDate }`.
- Liste Opérations (`applyPeriodWindow`, `findAllByPeriod`, controller `:516-531`) : le contrôleur passe `triggerCategoryId` dans la fenêtre. SQL équivalent pour une active : `date >= début` ET NON (`pending` ET `category_id = T` ET `metadata->>recurringId` non nul ET `date > fin`), soit en PostgREST `.or('date.lte.FIN,pending.eq.false,category_id.is.null,category_id.neq.T,metadata->>recurringId.is.null')` (le `is.null` est nécessaire : `neq` sur NULL est faux). Un test d'intégration SQL/`.http` vérifie que liste et prévu donnent les mêmes lignes.
- Rythme (CA6) : active → la courbe va jusqu'à `today` (la fin n'est plus un plafond) ; fermée → sa fin. Détail d'un tag (CA5) : même chargement + `filterPeriodWindow` avant le filtre par tag.

### 4. Composition à 6 lignes (domain/forecast-composition.ts)
`banque + CB + factures + reports + budgetRestant + revenusAttendus = prévu`.
- `CompositionInput` perd `lateReconciledIncome` ; `ForecastComposition` perd `arrivedAfterEnd` ; `BankBalancesInput` perd `lateReconciledIncome`.
- Pourquoi l'égalité tient sans correctif : un revenu pointé tardif est maintenant dans la fenêtre, donc dans `banque` (pointées de la fenêtre) et dans le total de la fenêtre du prévu. Une seule règle pour les deux sommes.
- Retirés aussi : `arrivedAfterEnd` dans `get-period-stats.use-case.ts:32,169` et `reporting.controller.ts:277` ; `lateReconciledIncome` dans `load-period-forecast-input.ts`, `get-evolution.use-case.ts:115-119`.

### 5. Suppression (SQL, une seule règle)
Helper unique `public.period_window_bounds(p_period_id)` (STABLE, SECURITY INVOKER, `search_path` fixé, REVOKE PUBLIC/anon comme les autres) → `(lo date, hi date)` :
- `lo = start_date`
- `hi` = NULL si `is_active` (pas de borne, prochaine paie comprise) ; sinon `end_date` ; si fermée sans `end_date` : veille du début de la période suivante du compte, NULL s'il n'y en a pas (la suppression est destructive : on ne laisse jamais une fermée sans fin avaler les périodes suivantes).
`period_deletion_plan` et `delete_period_clean` utilisent le **même prédicat** `account_id = d.account_id AND date >= lo AND (hi IS NULL OR date <= hi)` :
- `removedPending` = count(`pending IS TRUE AND metadata->>'source' = 'recurring'`) dans la fenêtre ;
- `keptTransactions` = count(fenêtre) − removedPending ;
- le DELETE réévalue `pending` et `source` dans la même instruction (une ligne pointée entre-temps reste) ;
- plus d'`UPDATE ... SET period_id` pour les conservées (CA8 : elles apparaissent dans la période rouverte par leurs dates) ; la réouverture (`end_date = closed_period_end`) et les verrous D puis X sont inchangés.
Une pending récurrente hors de toute fenêtre (avant toute période, entre deux) n'est plus supprimée : conséquence assumée par la spec.

## Données et structure
Fonctions pures `period-window.ts` et `forecast-composition.ts` (moins de 150 lignes chacune) ; `load-period-forecast-input.ts` les branche ; le dépôt ne connaît que la traduction SQL de la même règle ; SQL : un helper + deux fonctions réécrites dans la migration `{horodatage}_rattachement_par_dates.sql`.

## Arrondis, limites et cas particuliers
- Centimes entiers (`bigint`), aucun arrondi : la fenêtre ne touche pas aux montants, seulement à l'inclusion.
- Dates sans heure, bornes incluses (début et fin) ; « strictement après la fin » pour la prochaine paie.
- Priorité : début d'abord, puis nature de la période (fermée / active), puis exclusion prochaine paie.
- Active sans fin, ou sans catégorie déclencheuse : rien à exclure.
- **Point à trancher (canard) : période fermée sans fin.** Aujourd'hui elle n'a pas de borne haute côté calcul ; si elle existait avec une suivante, elle compterait aussi ce qui est dans la suivante (double compte). Proposition : on **garde** ce comportement dans le calcul (aucun changement, cas rare car la clôture pose toujours une fin ; test qui le documente) et on borne seulement la **suppression** (ci-dessus). Alternative : passer `nextStartDate` à la fenêtre (signature plus lourde). Dis-moi si tu veux l'alternative.

## Exploitation
- Log existant `period_deleted` (`removedPending`, `keptTransactions`) inchangé ; l'aperçu et la suppression viennent du même plan.
- Pas de feature flag (spec). Retour arrière : script `supabase/queries/rattachement-par-dates-retour.sql` (recréer `period_id`, recalculer par dates, rejouer les anciennes fonctions), écrit avec la migration et rejoué en local.
- Mesure : requête SQL avant/après (prévu ancienne vs nouvelle fenêtre) lancée avant la migration.

## Alternative écartée
Garder `isLateReconciledIncome` comme correctif de composition avec une 7e ligne : c'est la dérive actuelle (deux règles à garder alignées). La fenêtre unique rend la ligne inutile.

## Cas de test qui prouvent que c'est juste
Test écrit avant le code (`period-window.spec.ts`, `forecast-composition.spec.ts`, `delete_period_test.sql`). Période P : début 2026-11-01, fin 2026-11-30, déclencheuse T. « Paie » = `pending`, catégorie T, `recurringId` présent.

| Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- |
| Fermée, date = début | dans | borne incluse |
| Fermée, date = fin | dans | borne incluse |
| Fermée, date = veille du début / lendemain de la fin | hors | CA1 |
| Fermée, revenu pointé daté après la fin | hors | plus d'exception |
| Fermée sans fin, avec une période suivante dont une transaction à J+40 | dans (comportement gardé) ; documenté, ne s'applique pas à la suppression | cas du canard : le double compte est visible dans le test |
| Active, dépense datée après la fin | dans | CA2 |
| Active, revenu non pointé daté après la fin (sans catégorie T) | dans | CA2, changement de comportement |
| Active, revenu pointé daté après la fin | dans | CA2 |
| Active, paie `pending` + `recurringId`, date = fin + 1 | hors | CA3 |
| Active, même paie, date = fin | dans | « strictement après » |
| Active, paie `pending` datée dans la période | dans | CA3 |
| Active, paie **pointée** datée après la fin (non pending) | dans | CA3 |
| Active, paie `pending` sans `recurringId` après la fin | dans | CA3 |
| Active, `pending` + `recurringId` d'une autre catégorie après la fin | dans | seule la déclencheuse |
| Active sans fin, paie `pending` + `recurringId` à J+60 | dans (rien d'exclu) | cas du canard |
| Active, `triggerCategoryId = null`, paie `pending` après la fin | dans | pas de déclencheuse |
| Active, date < début | hors | début d'abord |
| `filterPeriodWindow` sur 3 périodes consécutives (fermées avec fin) | chaque transaction dans une seule | pas de double compte entre périodes |

Cas chiffré composition = prévu (`get-period-stats.use-case.spec.ts` + `forecast-composition.spec.ts`), en centimes. Compte à 100 000 ; avant le début : revenu pointé +20 000 et facture `pending` −5 000 ; période active (fin 11-30). Fenêtre : CB non pointée −3 000, facture `pending` −8 000, dépense pointée −1 000 (catégorie X, budget 20 000), **salaire pointé +200 000 daté 12-03 (après la fin)**, revenus attendus restants 50 000 sur la catégorie de revenu (budget 250 000).

| Ligne | Calcul | Centimes |
| --- | --- | --- |
| En banque | (100 000 + 20 000) + (−1 000 + 200 000) | 319 000 |
| CB | | −3 000 |
| Factures | | −8 000 |
| Reports | −5 000 | −5 000 |
| Budget restant | 20 000 − 12 000 → reste négatif | −8 000 |
| Revenus attendus | 250 000 − 200 000 | +50 000 |
| **Somme = prévu** | départ 115 000 + fenêtre 188 000 + 50 000 − 8 000 | **345 000** |

Vérifier aussi : réponse stats sans clé `arrivedAfterEnd` ; `En banque` et `À venir` contiennent les +200 000.

Suppression (`delete_period_test.sql`, `periods-deletion.e2e-spec.ts`) :

| Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- |
| Fermée [11-01, 11-30] : récurrente `pending` au 11-01 et 11-30, au 10-31 et 12-01 | seules celles de 11-01 et 11-30 supprimées | CA7 bornes |
| Fermée : `pending` récurrente pointée / saisie / importée dans la fenêtre | conservées | périmètre |
| Active : `pending` récurrente datée avant la fin et la prochaine paie à fin + 1 | les deux supprimées | CA7 « prochaine paie comprise » |
| Active : `pending` récurrente datée avant le début | conservée | hors fenêtre |
| Fermée sans fin avec une suivante : `pending` à J+40 dans la suivante | conservée (fenêtre bornée à la veille de la suivante) | non destructif |
| Aperçu vs suppression, même période | mêmes `removedPending` et `keptTransactions` | un seul prédicat |
| Annulation de bascule : active D (ouverte par le déclencheur) avec récurrentes + prochaine paie | supprimées ; période précédente rouverte avec sa fin d'avant ; conservées visibles dans sa fenêtre par leurs dates, `date` inchangée | CA8 |

## Fichiers de la partie sensible (le mode standard n'y touche pas)
- `functions/src/reporting/domain/period-window.ts` + `period-window.spec.ts`
- `functions/src/reporting/domain/forecast-composition.ts` + `forecast-composition.spec.ts`
- `functions/src/reporting/application/load-period-forecast-input.ts`
- `functions/src/transactions/infrastructure/supabase-transaction.repository.ts` (fenêtre ; sa partie `period_id` lignes 30 et 428 est faite dans le même fichier au même moment)
- `functions/src/transactions/infrastructure/transactions.controller.ts` (`:516-531` ; ses lignes `periodId` 85, 280, 621, 762 aussi, en implémentation)
- `supabase/migrations/{horodatage}_rattachement_par_dates.sql` (helper, plan, suppression ; le reste de la migration est écrit dans le même fichier en implémentation)
- `supabase/tests/delete_period_test.sql`
- Câblage dépendant de la nouvelle signature, fait en implémentation juste après la fonction (pas relu en détail) : `get-period-stats`, `get-evolution`, `get-budget-breakdown`, `get-anomalies`, `get-tag-details`, `get-spending-pace` (use cases + specs), `reporting.controller.ts` (champ retiré).

## Incréments non sensibles possibles en mode standard
Ordre et dépendances :
1. **Back : `periodId` ignoré en entrée** — `IgnoredLegacyField` sur les corps création/modification (hors `transactions.controller.ts`, sensible : donc **laissé à l'implémentation**) ; `create-transaction.use-case.ts`, `transaction-payload.ts`, `transaction.entity.ts` : ne plus lire ni écrire `periodId`. Dépend du contrôleur → à faire avec lui ; standard peut faire l'entité, le payload et le use case seulement si les appelants ne cassent pas (sinon laisser).
2. **`apply-period-switch.service.ts`, `period-switch.ts`, `supabase-period.repository.ts`** : ne plus poser `period_id` (pas de dépendance à la fenêtre ; compatible avec l'ancienne base, les fonctions SQL lisent NULL).
3. **Front** : retirer `periodId` des types/imports (`model/types.ts:5,19`, `use-bulk-create-transactions.ts:9`, import `page.tsx`, `create-transaction-drawer.tsx`, `use-create-transaction.ts`) et leurs tests. Indépendant.
4. **Front composition** : retirer la ligne `arrivedAfterEnd` (`model/forecast-composition.ts`, `types.ts`, `messages/{fr,en}.json` `composition_arrived`, `dashboard-stats.test.tsx`, `forecast-composition.test.ts(x)`). Compatible avec l'ancien back ; ne se déploie qu'après le back.
5. **SQL de lecture/seed** : réécrire par dates `supabase/queries/depassements-par-periode.sql`, `prevu-virements-sens.sql`, `prevu-par-categorie.sql`, `supabase/seed.sql` ; créer `supabase/queries/rattachement-par-dates.sql` (mesure, à lancer **avant** la migration). Indépendant.
6. **Vérification par grep** de `account-references.service.ts`, `transaction.repository.interface.ts`, `budgets/**` pour un usage de `transactions.period_id` (le `period_id` des budgets reste).

Laissés à l'implémentation (dépendent de la partie sensible ou de la migration) : tout ce qui est listé ci-dessus comme sensible, le script de retour arrière, `period_trigger_test.sql`, `security_definer_search_path_test.sql`, `periods-deletion.e2e-spec.ts`, les `.http` (`suppression-periode-propre`, `soldes-et-prevu-justes`), la mise à jour de `docs/` (documentaliste).

Commits prévus : (1) standard 2 à 5 ; (2) sensible : fenêtre + composition + câblage + liste Opérations (relue) ; (3) sensible : migration (suppression par dates + retrait de `period_id`) + retour arrière + tests SQL/e2e + `.http`.
