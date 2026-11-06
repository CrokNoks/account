# Conception — Aujourd'hui : composition du prévu et rythme de dépense

Deux parties sensibles, deux fonctions pures. Rien n'est codé avant le go.

## À trancher avant le go (écarts et doutes)
1. **La formule de l'hypothèse « budget restant = max(|réel|,|prévu|) − |réel| » casse la somme quand les dépenses nettes sont positives** (remboursements > dépenses : `realExpenses > 0`). Le prévu existant retranche alors `max(|réel|,|prévu|)` alors que le réel a rapporté de l'argent. Pour que la somme reste exacte au centime sans toucher au prévu, je prends `budgetRestant = max(|réel|,|prévu|) + dépensesRéellesSignées`. Identique à l'hypothèse dans le cas normal (dépenses nettes négatives). Dans le cas « remboursement net », le prévu existant est discutable, mais « aucune règle modifiée » : je le laisse et je le teste. À confirmer.
2. **Invariant dépendant de la donnée** : la somme n'est exacte que si toute transaction de la période a une catégorie connue du compte (ou aucune). Une `categoryId` hors liste serait dans les soldes mais pas dans le prévu. Je le suppose impossible (clé étrangère) ; je ne le traite pas.
3. **CA3** : « budget restant » est une ligne négative par construction (sauf 0). La condition « tous les segments positifs » sera donc lue sur les valeurs avant signe (banque, CB, factures ≥ 0 ; revenus attendus = 0 ; prévu ≥ 0) ; la barre dessine le budget restant comme un retrait. C'est côté front (hors de cette conception), à confirmer au cycle d'affichage.
4. **Fichiers** : pour que Lucas relise peu, je propose deux fichiers purs hors de « Fichiers concernés » : `functions/src/reporting/domain/forecast-composition.ts` et `functions/src/reporting/domain/spending-pace.ts` (+ specs). Sinon, les fonctions vivent en export dans les use-cases.
5. Période précédente **sans date de fin** (non active mais `endDate` null) : je la borne à la veille du début de la période choisie. Hypothèse.
6. Signe du rythme : cumul renvoyé en **positif** (argent sorti). Il peut baisser un jour de remboursement.

---

# Partie 1 — Composition du prévu

## Ce que ça calcule ou décide
Entrées : transactions de la période, solde de départ, totaux par catégorie déjà calculés par `get-period-stats`. Sortie : quatre lignes signées (CB, factures, budget restant, revenus attendus) qui, ajoutées au solde en banque, redonnent `forecastBalance` au centime.

## L'algorithme
Le prévu reste `forecastBalance` (formule inchangée, jamais recalculé à partir des lignes). Les lignes sont calculées à côté, puis un test vérifie l'égalité.
1. `bank` = `realBankBalance` (existant : départ + rapprochées).
2. `card` = somme des transactions `!reconciled && !pending`.
3. `bills` = somme des transactions `pending && !reconciled`.
4. `budgetRemaining` = −(`maxAbsExpenses` + `realExpenses`), `realExpenses` signé. Valeurs déjà calculées dans le use-case.
5. `expectedIncome` = `maxIncome` − `realIncome` (≥ 0 puisque `maxIncome` ≥ `realIncome`).
6. Réponse : ajout de `cardTotal`, `billsTotal`, `budgetRemaining`, `expectedIncome` (chaînes de centimes, signées), à côté de `forecastBalance`.

Preuve : `bank + card + bills` = départ + toutes les transactions T (une `pending` rapprochée est dans `bank`, donc exclue de `bills` ; pas de double compte). T = `realIncome` + `realExpenses` + `uncategorized`. Prévu − (départ + T) = (`maxIncome` − `realIncome`) − (`maxAbsExpenses` + `realExpenses`) = lignes 5 et 4.

## Données et structure
- Lieu : `get-period-stats.use-case.ts` (+ spec), plus une fonction pure `forecast-composition.ts` (proposée) qui prend les transactions et les totaux et rend les 4 lignes. Aucune requête en plus : `periodTransactions` est déjà chargé.
- Ne lit rien d'autre ; n'écrit rien.
- Fichiers occupés : `functions/src/reporting/application/get-period-stats.use-case.ts`, `.spec.ts`, (`domain/forecast-composition.ts`, `.spec.ts`). Le DTO de la réponse côté contrôleur n'est pas touché (interface exportée du use-case).

## Arrondis, limites et cas particuliers
`bigint` partout, centimes entiers, aucun arrondi. `pending` n'est jamais dans `card` ; une CB non pointée n'est jamais dans `bills`. Transaction sans catégorie : dans `card`/`bills`/`bank` selon son état, et dans le prévu via `uncategorized` : aucune ligne propre. Budget stocké en négatif : valeur absolue (existant).

## Exploitation
Pas de log ajouté (calcul pur, mêmes entrées que `stats`). Retour arrière : `git revert` ; champs ajoutés seulement, aucun consommateur existant cassé.

## Alternative écartée
Déduire `budgetRemaining` en résidu (prévu − autres lignes) : somme toujours juste, donc test aveugle et un bug de classement passerait inaperçu. On calcule chaque ligne indépendamment et on teste l'égalité.

## Cas de test écrits avant le code
Base : départ 100000, catégorie dépense D budget 30000, revenu I budget 200000. Transactions : salaire +200000 (I, rapproché) ; courses −10000 (D, rapprochée) ; CB −5000 (D, non rapprochée) ; facture −8000 (D, `pending`, non rapprochée). Prévu = 270000.

| Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- |
| Base | bank 290000, card −5000, bills −8000, budgetRemaining −7000, expectedIncome 0 ; somme 270000 = prévu | Cas nominal |
| Base, revenu prévu 250000 | expectedIncome 50000 ; somme = prévu 320000 | max(réel, prévu) revenus |
| Base, budget D 20000 (réel 23000) | budgetRemaining 0 ; somme 277000 = prévu | max(réel, prévu) dépenses : le réel gagne |
| Base, revenu réel 300000 > prévu | expectedIncome 0 (jamais négatif) | Réel au-dessus du prévu |
| Base + import sans catégorie −3000 non rapproché | card −8000 ; somme 267000 = prévu 267000 | Sans catégorie : dans CB, pas de ligne propre |
| Base + sans catégorie −3000 `pending` non rapprochée | bills −11000 ; somme = prévu | Sans catégorie à venir |
| Base, la facture −8000 `pending` mais rapprochée | bank 282000, bills 0, card −5000 ; somme 270000 | `pending` rapprochée : déjà en banque, pas de double compte |
| Base + remboursement CB +4000 en D, non rapproché | card −1000, budgetRemaining −11000 ; somme 270000 | Remboursement en CB (ligne CB réduite, budget restant augmente) |
| Base + remboursement CB +9000 (card > 0) | card +4000 ; somme = prévu | CB positive : la barre devra basculer en lignes |
| Seul remboursement +5000 en D rapproché, budget D 3000, départ 0 | budgetRemaining −10000 ; bank 5000 ; somme −5000 = prévu −5000 | Dépenses nettes positives (doute 1) |
| Départ 0, budget D 50000, aucune transaction | prévu −50000 ; budgetRemaining −50000 ; autres 0 | Prévu négatif |
| Aucune CB ni `pending` | card 0, bills 0 ; somme = prévu | Segment à 0 |
| Période vide, aucun budget | toutes lignes 0 ; prévu = départ | Zéro partout |
| Virement catégorisé (type transfer) +10000 rapproché, budget 0 | compté en revenus : expectedIncome 0 ; somme = prévu | Virements = revenus (existant) |
| Revenu net négatif −2000 (I), budget I 0 | expectedIncome 2000 ; somme = prévu | Revenu négatif : max(réel, prévu) = 0 |
| Budget D stocké −30000 | identique à +30000 | Valeur absolue |
| Boucle sur tous les cas ci-dessus | `bank+card+bills+budgetRemaining+expectedIncome == forecastBalance` | Invariant unique de la règle critique |
| Période d'un autre compte | `NotFoundError` | Garde existante conservée |

---

# Partie 2 — Rythme de dépense

## Ce que ça calcule ou décide
Entrées : période choisie, ses transactions, la période précédente du compte et les siennes. Sortie : cumul quotidien des sorties d'argent de la période, cumul de la précédente au même jour, écart au dernier jour affiché.

## L'algorithme
1. Charger compte, période (404 identique à `stats` si inconnue ou d'un autre compte), catégories, toutes les périodes du compte (`findAllByAccount`).
2. `today` = `todayDateOnly()` (injecté en paramètre du use-case pour les tests). `last` = min(`endDate` ?? `today`, `today`) si la période est active ou sans fin ; `endDate` sinon (période fermée, passée). `N` = nombre de jours de `startDate` à `last` inclus (0 si `startDate` > `last` : courbe vide).
3. Précédente = période du compte au `startDate` strictement antérieur le plus récent. Sa fin = `endDate` ?? veille du début de la courante.
4. Fonction pure `dailyOutflows(transactions, categoriesById, start, last)` : jour d'une transaction = rang depuis `start` (1 = premier jour). Une transaction compte si `!pending` ET (catégorie de type expense/savings, montant net signé, remboursements inclus) OU (sans catégorie ET montant < 0). Revenu, virement et catégorie inconnue : exclus. Sortie positive = −montant.
5. Cumul `cum[n]` pour n = 1..N. Pour la précédente : `prev[n]` = cumul au jour n ; au-delà de sa longueur, son cumul final.
6. Réponse : `points: [{ day, date, cumulative, previousCumulative|null }]`, `previousPeriodId|null`, `gap` = `cum[N]` − `prev[N]` (null sans précédente). Phrase côté front : gap > 0 « de plus », < 0 « de moins ».
7. Log `spending_pace_built` : compte, période, nombre de jours, `hasPrevious`. Ni montant ni libellé.

## Données et structure
- Lieu : `get-spending-pace.use-case.ts` (+ spec) + fonction pure `domain/spending-pace.ts` (proposée). Lit : transactions de la période et de la précédente (`findAllByAccountUnpaginated`, bornes incluses, comme les dépassements), catégories, périodes. N'écrit rien.
- Route `GET /:accountId/periods/:periodId/reporting/spending-pace` (jeton exigé) dans `reporting.controller.ts`, `reporting.module.ts`.
- Fichiers occupés : `functions/src/reporting/application/get-spending-pace.use-case.ts`, `.spec.ts`, `functions/src/reporting/domain/spending-pace.ts`, `.spec.ts`.

## Arrondis, limites et cas particuliers
`bigint` en centimes, chaînes dans la réponse. Dates en `date-only` UTC (jamais l'heure locale). Transaction hors `[start, last]` ignorée (dont les dates futures de la période active). Période active, fin future : on s'arrête à aujourd'hui, la précédente est lue au même jour n.

## Exploitation
Journal ci-dessus. Retour arrière : `git revert` ; route nouvelle, rien d'existant à restaurer.

## Alternative écartée
Calculer le cumul dans le front à partir des transactions : il faudrait toutes les charger sur l'écran principal et dupliquer les règles de catégorie. Écarté (cf. hypothèses de la spec).

## Cas de test écrits avant le code
Période courante : 2026-11-01 → 2026-11-30, active, `today` = 2026-11-10, sauf indication.

| Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- |
| Dépenses −1000 le j1, −500 le j3 | cumul 1000, 1000, 1500… jusqu'au j10 (10 points) | Cumul par jour, plateaux inclus |
| Catégorie épargne −2000 le j2 | comptée | Épargne = sortie |
| Catégories revenu +5000 et virement −3000 | exclues | Revenus et virements catégorisés exclus |
| Revenu négatif −2000 (catégorie revenu) | exclu | Décision de Lucas |
| Sans catégorie −700 | compté | Sortie sans catégorie |
| Sans catégorie +900 (remboursement) | exclu | Décision de Lucas |
| Dépense −1000 puis remboursement +300 même catégorie | cumul 700 | Net de catégorie |
| Dépense `pending` −4000 | exclue | `pending` exclues |
| Transaction datée j15 (future) | ignorée, courbe s'arrête au j10 | Pas de futur |
| Précédente 2026-10-01 → 10-31, 800 au j5, 1500 au j20 | `previousCumulative` 0..800 au j5..j10 (pas 1500) ; gap = cum[10] − 800 | Même jour, pas le total |
| Courante fermée 01/11 → 30/11 (31 jours > précédente 28) | au-delà du jour 28, la précédente garde son cumul final | Précédente plus courte |
| Précédente plus longue que la courante fermée | lue seulement jusqu'au dernier jour de la courante | Précédente plus longue |
| Courante active sans fin | N = jusqu'à aujourd'hui | Période sans fin |
| Courante fermée | N = longueur complète, indépendante de `today` | Fermée |
| Aucune période antérieure | `previousCumulative` null partout, `gap` null | Sans précédente |
| Trois périodes (août, sept., oct.) + une postérieure | précédente = octobre ; la postérieure est ignorée | Choix par date de début |
| Précédente sans `endDate`, non active | bornée à la veille du début courant | Doute 5 |
| Période démarrant aujourd'hui | 1 point | Borne basse |
| Période démarrant demain | `points` vide, gap null | Période future |
| Période vide | cumul 0, gap 0 − 0 ou avec précédente : −prev | Zéros |
| Écart : cum 1500, prev 1000 → +500 ; cum 800, prev 1000 → −200 | gap en centimes signé | Phrase « de plus / de moins » |
| Période d'un autre compte / inconnue | `NotFoundError` | Même garde que `stats` |
| Logger | appelé avec compte, période, jours, `hasPrevious` sans champ montant | Exploitation |
| Fuseau serveur ≠ Paris (`test:tz`) | mêmes jours | Dates UTC |
