# Reporting — chiffres et graphiques pour comprendre ses comptes

Mise à jour : 2026-11-01 · Commit : 1d14c8f

Code : back `functions/src/reporting/` ; front `frontend/src/features/reporting/` ; fonctions SQL d'évolution dans `supabase/migrations/20260105*`, `20260127*`, `20260307120000_create_budget_stats_func.sql`, `20260308100000_add_sum_transactions_func.sql` (sauf `sum_transactions_before_date`, appelée via le dépôt de transactions pour le solde de départ, les cas d'usage calculent en TypeScript).

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Période | Intervalle de budget (début, fin éventuelle, active ou clôturée). |
| Réel / prévu | Réel = somme des transactions de la période ; prévu = budget alloué à la catégorie pour la période. |
| Solde en banque | Solde de départ + transactions rapprochées (`reconciled`, pointées avec le relevé). |
| Solde à venir | Solde de départ + transactions non « en attente » (`pending`). |
| Solde prévisionnel | Deux formules volontairement distinctes, ne pas les confondre : **stats** (cartes) = départ + max(revenus réels, prévus) − max(\|dépenses réelles\|, \|prévues\|) (projection de fin de période) ; **évolution** (graphique par période) = départ + toutes les transactions de la période (réalisé, y compris à venir). |
| Anomalie | Transaction suspecte : doublon ou dépense inhabituelle. |
| Récurrente | Opération répétée chaque mois à un jour fixe. |

Montants en centimes (texte dans les réponses).

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Revenus réels = catégories de type revenu ou virement ; dépenses réelles = toutes les autres (dépenses et épargne). | `application/get-period-stats.use-case.ts:67-79` | ✅ `get-period-stats.use-case.spec.ts` |
| Solde de départ = solde initial du compte + transactions avant le début de la période. | `get-period-stats.use-case.ts:42-47` | ✅ `get-period-stats.use-case.spec.ts` |
| Solde prévisionnel = départ + max(revenus réels, prévus) − max(\|dépenses réelles\|, \|prévues\|). | `get-period-stats.use-case.ts:96-110` | ✅ `get-period-stats.use-case.spec.ts` |
| Stats : erreur si compte ou période introuvable. | `get-period-stats.use-case.ts:36` | ✅ `get-period-stats.use-case.spec.ts` |
| Répartition budget : par catégorie réel, budget, reste (= budget + réel pour les dépenses et l’épargne ; = budget − réel pour les revenus et virements, c’est-à-dire ce qu’il reste à percevoir), % consommé (arrondi à l’entier le plus proche, .5 arrondi en s’éloignant de zéro) ; le % est inversé (rendu positif) pour les dépenses. Classée en revenus / dépenses / épargne / virements. | `get-budget-breakdown.use-case.ts:62-90` | ✅ `get-budget-breakdown.use-case.spec.ts` |
| Comparaison : différence = période B − période A ; % = variation du montant = (\|B\| − \|A\|) / \|A\| (arrondi au centième le plus proche ; 0 si A vaut 0), donc positif quand on dépense ou reçoit plus. Écran : flèche ↗ si le montant monte, couleur rouge pour une dépense qui monte et verte pour un revenu qui monte ; A = 0 et B ≠ 0 → « Nouveau ». Le « `compareWith` » de l'URL joue le rôle de la période 1, la période de l'URL celui de la 2. | `get-period-comparison.use-case.ts`, `period-comparison.tsx` (`ComparisonGap`), `reporting.controller.ts` | ✅ `get-period-comparison.use-case.spec.ts`, `period-comparison.test.tsx` |
| Évolution : une ligne par période triée par date ; ici le prévisionnel = départ + toutes les transactions de la période (≠ formule des stats). | `get-evolution.use-case.ts:104-106` | ✅ `get-evolution.use-case.spec.ts` |
| Patrimoine net : somme, sur tous les comptes accessibles à l'utilisateur, du solde initial + transactions jusqu'à aujourd'hui inclus (les transactions datées dans le futur sont exclues) ; l'historique donne le vrai solde de fin de journée pour chacun des 31 jours (aujourd'hui inclus), transactions rejouées jour par jour ; le dernier point égale le total courant. Un seul chargement des transactions par compte. | `get-net-worth.use-case.ts` | ✅ `get-net-worth.use-case.spec.ts` |
| Dates métier (colonnes `date`) : une date calendaire est un `Date` à minuit UTC (`shared/domain/date-only.ts`) ; « aujourd'hui » est la date du fuseau métier (`APP_TIME_ZONE`, `Europe/Paris` par défaut), jamais celle de l'heure locale du serveur, et les dates reçues (`YYYY-MM-DD` ou ISO) sont lues sur leurs 10 premiers caractères. Les rapports (trésorerie, calendrier, patrimoine, anomalies) et le brouillon de période en dépendent. | `date-only.ts` | ✅ `date-only.spec.ts`, `npm run test:tz` (3 fuseaux) |
| Trésorerie prévue : solde du jour (transactions jusqu'à aujourd'hui inclus) puis, jour par jour sur `days` jours (entier de 1 à 365, 90 par défaut ; hors de ces bornes ou non numérique → 400), ajout de chaque récurrente dont le jour du mois correspond (un jour absent du mois, ex. 31 en avril, tombe le dernier jour du mois, une seule fois, via `shared/domain/recurring-day.ts`). Même si elle a déjà été payée aujourd'hui, elle est comptée. | `get-cashflow-forecast.use-case.ts:34-75`, `reporting.controller.ts` (`CashflowQueryDto`) | ✅ e2e `front-contract.e2e-spec.ts` (défaut 90, bornes, 400) |
| Le calendrier exige `year` (entier 1900-2100) et `month` (entier 1-12) : absents ou invalides → 400 (« year must not be greater than 2100 », « month must not be less than 1 », « year must be an integer number »…), au lieu de 500 « Invalid time value » | `reporting.controller.ts` (`CalendarQueryDto`) | ✅ e2e `validation.e2e-spec.ts`, `http/entrees-invalides.http` |
| Calendrier d'un mois : transactions réelles + récurrentes projetées pour aujourd'hui et les jours futurs du mois (jour absent du mois → dernier jour du mois, même règle que la trésorerie) ; une récurrente est écartée si le même jour existe une transaction au même montant dont la description contient son libellé. Trié par date. | `get-calendar-data.use-case.ts:63-96` | ✅ `get-calendar-data.use-case.spec.ts` (« return actual and projected », « not project already paid ») |
| Résumé par tag : total et nombre de transactions par tag, trié par montant absolu décroissant ; couleur par défaut `#94a3b8`. Détail d'un tag : erreur si le tag est d'un autre compte ; répartition par catégorie en % du total absolu (arrondi à l’entier le plus proche) ; 5 dernières transactions. | `get-tags-summary.use-case.ts`, `get-tag-details.use-case.ts:50-135` | ✅ `get-tags-summary.use-case.spec.ts`, `get-tag-details.use-case.spec.ts` |
| Anomalie « doublon » : plusieurs dépenses le même jour avec le même montant ; ignore revenus et dépenses de moins de 5 € (montant > −500 centimes). | `get-anomalies.use-case.ts:80-88` | ✅ `get-anomalies.use-case.spec.ts` (doublons, petits montants) |
| Anomalie « dépense inhabituelle » : dépense catégorisée plus de 3 fois supérieure à la moyenne des 6 mois précédents de sa catégorie, avec au moins 3 transactions d'historique. | `get-anomalies.use-case.ts:118-141` | ✅ idem (« outlier > 3x ») |
| Période d'analyse des anomalies : la période donnée, sinon le mois en cours ; historique = 6 mois avant le début. | `get-anomalies.use-case.ts:28-47` | ✅ `get-anomalies.use-case.spec.ts` |
| Ignorer une anomalie : ajoute le type dans les métadonnées de chaque transaction listée ; une transaction inconnue ou d'un autre compte → 404 identique pour toute la requête, vérifié avant la première écriture (rien n'est marqué) ; les transactions sont marquées toutes ensemble par `TransactionRepository.updateMany` (fonction SQL `update_transactions`, une seule transaction : toutes ou aucune). Les anomalies ignorées ne ressortent plus. | `ignore-anomaly.use-case.ts:12-34` | ✅ `ignore-anomaly.use-case.spec.ts`, e2e `cross-account-references.e2e-spec.ts` ; « ignorées » ✅ `get-anomalies...spec` |

## Ce qu'on stocke
Rien en propre (tables lues : transactions, catégories, budgets, périodes, récurrentes, tags, comptes). Seule écriture : l'ignorance d'anomalie ajoute `ignoredAnomalies` (liste de types) dans les métadonnées d'une transaction.

## Ce qu'on peut faire
Identité : toutes les routes sont sous `SupabaseAuthGuard` (jeton Supabase exigé ; identité `{id,email}` dans le jeton). Pas de middleware. Aucun cas d'usage ne vérifie que `accountId` appartient à l'utilisateur : la protection repose sur la RLS de la base (client créé avec l'en-tête `Authorization` de l'appelant, `functions/src/supabase/supabase.module.ts`). En revanche, toute période (`:periodId` ou `?periodId=`) et tout tag doivent appartenir à `:accountId` : sinon 404 identique à « inexistant » (`account-ownership.ts`). Une période inconnue donne désormais 404 aussi pour le résumé et le détail des tags (avant : ignorée, stats globales).

| Action | Point d'entrée (préfixe `/:accountId`) | Qui | Effet | Source (`reporting.controller.ts`) |
| --- | --- | --- | --- | --- |
| Stats d'une période | `GET /periods/:periodId/reporting/stats` | connecté | 8 soldes | l.270 |
| Répartition du budget | `GET /periods/:periodId/reporting/budget-breakdown` | connecté | par catégorie | l.280 |
| Comparer deux périodes | `GET /periods/:periodId/reporting/comparison?compareWith=` | connecté | écarts | l.308 |
| Évolution | `GET /reporting/evolution` | connecté | une ligne par période | l.292 |
| Trésorerie prévue | `GET /reporting/cashflow?days=` | connecté ; `days` entier 1 à 365 facultatif (défaut 90), sinon 400 | solde + événements | l.331 |
| Résumé des tags | `GET /reporting/tags-summary?periodId=` | connecté | liste | l.342 |
| Détail d'un tag | `GET /reporting/tags/:tagId?periodId=` | connecté | détail | l.352 |
| Calendrier | `GET /reporting/calendar?year=&month=` | connecté | événements du mois | l.363 |
| Anomalies | `GET /reporting/anomalies?periodId=` | connecté | liste | l.378 |
| Ignorer des anomalies | `POST /reporting/anomalies/ignore` (`transactionIds`, `type` ∈ duplicate/outlier ; `spike` → 400) | connecté | écrit les métadonnées | l.246 |
| Patrimoine net (tous comptes) | `GET /reporting/net-worth` | connecté ; **l'`accountId` de l'URL est volontairement ignoré** : le patrimoine net est global (tous les comptes accessibles via la RLS, possédés + partagés), jamais celui d'un seul compte | total + 30 jours | l.261 |

Front : un hook par route dans `api/` (clés React Query dédiées) ; écrans `ui/` : cartes de stats (`dashboard-stats.tsx`), répartition (`budget-breakdown.tsx` : un reste négatif, donc un budget dépassé, est affiché en « X de dépassement » (rouge) pour une dépense ou l'épargne et en « +X au-delà du budget » (vert) pour un revenu ou un virement, au lieu de sa valeur absolue ; la barre d'une dépense ou de l'épargne est rouge seulement si |réel| > |budget|, verte sinon ; une catégorie sans budget (0) mais avec un montant affiche une barre pleine, rouge pour une dépense ou l'épargne), évolution (`evolution-chart.tsx`), comparaison (seul contenu de l'écran Flux), calendrier (`financial-calendar.tsx` + `calendar/`), trésorerie (`cashflow-forecast.tsx`), anomalies, patrimoine net, pulse (pourcentage arrondi à l'entier le plus proche, moitié vers l'extérieur, calcul dans `shared/lib/percentage.ts` ; 0 si les dépenses de référence sont nulles), top dépenses, échéances. Les widgets du tableau de bord sont déclarés dans `features/preferences/config/dashboard-widgets.tsx`. Types : `model/types.ts`.

## Statuts et transitions
Pas de cycle de vie. Une anomalie ignorée le reste (aucune route pour la rétablir).

## Zones d'ombre
- Les `transactionIds` de l'ignorance d'anomalies doivent être des UUID : sinon 400 (voir `transactions.md`). Les identifiants de route (`:accountId`, `:periodId`, `:tagId`) sont validés en UUID (400, voir `transactions.md`), sauf le segment `:accountId` de `reporting/net-worth` qui est ignoré. Les identifiants de query (`periodId` de `anomalies`, `tags-summary` et `tags/:tagId`, optionnel ; `compareWith` de `comparison`, obligatoire) sont validés en UUID via `PeriodQueryDto` / `CompareWithQueryDto` : sinon 400.
- Trésorerie prévue : le front l'appelle en `GET` (`use-cashflow-forecast.ts:10`) et le back l'expose désormais en `GET` ; l'ancienne route `POST` n'existe plus (404). Le défaut de 90 jours et les bornes de `days` sont couverts par les tests e2e.
- `forecastBalance` a deux définitions différentes (stats vs évolution) ; laquelle fait foi n'est pas dit.
- Revenus réels incluent les virements, dépenses réelles incluent l'épargne : choix métier non expliqué.
- Seuil de 5 € pour les doublons et facteur 3 pour les dépenses inhabituelles : valeurs non justifiées.
- Les fonctions SQL d'évolution (balance/evolution) existent en base, mais aucun appel depuis `reporting/` n'a été trouvé ; leur usage éventuel ailleurs n'a pas été vérifié.
