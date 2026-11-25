# Conception — Soldes et prévu justes (lot 2)

Base du cycle : 1c540a2. Aucune ligne de code écrite. Montants en centimes (bigint), exemples en euros.
Constat du code lu : les stats et la simulation partagent déjà `loadPeriodForecastInput` + `computePeriodForecast` ; la composition recalcule `expenseRule` à côté ; l'évolution calcule tout en mémoire (toutes les transactions sont déjà chargées, pas de RPC).

## 1. Prévu par catégorie (CA5, CA6, CA8) — `period-forecast.ts`

**Ce que ça calcule.** Pour chaque catégorie, la part « retenue » du prévu, puis la somme. Le prévu = départ complet + revenus retenus - dépenses retenues + remboursements + sans catégorie.

**Règles (une fonction par côté, écrites une seule fois, exportées) :**
1. Dépenses et épargne (`expenseRule` gardée, appelée par catégorie) : dépensé = max(0, -réel) ; retenu = max(dépensé, |budget|) ; remboursement = max(0, réel) (option B : le budget reste entier).
2. Revenus et virements (nouvelle `incomeRule(réel, budget)`) : si réel >= 0, retenu = max(réel, |budget|) ; si réel < 0, retenu = |budget| + réel (miroir option B). « Attendu » de la catégorie = retenu - réel (réel >= 0 : >= 0 ; réel < 0 : |budget|).
3. `computePeriodForecast` boucle sur les catégories, applique la règle de son côté, additionne. Sorties gardées (mêmes noms) : `realIncome`, `plannedIncome`, `realExpenses`, `plannedExpenses` (sommes brutes, inchangées pour l'affichage), `maxIncome` (= somme des revenus retenus), `maxAbsExpenses` (= somme des dépenses retenues), `forecastBalance`. Ajoutées : `refundSurplus` (somme des remboursements par catégorie), `budgetRemaining` (= somme de -(retenu - dépensé), <= 0), `expectedIncome` (= somme des « attendus »). La composition lit ces deux dernières : la règle n'existe qu'à un endroit.
4. Budget : toujours |budget| ; 0 ou absent = 0. Une catégorie absente de `categories` n'est pas comptée (comportement actuel, non modifié).

**Simulation.** `incomeEffect = maxIncome(simulé) - maxIncome(enregistré)` ; `expensesEffect = -(maxAbsExpenses(simulé) - maxAbsExpenses(enregistré))`. Ce sont maintenant des écarts de sommes par catégorie. Le remboursement et le sans-catégorie ne dépendent pas du budget, donc `delta = incomeEffect + expensesEffect` reste exact (test d'invariant). « Sans effet » reste décidé par côté (effet == 0) ; il apparaît plus souvent (budget changé sur une catégorie déjà dépassée). `simulate-period-forecast.use-case.ts` : aucun changement attendu hors le calcul des deux écarts (déjà basé sur `maxIncome`/`maxAbsExpenses`).

**Alternative écartée.** Garder le max sur les totaux et corriger à part : ne résout pas le masquage (exemple B), c'est le besoin. Autre écartée : appliquer le miroir seulement pour réel < 0 sans remettre le budget entier : incohérent avec l'option B choisie pour les dépenses.

**Conséquences à connaître (déjà dans la spec).** Exemple C : le prévu monte quand un revenu attendu n'est pas arrivé (plus optimiste). Exemple E : un remboursement ne compense plus le dépassement d'une autre catégorie.

| # | Entrées (réel / budget par catégorie) | Résultat attendu | Pourquoi |
| --- | --- | --- | --- |
| B | courses -500/300, loyer 0/800 | dépenses retenues 1 300, prévu = départ - 1 300 (écart -200 vs avant) | masquage supprimé |
| C | salaire 2 000/2 000, prime 0/300, freelance 400/0 | revenus retenus 2 700, attendus 300 | max par catégorie |
| D | abonnements -250/-200 ; -150/-200 | retenus 250 ; 200 | budget négatif = |budget| |
| E | B + loisirs +50/200 | dépenses 1 500, remboursement 50, net -1 450 | option B par catégorie |
| E2 | remboursement +50 sans budget (budget 0) | retenu 0, remboursement 50 | le remboursement s'ajoute même sans budget |
| G | salaire -50/2 000 (petit cas du canard) | retenu 1 950, attendu 2 000 | miroir option B |
| G2 | G + prime 0/300 | retenus 2 250 | somme par catégorie |
| H1 | revenu réel 0 / budget 0 ; catégorie sans transaction ni budget | 0, aucun effet | bornes |
| H2 | type TRANSFER réel 100/0 ; épargne -80/50 | transfert côté revenus (100), épargne côté dépenses (80) | classement des types |
| H3 | budget sur catégorie absente de la liste | ignoré | comportement actuel |
| S1 | simulation : budget courses 300 -> 200 alors que réel -500 | expensesEffect 0 (Sans effet côté dépenses) | dépassement déjà retenu |
| S2 | simulation : budgets identiques aux enregistrés | delta 0, effets 0 | neutralité |
| S3 | invariant : delta = incomeEffect + expensesEffect | vrai sur les exemples B, C, E, G et une grille de cas déterministe | cohérence stats/simulation |
| S4 | stats et simulation avec les mêmes budgets | même `forecastBalance` | CA8 |

## 2. Départs séparés et fenêtre bancaire (CA1-CA4) — SQL + chargement + stats + évolution

**Ce que ça calcule.** Trois départs avant le début de période, et « En banque » / « À venir » qui ne dépendent plus du départ du prévu.

**Obtenir les sommes (choix : une nouvelle fonction SQL à une ligne, trois sommes).** `sum_transactions_before_date_by_balance(p_account_id, p_date)` renvoie : `all_total` (tout, comme aujourd'hui), `reconciled_total` (pointées), `non_pending_total` (non `pending`), toutes pour `date < p_date`, `COALESCE(...,0)`. Un seul balayage de la table, un seul appel. Mêmes garde-fous que `20261125100100` : `SECURITY INVOKER`, `SET search_path = public, pg_temp`, `REVOKE ALL ... FROM PUBLIC, anon`, `GRANT EXECUTE ... TO authenticated`. Aucun accès à un compte non lisible : la RLS donne 0 (test SQL dans `supabase/tests`, comme `sum_transactions_before_date_test.sql`, avec une ligne par état). `sum_transactions_before_date` reste telle quelle (trésorerie).
Dépôt : nouvelle méthode `sumAmountsBeforeDateByBalance(accountId, date)` -> `{ all, reconciled, nonPending }`. Une erreur RPC ou une réponse vide **lève** (jamais un départ à 0). `sumAmountByAccountBeforeDate` gardée.

**Chargement (`load-period-forecast-input.ts`).** Renvoie `startBalance` (= solde initial + all, utilisé par le prévu : CA3), `startReconciled`, `startNonPending` (solde initial + la somme correspondante), `reportsTotal = all - reconciled` (signé, CB + factures `pending` non pointées avant le début), et `lateReconciledIncome`.
**Fenêtre bancaire (`period-window.ts`, une seule fonction).** `isLateReconciledIncome(t, period)` : période active, `date > endDate`, `reconciled`, `amount > 0`. Les dépenses tardives sont déjà dans la fenêtre (règle actuelle) ; un revenu tardif non pointé reste ignoré partout ; une période fermée n'a pas de tardif. Le chargement actuel d'une période active n'a déjà pas de borne haute, donc aucune requête de plus.

**Stats.**
- En banque = `startReconciled` + pointées de la fenêtre + `lateReconciledIncome`.
- À venir = `startNonPending` + non `pending` de la fenêtre + `lateReconciledIncome` (un pointé n'est jamais `pending`, CA9).
- Prévu = inchangé hors §1 : `startBalance` complet, fenêtre inchangée (le tardif n'y entre pas).
Champs de réponse ajoutés (additifs) : `reportsTotal`, `arrivedAfterEnd` (= -`lateReconciledIncome`, négatif ou nul), voir §3.

**Évolution.** Pas de RPC : le tableau complet est déjà en mémoire. `realBankBalance` = solde initial + pointées datées avant le début + pointées de la fenêtre + tardif (même prédicat `isLateReconciledIncome`). `forecastBalance` : inchangé (départ complet + toute la fenêtre).

**Alternative écartée.** (a) Ajouter des paramètres à la fonction existante : change la signature pendant que l'ancien back tourne (erreur 5xx entre deux déploiements) et élargit une fonction que la trésorerie utilise. (b) Trois appels à la fonction actuelle avec un filtre : trois balayages, trois chemins d'erreur. (c) Calculer les départs côté Node : charger toutes les transactions à chaque stats, contraire au choix du lot 1. 

| # | Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- | --- |
| A | exemple A | départs 1 200 / 1 140 / 1 050 ; En banque 2 900 ; À venir 2 800 ; prévu 1 750 ; reports -150 | CA1-CA3 |
| A2 | CB -60 non pointée seule avant le début | hors banque, dans À venir (non pending), dans prévu | CA2 |
| A3 | facture `pending` avant le début | hors banque, hors À venir, dans prévu | CA2, CA3 |
| F | A + prime +300 pointée le 2/12, P2 active finie le 30/11 | banque 3 200 ; À venir 3 100 ; prévu 1 750 ; arrivé après la fin -300 | CA4 |
| F2 | même prime, période fermée | pas dans cette période (départ de la suivante) | hypothèse « fermée » |
| F3 | revenu tardif non pointé (paie `pending` ou CB) | ignoré : banque, À venir, prévu | CA4 |
| F4 | dépense tardive pointée -50 (période active) | déjà dans la fenêtre : banque et prévu la comptent, pas de « tardif » | pas de double compte |
| F5 | période active sans date de fin | `late` = 0 | borne |
| R1 | RPC en erreur / réponse vide | stats en erreur, pas de départ à 0 | exploitation |
| R2 | compte non lisible par l'appelant | 0 en SQL (test SQL), 404 côté API (compte introuvable) | RLS |
| E1 | évolution, exemple A | `realBankBalance` P2 = 2 900, `forecastBalance` inchangé | CA8 |
| E2 | évolution, exemple F | `realBankBalance` 3 200 | CA4 dans l'évolution |
| E3 | évolution, période fermée avec CB non pointée avant le début | départ pointé seulement | CA1 |

## 3. Composition à 7 termes (CA7) — `forecast-composition.ts`

**Ce que ça calcule.** banque + CB + factures + reports + arrivé après la fin + budget restant + revenus attendus = prévu, au centime.
- CB, factures, « À pointer · N » : inchangés, transactions de la fenêtre de la période, non pointées (`pending` -> factures, sinon CB).
- Reports = `all - reconciled` du départ (signé). Arrivé après la fin = -`lateReconciledIncome`.
- Budget restant et revenus attendus : repris de `computePeriodForecast` (sommes par catégorie), plus de recalcul dans la composition.

**Pourquoi l'égalité tient (démonstration à reproduire en test).** banque = startRec + recFenêtre + late ; CB + factures = nonRecFenêtre ; reports = startAll - startRec ; arrivé = -late. Donc banque + CB + factures + reports + arrivé = startAll + totalFenêtre. Par catégorie, retenu - réel = attendu (revenus) ou -(retenu - dépensé) (dépenses), remboursement compris ; les sans-catégorie sont dans le total fenêtre et dans le prévu. Donc la somme des 7 = prévu.
Test de garde : un test d'invariant sur une grille de cas déterministes (sans nouvelle dépendance) qui compare la somme des 7 lignes à `forecastBalance`, en plus des exemples A à G. Si l'égalité casse sur un cas, c'est un bug de règle, pas d'arrondi (entiers).

**Front (non sensible, après le commit 2).** `types.ts` : `reportsTotal`, `arrivedAfterEnd`. `forecast-composition.ts` : la barre reste une répartition du solde en banque ; elle exige en plus reports <= 0 et arrivé <= 0 (deux segments ajoutés, un à 0 garde la barre). Sinon lignes signées, avec les deux lignes masquées quand elles valent 0. À fixer par test.

| # | Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- | --- |
| A | exemple A | 2 900 - 40 - 800 - 150 + 0 - 160 + 0 = 1 750 | égalité |
| F | exemple F | 3 200 - 40 - 800 - 150 - 300 - 160 + 0 = 1 750 | tardif |
| G | salaire -50/2 000 | revenus attendus 2 000 ; égalité tenue | miroir |
| B-E | exemples B à E | égalité tenue | par catégorie |
| C1 | catégorie à budget non consommé + autre dépassée | budget restant = somme des restes par catégorie, pas du total | CA5 |
| C2 | pending salariale (+) avant le début | reports positif, égalité tenue | reports signé |
| C3 | aucune transaction, aucun budget | 7 lignes à 0 sauf banque = prévu = départ | borne |
| C4 | grille déterministe (états x signes x catégories) | somme des 7 = prévu | invariant |
| UI1 | reports = 0, arrivé = 0, tout <= 0 | barre | cas courant |
| UI2 | reports < 0 et arrivé < 0, autres conditions vraies | barre avec 2 segments en plus, total = banque | barre étendue |
| UI3 | reports > 0 (facture de revenu avant le début) | passe en lignes | petit cas du canard |
| UI4 | arrivé < 0 et revenus attendus > 0 | lignes | revenu attendu |
| UI5 | banque < 0 ou prévu < 0 | lignes | existant |

## 4. CA9 — pointé et `pending` jamais ensemble

**Règle unique** dans `pending-rule.ts` (une fonction partagée par tous les chemins) : l'état résultant (`reconciled`, `pending`) n'est jamais (vrai, vrai).
- Création, import (lot), modification simple et en lot : si le corps contient `reconciled: true` et `pending: true`, ou si `pending: true` est envoyé sur une transaction déjà pointée sans la dépointer dans le même corps, `DomainValidationError` (400, filtre existant). `pending: true` à la création avec `reconciled: true` : idem.
- Pointer (`reconciled: true` sans `pending`) retire `pending` (comportement actuel). `reconciled: false` + `pending: true` sur une pointée : autorisé (dépointer puis remettre en facture).
- Changement de comportement : le corps `reconciled: true, pending: true` était accepté et `pending` ignoré ; il devient un 400. Le front (`transaction-form`) peut envoyer `pending: true` en modifiant une transaction pointée si la case est cochée : il aura un 400 (message d'erreur existant). À trancher : masquer la case pour une transaction pointée (hors périmètre sinon).
- Lot : on valide toutes les lignes avant d'écrire, puis une seule écriture atomique (`updateMany`, `saveMany` déjà atomiques). Création de transaction : la garde est dans `Transaction.create` (pas dans le constructeur de réhydratation, pour ne pas casser la lecture d'une ligne ancienne).
- Base : migration `CHECK (NOT (COALESCE(reconciled,false) AND COALESCE(pending,false)))`. `ADD CONSTRAINT` échoue sans rien changer si une ligne viole (attendu 0 sur 2 735) ; table petite, verrou bref. Lecture vérifiée du code : `apply_period_switches` n'écrit pas ces colonnes (il supprime seulement des `pending`), `upsert_transactions` / `insert_transactions` écrivent ce que le back envoie (donc déjà gardés), les récurrentes générées sont `pending: true` + non pointées.
- Alternative écartée : ne rien refuser côté API et laisser la base rejeter : erreur 500 au lieu de 400, aucun message. Autre écartée : tolérer l'état et le gérer dans les calculs (3 cas de plus dans la composition).

| # | Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- | --- |
| P1 | créer `reconciled:true, pending:true` | 400, aucune écriture | CA9 |
| P2 | créer `pending:true`, non pointée | OK | récurrente / facture |
| P3 | modifier une pointée avec `pending:true` | 400 | CA9 |
| P4 | modifier `reconciled:true` sur une `pending` | OK, `pending` devient faux | pointer |
| P5 | modifier `reconciled:true, pending:true` | 400 | deux à vrai dans le corps |
| P6 | modifier `reconciled:false, pending:true` sur une pointée | OK | dépointer + facture |
| P7 | lot de 3 dont 1 invalide (modif ou import) | 400, 0 écriture | tout ou rien |
| P8 | SQL : insérer/mettre à jour (vrai, vrai) | refusé par la contrainte | filet base |
| P9 | bascule de période et récurrentes générées | inchangées | conformité |

## 5. Ordre des commits de code (2 à 3)

1. `feat(reporting)` : prévu par catégorie : `period-forecast.ts` (+ `incomeRule`, sommes, `budgetRemaining`, `expectedIncome`), `forecast-composition.ts` (lit les sommes, toujours 5 termes), simulation. Tests §1 + exemples B-E, G, invariant 5 termes. Partie sensible, présentée au contrôle 2 avant commit.
2. `feat(reporting)` : départs séparés + tardif + composition 7 termes + évolution + migration SQL + méthode du dépôt + champs de réponse + test SQL. Tests §2, §3 (exemples A, F), mock front-contract. Partie sensible, contrôle 2 avant commit.
3. `feat(transactions)` : CA9 (garde, controller, use cases, e2e, migration CHECK + test SQL). Non sensible, peut passer en mode standard.
Hors décompte de code : front (types, composition, tests) après le commit 2 ; `supabase/queries/prevu-par-categorie.sql` (exécutée en lecture seule avant de la donner) ; `functions/http/soldes-et-prevu-justes.http` (exemple A rejoué, F, scénarios CA9) ; doc par le documentaliste.

## 6. Déploiement et retour arrière

Ordre : (1) migration de la fonction SQL (additive, l'ancien back l'ignore) ; (2) back des commits 1-2 (champs de réponse additifs : l'ancien front les ignore, sa barre ne somme alors plus à la banque tant que le front n'est pas déployé : à enchaîner) ; (3) front ; (4) back CA9 puis migration CHECK (la contrainte après la garde API, sinon un ancien client reçoit un 500 base au lieu d'un 400). Le CHECK peut être appliqué après vérification de `select count(*) from transactions where reconciled and pending` = 0 (lecture seule).
Retour arrière : revert des commits ; `DROP FUNCTION sum_transactions_before_date_by_balance` ; `ALTER TABLE transactions DROP CONSTRAINT ...`. Aucune donnée écrite ni corrigée. Pas de feature flag (calcul pur, spec).
Exploitation : pas de log nouveau dans la fonction pure (pas de donnée personnelle utile) ; un log `warn` structuré dans les stats si l'égalité des 7 lignes diverge du prévu (somme des lignes != `forecastBalance`, ids de compte et période, écart en centimes) : filet de détection en prod, à confirmer. Les erreurs RPC remontent en 5xx.

## 7. Fichiers

**Sensibles (mode standard : ne pas toucher)** : `functions/src/reporting/domain/period-forecast.ts` (+ spec), `domain/forecast-composition.ts` (+ spec), `domain/period-window.ts` (+ spec), `application/load-period-forecast-input.ts`, `application/get-period-stats.use-case.ts` (+ spec), `application/get-evolution.use-case.ts` (+ spec), `application/simulate-period-forecast.use-case.ts` (+ spec), `transactions/domain/transaction.repository.interface.ts`, `transactions/infrastructure/supabase-transaction.repository.ts` (+ spec), migration `*_sum_transactions_before_date_by_balance.sql`, `supabase/tests/` du test de cette fonction, `functions/test/front-contract.e2e-spec.ts` (mock du départ).
**Non sensibles (mode standard)** : CA9 complet (`pending-rule.ts` + spec, controller, `create-transaction`, `bulk-create`, `bulk-update`, `transaction.entity.ts`, `transactions.e2e-spec.ts`, migration CHECK + test SQL), `supabase/queries/prevu-par-categorie.sql`. Front (types, composition, UI, tests) : non sensible mais dépend des noms de champs du commit 2 : à faire en `implementation` après lui. Fichier `.http` : en fin de `implementation`.

## 8. Points à trancher par Lucas

1. Une fonction SQL à trois sommes (proposé) plutôt que des paramètres ou trois appels : OK ?
2. « Tardif » = revenu pointé (montant > 0) daté après la fin d'une période **active** seulement ; un montant à 0 ou une dépense (déjà dans la fenêtre) n'en fait pas partie. OK ?
3. Noms de champs de réponse `reportsTotal` et `arrivedAfterEnd` ; lignes masquées à l'écran quand elles valent 0 ; barre étendue de deux segments, passage en lignes si reports > 0 : OK ?
4. CA9 : le corps `reconciled: true` + `pending: true` passe de « accepté, pending ignoré » à 400 ; le formulaire front peut alors renvoyer 400 sur une pointée avec la case cochée. Masquer la case est hors périmètre : on laisse ?
5. CHECK en base : dans ce cycle (proposé, après la garde API) ou plus tard ? Je le classe non sensible (code simple, mais je te demande puisqu'il touche le schéma).
6. Log `warn` si la somme des 7 lignes diffère du prévu : on l'ajoute (proposé) ou on se fie aux tests ?
7. Rappel des effets visibles : exemple C (prévu plus optimiste quand un revenu attendu manque) et exemple E (un remboursement ne compense plus un dépassement ailleurs) sont des conséquences assumées de la règle par catégorie.

## Validé par Lucas (contrôle 1, 2026-11-26 : « Go avec tes recos ») ; prime sur ce qui précède
1. Une fonction SQL à trois sommes (tout, pointées, non `pending`).
2. « Arrivé après la fin » = revenu pointé (montant > 0), période active seulement.
3. Lignes « Reports » et « Arrivé après la fin » masquées à 0 ; la barre passe en lignes signées si les reports sont positifs.
4. CA9 : sur une transaction pointée, la case « facture à venir » du formulaire est grisée (petit changement front, dans CA9) ; l'API refuse en 400.
5. Contrainte `CHECK` en base dans ce cycle, après la garde API (0 ligne en défaut en prod le 2026-11-25).
6. Pas de log d'écart de la composition : les tests suffisent.
7. Avant le code : contrôler la requête de mesure contre les stats d'une vraie période. En prod (lecture seule, 2026-11-26), la période active 2026-03-16 → 2026-04-15 du compte 2ae0986e monte de +2 010,49 € (prévu hors départ −6,57 € → +2 003,92 €) ; 29 périodes sur 41 changent. Expliquer cet écart (catégorie qui le porte) et le soumettre à Lucas au contrôle 2.

## Validé par Lucas (contrôle 2, 2026-11-26 : « Virement sortant et commit »)
Catégorie de type virement (`transfer`) à réel négatif (virement sortant déjà passé) : retenu = réel, budget ignoré ; le miroir de l'option B ne reste que pour les catégories de revenu (`income`). Motif : en prod, la période active 2026-03-16 → 2026-04-15 (catégorie « Virement CJ », réel −2 032,48 €, budget +2 032,48 €) affichait 2 032,48 € de revenus attendus qui ne viendront jamais. Le sens d'un budget de virement (entrant ou sortant) reste hors périmètre.
