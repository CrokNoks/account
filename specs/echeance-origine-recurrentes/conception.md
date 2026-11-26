# Conception : échéance d'origine des récurrentes

Base : 40714d7. « Décision 1 » de `besoin.md` prime : option A (aucune reprise, aucune migration), H1 validée.
Aucun code écrit. Trois parties sensibles, dans l'ordre des commits.

## Partie 1 : échéance réglée (Échéances : trésorerie + calendrier)

### Ce que ça décide
Entrées : occurrences projetées (récurrente + jour) et transactions du compte. Sortie : pour chaque occurrence, la transaction qui la règle (ou rien). Une transaction ne règle qu'une occurrence.

### L'algorithme (fonction pure `settleOccurrences`, dans `reporting/domain/recurring-already-paid.ts`)
1. Occurrence = `{recurringId, categoryId, description, amount, date}`, clé `recurringId|YYYY-MM-DD`. Transaction lue avec `recurringId` et `dueDate` de `metadata` (helper `readDueDate`, format `YYYY-MM-DD` strict, sinon ignoré).
2. Étape lien : pour chaque transaction avec `recurringId`, échéance = `dueDate` sinon sa date ; si l'occurrence (même récurrente, même jour) existe et est libre, elle est réglée. Exact, sans concurrence.
3. Étape équivalence, sur les occurrences et transactions restantes. Paire candidate si : récurrente avec catégorie : même catégorie non nulle, même signe du montant, écart de date <= 7 jours (la règle de `period-switch.ts`, voir plus bas) ; récurrente sans catégorie (H2) : même jour, même montant, libellé contenu (ancienne règle, une seule paire par transaction maintenant). Éligibilité d'une transaction : sans `recurringId`, ou avec un `recurringId` qui n'existe plus, ou lié à **la même** récurrente que l'occurrence (échéance disparue ou non posée : cas des transactions d'avant le déploiement). Une transaction liée à une autre récurrente existante n'est jamais éligible.
4. Toutes les paires candidates sont triées par (écart absolu en jours, date de l'occurrence, `recurringId`, id de la transaction) et affectées gloutonnement tant que les deux côtés sont libres. Déterministe, et chaque transaction va à l'occurrence la plus proche.
5. Retour : `Map<clé, {txId, txDate}>`.

Le jeu d'occurrences passé à la fonction déborde de l'affichage de 7 jours de chaque côté (sinon une transaction règle à la fois l'échéance affichée et sa voisine hors vue).

### Application
- Trésorerie : occurrences de `aujourd'hui − 7` à `aujourd'hui + days + 7`, tous les jours d'une récurrente via `isRecurringDueOn` comme aujourd'hui. Un événement n'est retiré que si `txDate <= aujourd'hui` (déjà dans le solde, `pending` comprises : le solde du jour les compte). Réglée par une transaction future : elle reste projetée. `alreadyPaidCount` = événements retirés, sur tous les jours.
- Calendrier : même jeu, mois ± 7 jours ; événements affichés inchangés (transactions du mois + « Prévue » des jours >= aujourd'hui) sauf que toute occurrence réglée, quelle que soit la date de la transaction (mois voisin compris), n'est pas affichée en « Prévue ».
- Lecture des transactions : trésorerie `startDate = aujourd'hui − 31 j`, `endDate = aujourd'hui + days + 7` ; calendrier mois ± 31 j (voir point 1 à trancher). Les transactions lues en plus ne servent qu'à l'appariement, jamais affichées. Aucune méthode de dépôt nouvelle (`findAllByAccountUnpaginated` avec `startDate`/`endDate`).

### Réutilisation de l'équivalence
Extraction pure, sans changement de comportement, de `isEquivalent`, `EQUIVALENT_DAYS`, `sign`, `daysBetween` vers `shared/domain/recurring-equivalence.ts`. `period-switch.ts` l'importe (ses tests actuels doivent rester verts sans modification), le reporting aussi. `pickBest` (montant le plus proche d'abord) reste dans `period-switch.ts` : le reporting n'a pas à départager par montant.

### Alternative écartée
Réutiliser `pickBest` (montant d'abord) : faux ici, le montant n'est pas une condition de l'équivalence et on veut le jour le plus proche. Parcours « occurrence par occurrence » (chaque occurrence prend sa meilleure transaction) : dépend de l'ordre de parcours, la paire globale triée est aussi courte et ne l'est pas. Ne rien apparier hors lien : rejeté par Lucas (réponse 1).

### Cas de test (écrits avant le code, `recurring-already-paid.spec.ts` + spec des deux cas d'usage)
| Entrées | Attendu | Pourquoi |
| --- | --- | --- |
| Paie 28 (2 000,00 €, cat. Salaire), transaction liée `dueDate` 28 datée 26, aujourd'hui 26 | trésorerie : aucun événement le 28 ; `alreadyPaidCount` 1 ; calendrier : pas de « Prévue » le 28 | CA1, règle critique |
| Même cas + seconde paie identique le 28 suivant | événement conservé pour le 28 suivant | une transaction = une occurrence |
| Transaction sans lien, même catégorie, même signe, à 7 jours | occurrence réglée | CA2 |
| Idem à 8 jours | non réglée | borne CA2 |
| Même écart mais signe opposé, ou catégorie différente, ou récurrente sans catégorie sans même libellé | non réglée | conditions de l'équivalence |
| Deux loyers (même catégorie) à 27 et 30, une seule transaction sans lien le 28 | seul le 27 est réglé, le 30 reste projeté | CA2, canard : deux récurrentes même catégorie, une transaction |
| Deux transactions sans lien, deux loyers 27 et 30 | les deux réglés, sans croisement | appariement un pour un |
| Transaction liée à la récurrente R2 de même catégorie qu'une occurrence de R1 à 3 jours | R1 non réglée | une transaction liée n'est éligible qu'à sa récurrente |
| Transaction liée R, `dueDate` 30/11, datée 01/12 ; calendrier de novembre | pas de « Prévue » le 30/11 | CA3, mois voisin |
| Transaction `pending` datée du 30, aujourd'hui 26 | trésorerie : événement du 30 conservé ; calendrier : « Prévue » absente | CA3 |
| Transaction du jour, occurrence du jour | écartée (comportement d'avant conservé) | non-régression |
| Transaction liée sans `dueDate` (ancienne), même date que l'occurrence | réglée (repli sur la date) | option A |
| Transaction liée sans `dueDate` redatée à 3 jours, même catégorie | réglée par équivalence | repli, option A |
| `metadata.dueDate` invalide (`"abc"`) | traité comme absent, aucune erreur | robustesse |
| Égalité d'écart entre deux occurrences | l'occurrence la plus tôt, puis `recurringId` | déterminisme (rejouer 2 fois = même résultat) |
| Récurrente à 0 transaction | rien, pas d'erreur | borne |

### Exploitation et retour arrière
Journal `cashflow_forecast_built` inchangé dans sa forme (`alreadyPaidCount`). Revert du commit suffit, aucune donnée écrite.

## Partie 2 : bascule (`period-switch.ts`, `apply-period-switch.service.ts`)

### Ce que ça décide
Même fonction pure `planPeriodSwitches`, avec quatre règles modifiées. Entrées ajoutées : montant et `recurringId` de chaque déclencheuse, `dueDate` des transactions existantes.

### Changements (dans l'ordre d'exécution de `simulate`)
1. **Garde montant** : nouvelle raison `non_positive` (`amount <= 0`), placée **après** `threshold` (H3) ; ni période, ni injection. `gapDays` journalisé comme les autres.
2. **Paie déclenchante** (H1 validée), fonction pure `findTriggerSalary(trigger, salaries)` : (i) `trigger.recurringId` parmi les paies (catégorie déclencheuse, montant > 0) ; sinon (ii) la paie dont l'occurrence la plus proche de la date de la déclencheuse est à <= 7 jours (même catégorie ; le signe est positif des deux côtés puisque la garde 1 est passée), la plus proche, puis id ; sinon (iii) aucune : comportement actuel (la plus proche de toutes pour la règle A, toutes écartées pour la règle d).
3. **Règle A** : la prochaine occurrence à >= 15 jours se cherche sur la seule paie déclenchante (cas iii : sur toutes). Seuil 15 inchangé.
4. **Règle (d)** : « pas d'injection à moins de 15 jours » ne vise que la paie déclenchante (`rec.id === triggerSalary.id`) ; cas iii : toutes les paies, comme avant. La paie du 2 est alors injectée normalement (CA5).
5. **Règle (c)** : « déjà présente » compare `monthKey(e.dueDate ?? e.date)` au mois de l'occurrence. Les occurrences planifiées dans la même passe portent `dueDate = date`. `ExistingRecurringTx.dueDate?: Date`.
6. **Règle (b)** (prochaine paie unique en `pending`) : inchangée (elle lit la date d'une `pending`, qui n'a pas été redatée).
7. `PlannedOccurrence.dueDate: Date` (= `date` pour une injection ou la prochaine paie).

Le service lit `metadata.dueDate` via `readDueDate`, passe `amount` et `recurringId` aux déclencheuses, écrit `dueDate: toDateOnly(o.dueDate)` dans `asRecurring`. Le nettoyage de l'import (équivalence 7 jours des `pending`) n'est pas touché.

Limite connue : le dépôt est lu à partir du mois de la plus ancienne déclencheuse ; une transaction payée plus d'un mois avant son échéance n'est pas vue par (c). Hors périmètre.

### Alternative écartée
Étendre (c) à « mois de la date OU mois de l'échéance » : garde l'ambiguïté à l'origine du trou (loyer 01/12 bloquerait toujours décembre). Identifier la paie par le plus petit écart de montant : le montant n'est pas une condition d'équivalence dans le projet.

### Cas de test (`period-switch.spec.ts`, avant le code)
| Entrées | Attendu | Pourquoi |
| --- | --- | --- |
| Loyer 30/11, transaction liée `dueDate` 30/11 datée 01/12 ; bascule 15/12 | 30/12 injectée en `pending`, `dueDate` 30/12 | CA4, règle critique n°2 |
| Même loyer sans `dueDate`, daté 01/12 | 30/12 non injectée (repli sur la date) | option A |
| Transaction liée `dueDate` 30/12 datée 28/12 | 30/12 non injectée | (c) sur échéance |
| Paies 28 et 2, déclencheuse liée à la paie 28, bascule le 28/11 | fin 27/12 ; 02/12 injectée `pending` ; 28/11 non injectée ; `nextPaie` 28/12 | CA5 |
| Même cas, déclencheuse sans lien, saisie le 26/11 | paie 28 identifiée (<= 7 jours) ; même résultat | H1 (ii) |
| Déclencheuse sans lien, aucune paie à <= 7 jours | comportement d'avant : la plus proche, toutes écartées en (d) | H1 (iii) |
| Déclencheuse liée, `recurringId` d'une récurrente supprimée | passe à (ii) puis (iii) | robustesse |
| Déclencheuse -50,00 € ou 0, écart 20 jours | pas de bascule, `skipped` = `non_positive` | CA6 |
| Déclencheuse -50,00 € à 10 jours | `threshold` (prime) | ordre H3 |
| Récurrente -50,00 € de la catégorie déclencheuse, déclencheuse +2 000 € | traitée comme les autres récurrentes | CA6 fin |
| Pointage d'une paie à 0 (service) | date du jour posée, `dateChanged` vrai, pas de bascule | `periods.md:132` |
| Lot de deux déclencheuses (import) | une identification par déclencheuse, `nextPaie` seulement à la dernière | non-régression lots |
| Deux passes identiques | même plan (déterminisme) | `idGenerator` stable |
| Tous les tests actuels du fichier | verts sans modification, sauf ceux qui encodaient `salaries.includes` (à réécrire) | non-régression |

Service (`apply-period-switch.service.spec.ts`) : montant et `recurringId` transmis ; log `period_trigger_skipped` avec `reason: non_positive` ; `metadata.dueDate` sur injectées et prochaine paie ; entités construites comme l'ORM les renvoie (`metadata` lu depuis une ligne), pas posées à la main.

### Exploitation et retour arrière
`period_trigger_skipped` (nouvelle valeur `non_positive`), `period_opened` (`injected`, `nextPaie`) inchangés. Retour arrière : revert, rien en base à corriger (une période déjà ouverte reste valable).

## Partie 3 : pose et conservation de `metadata.dueDate`

### Où
Un helper partagé `shared/domain/recurring-due-date.ts` : `readDueDate(metadata)` et `dueDateMetadata(date)` (`toDateOnly`). Posé : création manuelle de période (`create-period-with-budgets.use-case.ts:87`), injection de bascule et prochaine paie (service, partie 2). Jamais sur saisie ni import.

### Chemins qui réécrivent `metadata` (vérifiés dans le code)
| Chemin | Effet sur `dueDate` |
| --- | --- |
| Pointage / sortie du pending (service : `tx.update({date})`, entité spread) | conservé |
| PATCH `transactions.controller.ts:~610` | `...provided` : `metadata` remplacé seulement si le corps en contient (le front n'en envoie pas, H4) ; changement de date seul : conservé |
| Modification en lot (`bulk-update-transactions.use-case.ts:52`) | n'y touche pas : conservé |
| `ignore-anomaly.use-case.ts:37` | `{...metadata, ignoredAnomalies}` : conservé |
| Upsert SQL (`metadata = EXCLUDED.metadata`) et `apply_period_switches` (JSON passé tel quel) | écrit ce que l'entité porte : conservé |

Tests de non-régression ajoutés (un par chemin ci-dessus : PATCH sans `metadata`, en lot, ignore-anomaly, pointage d'une paie via le service) sur une entité reconstruite depuis une ligne de base. Aucune garde supplémentaire n'est ajoutée contre un `metadata` remplacé par l'API (hors périmètre, H4).

## Ordre des commits de code (3)
1. **Standard** (non sensible, déjà possible) : helper `recurring-due-date.ts` + `dueDate` à la création manuelle de période + tests de conservation (PATCH, lot, ignore-anomaly) + requête de mesure `supabase/queries/echeances-comptees-deux-fois.sql`. Aucun effet visible tout seul.
2. **Sensible** : partie 1 (extraction de l'équivalence, `settleOccurrences`, trésorerie, calendrier) avec leurs tests. Marche seule : lien + équivalence + repli sur la date.
3. **Sensible** : partie 2 (planificateur + service + `dueDate` des injections) avec ses tests.
Le fichier `functions/http/echeance-origine-recurrentes.http` se committe en `--fixup` du commit 3 (ou 2 pour les scénarios Échéances).

## Compatibilité, déploiement
Aucune migration, aucune colonne, aucun feature flag (spec). Les fonctions se déploient seules, dans n'importe quel ordre des trois commits : le code lit `dueDate` s'il existe, sinon la date. L'ancien code ignore `dueDate`. Les transactions existantes (prod : 0 `pending` liée, 1 réglée liée) n'ont pas d'échéance : CA1 et CA4 valent pour les occurrences créées après le déploiement, plus l'équivalence 7 jours pour les anciennes. Retour arrière : revert, `dueDate` reste dans les `metadata` sans effet.

## Fichiers sensibles (relus au contrôle 2)
`functions/src/reporting/domain/recurring-already-paid.ts`, `functions/src/shared/domain/recurring-equivalence.ts` (extraction), `functions/src/reporting/application/get-cashflow-forecast.use-case.ts`, `functions/src/reporting/application/get-calendar-data.use-case.ts`, `functions/src/periods/domain/period-switch.ts`, `functions/src/periods/application/apply-period-switch.service.ts`, avec leurs specs.

## Incréments non sensibles (mode standard)
`functions/src/shared/domain/recurring-due-date.ts` (+ spec), `create-period-with-budgets.use-case.ts` (+ spec), tests de conservation (`transactions.controller` / `bulk-update` / `ignore-anomaly`), `supabase/queries/echeances-comptees-deux-fois.sql` (lecture seule, exécutée en local avant d'être donnée ; en prod l'indicateur est quasi nul faute de données liées : 1 transaction, la vraie mesure est `alreadyPaidCount` et le contrôle visuel de Lucas), `functions/http/echeance-origine-recurrentes.http`. Les docs restent au documentaliste.

## Points que Lucas doit trancher
1. **Marge de lecture : 31 jours au lieu de 7.** La spec dit « 7 jours » ; une facture redatée plus de 7 jours avant son échéance (due 30/11, payée le 15/11) sortirait de la fenêtre et serait recomptée. Je propose de lire 31 jours de transactions (l'équivalence reste à 7 dans la fonction, le lien est exact). Coût : quelques dizaines de lignes de plus. Défaut si pas de réponse : 31.
2. **Une transaction liée à une autre récurrente n'est jamais appariée par équivalence** (une paie liée à R2 ne règle pas R1 de même catégorie). Défaut : oui. Contraire : une transaction liée devient éligible partout, plus de faux positifs mais moins de rigueur.
3. **Appariement global « plus proche d'abord »** (étape 4) au lieu d'un parcours par occurrence : même résultat dans les cas simples, indépendant de l'ordre. Écart de lecture avec « la plus proche en date, puis id » de la spec : validé si tu es d'accord (défaut : oui).
Note : une occurrence passée non payée (hors affichage) peut consommer une transaction proche ; sans impact sur les récurrentes mensuelles (28 jours minimum entre deux occurrences, plus de 7 jours d'écart).

## Validé par Lucas (contrôle 1, 2026-11-26 : « Go recos ») ; prime sur ce qui précède
1. Lecture de 31 jours de transactions autour des échéances (le lien exact retrouve une facture payée plus de 7 jours en avance) ; l'équivalence sans lien reste à 7 jours.
2. Une transaction liée à une autre récurrente existante n'est jamais appariée par équivalence.
3. Appariement global « la plus proche d'abord », indépendant de l'ordre de lecture.
