# Échéance d'origine des récurrentes : Échéances sans double compte, bascule sans occurrence perdue

## Le problème
Une récurrente payée en avance ou redatée est comptée deux fois dans Échéances (courbe, point bas, calendrier). La bascule perd l'occurrence suivante (loyer du 30/11 payé le 01/12 : plus de 30/12), n'injecte jamais la seconde paie (jours 28 et 2) et se déclenche sur un montant négatif ou nul. Cause commune : on ne sait pas à quelle échéance une transaction correspond, on devine par date, libellé et montant.

## Définitions
- **Échéance d'origine** (`metadata.dueDate`, `YYYY-MM-DD`) : le jour où l'occurrence d'une récurrente était due quand elle a été créée. Elle ne bouge pas quand la transaction change de date (pointage d'une paie : la date devient celle du jour ; facture redatée).
- Posée à chaque création d'une transaction depuis une récurrente : injection à la création manuelle de période (`create-period-with-budgets.use-case.ts:77-89`), injection par la bascule, prochaine paie (`period-switch.ts:384-413`, écriture `apply-period-switch.service.ts:252-279`). Jamais posée sur une saisie à la main ou un import (pas de `recurringId`).
- Sans `dueDate` (transactions existantes) : on lit la date de la transaction, comme aujourd'hui.
- Occurrence **réglée** : (1) une transaction a le même `metadata.recurringId` et la même échéance ; sinon (2) une transaction sans lien a la même catégorie non nulle, le même signe et un écart de date ≤ 7 jours (règle d'équivalence de `docs/periods.md`, nettoyage à l'import ; réponse de Lucas, `besoin.md`). Le lien prime. Une transaction ne règle qu'une occurrence (la plus proche en date, puis id).
- Cas à part : une récurrente sans catégorie garde l'ancienne reconnaissance (même jour, même montant, libellé contenu), faute d'équivalence possible (hypothèse H2).

## Critères d'acceptation
- [ ] CA1 — Paie du 28 (récurrente, 2 000,00 €) pointée le 26 : elle prend la date du 26 et garde l'échéance du 28. Échéances n'ajoute plus 2 000,00 € le 28 : ni dans la courbe et le point bas, ni dans le calendrier du mois.
- [ ] CA2 — Un paiement saisi à la main ou importé, sans lien, de même catégorie, même signe, à 7 jours au plus de l'échéance, règle cette échéance ; à 8 jours non. Une seule échéance par transaction : deux loyers projetés à 3 jours d'écart ne sont pas écartés par un seul paiement.
- [ ] CA3 — Trésorerie : une échéance n'est écartée que si la transaction qui la règle est datée d'aujourd'hui ou avant (déjà dans le solde du jour). Réglée par une transaction future (ex. facture `pending` datée du 30), elle reste projetée. Calendrier : l'échéance réglée n'est pas affichée en « Prévue » en plus de la transaction, y compris quand la transaction est datée dans le mois voisin (loyer du 30/11 daté 01/12 : plus de « Prévue » le 30/11).
- [ ] CA4 — Bascule, loyer du 30/11 payé et daté 01/12 : à la bascule suivante, le doublon se compare sur l'échéance d'origine (30/11, mois de novembre) ; l'occurrence du 30/12 est injectée en `pending`. Une transaction sans échéance d'origine est comparée sur sa date.
- [ ] CA5 — Bascule déclenchée le 28/11 par la paie du 28 ; paies récurrentes des jours 28 et 2 : la nouvelle période finit la veille de la prochaine occurrence de la paie du 28 à au moins 15 jours (soit le 27/12) ; la paie du 2 est injectée (02/12, `pending`) ; seule la paie déclenchante n'est pas injectée à moins de 15 jours du début.
- [ ] CA6 — Transaction déclencheuse de montant −50,00 € ou 0 : aucune bascule, la transaction est enregistrée, le log `period_trigger_skipped` porte une raison dédiée (hypothèse H3 : `non_positive`). −50,00 € ou 0 sur une récurrente de la catégorie déclencheuse reste traitée comme les autres récurrentes (déjà le cas).
- [ ] CA7 — Toute occurrence créée par la création manuelle de période, la bascule ou la prochaine paie porte son échéance d'origine ; la modifier de date, la pointer ou la faire sortir du pending ne la change pas.
- [ ] CA8 — Le journal `cashflow_forecast_built` compte les échéances écartées (nombre déjà exposé : `alreadyPaidCount`) pour tous les cas ci-dessus, sans libellé ni montant.

## Règle critique
**Une occurrence (récurrente + échéance d'origine) n'est comptée qu'une fois dans Échéances, et une transaction ne règle qu'une occurrence.** Test avant le code : paie du 28 pointée le 26 (même `recurringId`, échéance 28) → la trésorerie du 26 n'a aucun événement le 28 ; seconde paie identique le 28 suivant : toujours un événement. Deuxième test, algorithme de bascule : loyer échéance 30/11 daté 01/12 → occurrence 30/12 injectée.

## Mesure d'impact
- Indicateur qui doit bouger : échéances comptées deux fois dans Échéances (cible 0) et occurrences manquantes après bascule (cible 0). Équipe : Performance (fiabilité du point bas avant une grosse dépense).
- Comment on le mesure : (1) requête en lecture seule en prod (à écrire par le développeur, dans `functions/http/`, à exécuter avant et après) : transactions avec `metadata.recurringId` dont la date est après aujourd'hui − 7 jours, groupées par `recurringId` et mois civil de l'échéance (`dueDate`, sinon date) : toute récurrente avec une transaction déjà dans le solde du jour **et** une échéance du même mois restant à venir est comptée deux fois dans l'ancien calcul ; (2) occurrences manquantes : récurrentes sans transaction dont l'échéance tombe dans une période close après bascule ; (3) Lucas regarde Échéances après avoir pointé une paie en avance (courbe, point bas) ; (4) log `cashflow_forecast_built.alreadyPaidCount`.

## Exploitation
- À voir en prod : `cashflow_forecast_built` (`alreadyPaidCount`), `period_opened` (`injected`), `period_trigger_skipped` (nouvelle raison).
- Retour arrière : revert du code ; `dueDate` est un champ de plus dans `metadata`, ignoré par l'ancien code, rien à corriger.
- Feature flag : non (changement de calcul affiché, sans écriture destructrice ; le revert suffit).

## Parties sensibles
- Algorithme de bascule (`period-switch.ts`) : règles (c), (d), A, garde sur le montant. Critère : algorithme.
- Calcul d'argent dans Échéances (trésorerie, point bas, calendrier) : règle « déjà payée ». Critère : calcul qui touche l'argent.

## Ce qui change dans l'existant
- **Remplace** la règle « Récurrente déjà payée » (`docs/reporting.md:45`, `reporting/domain/recurring-already-paid.ts:8-20`) : plus de comparaison même jour / même montant / libellé contenu ; lien + échéance, puis équivalence ; une transaction règle une seule occurrence (l'actuelle écarte plusieurs récurrences identiques, `reporting.md:132`) ; la trésorerie ne regarde plus seulement aujourd'hui (`:44`, `get-cashflow-forecast.use-case.ts:83-89`).
- **Change la règle (c)** « même mois civil » (`docs/periods.md:130`, `period-switch.ts:370-374`) : comparaison sur l'échéance d'origine (mois civil de `dueDate`, sinon de la date).
- **Change la règle (d)** « paie à moins de 15 jours non injectée » (`period-switch.ts:368-369`, `docs/periods.md:130`) : ne vise que la paie déclenchante (`salaries.includes` aujourd'hui = toutes).
- **Précise la règle A** « la plus proche si plusieurs » (`period-switch.ts:342-354`, `docs/periods.md:128`, `docs/recurring.md:25`), décision de Lucas : seule la paie déclenchante fixe la fin. Sa prochaine occurrence à ≥ 15 jours (seuil inchangé). Identification de la paie déclenchante : voir H1.
- **Change** « une récurrente / transaction négative ou nulle de la catégorie déclencheuse bascule » : une déclencheuse de montant ≤ 0 ne bascule plus (décision n°8 de `besoin.md`). Le planificateur reçoit aujourd'hui le montant des seules lignes d'import (`apply-period-switch.service.ts:114-119`, pas de `amount` dans `triggers`).
- Ne touche pas : seuil 15 jours, nettoyage à l'import (équivalence 7 jours), prochaine paie en `pending`, `pending` = facture à venir (`specs/declencheur-periode/`).
- Chemins d'exposition de la règle « déjà payée » (grep de `isRecurringAlreadyPaid`) : trésorerie `get-cashflow-forecast` (couvert, CA1 à CA3), calendrier `get-calendar-data` (couvert), liste « À venir » du front (lit les événements du calendrier : couverte par le calendrier). Les autres usages des récurrentes (brouillon de période, budgets par défaut) ne lisent pas la règle : hors périmètre.

## Fichiers concernés
- À modifier : `functions/src/reporting/domain/recurring-already-paid.ts` — nouvelle règle (échéance réglée, un pour un)
- À modifier : `functions/src/reporting/application/get-cashflow-forecast.use-case.ts` — lit les transactions utiles (aujourd'hui − 7 j et plus), écarte seulement celles déjà dans le solde
- À modifier : `functions/src/reporting/application/get-calendar-data.use-case.ts` — transactions du mois ± 7 jours pour la reconnaissance, événements affichés inchangés
- À modifier : `functions/src/periods/domain/period-switch.ts` — (c) sur l'échéance, (d) et A sur la paie déclenchante, garde montant, `dueDate` dans `PlannedOccurrence`
- À modifier : `functions/src/periods/application/apply-period-switch.service.ts` — passe montant et `dueDate`, lit l'échéance des existantes (`:189-205`), écrit `dueDate` (`:252-279`), journal
- À modifier : `functions/src/periods/application/create-period-with-budgets.use-case.ts` — `dueDate` dans `metadata` (`:87`)
- À créer (si option B) : `supabase/migrations/20261126110000_backfill_recurring_due_date.sql` — reprise des `pending` (le projet a un dossier de migrations, dernière : `20261126100100_…`)
- À créer : `functions/http/echeance-origine-recurrentes.http` — scénarios réels et requête de mesure (lecture seule)
- Tests : `functions/src/reporting/domain/recurring-already-paid.spec.ts`, `get-cashflow-forecast.use-case.spec.ts`, `get-calendar-data.use-case.spec.ts`, `functions/src/periods/domain/period-switch.spec.ts`, `apply-period-switch.service.spec.ts`, `create-period-with-budgets.use-case.spec.ts`
- Doc à mettre à jour par le documentaliste : `docs/reporting.md`, `docs/periods.md`, `docs/recurring.md`

## Exemples chiffrés
| Cas | Avant | Après |
| --- | --- | --- |
| Paie 2 000,00 € du 28, pointée le 26 | solde du 26 +2 000,00 €, et +2 000,00 € de nouveau le 28 (courbe à 4 000,00 € de trop) | +2 000,00 € une fois |
| Loyer −800,00 € dû le 30/11, payé et daté 01/12 | bascule du 15/12 : 30/12 perdu (une transaction « de décembre » existe) | 30/12 injecté en `pending` |
| Paies jours 28 et 2, bascule le 28/11 | fin = veille de la paie la plus proche à ≥ 15 jours (28/12 non, 02/01 : 01/01), paie du 2 jamais injectée | fin 27/12, paie du 2 injectée le 02/12 |
| Déclencheuse −50,00 € ou 0 | bascule | pas de bascule, transaction enregistrée, raison journalisée |

## Hors périmètre
Le prévu par catégorie et les soldes (`reporting`), le seuil de 15 jours, le nettoyage à l'import, l'écran des récurrentes, suspendre une récurrente, empêcher la modification de `metadata` par la personne.

## Hypothèses
- H1 — Paie déclenchante = la récurrente dont l'id est dans `metadata.recurringId` de la déclencheuse ; sans lien (saisie, import), la récurrente de la catégorie équivalente (écart ≤ 7 jours, la plus proche en date) ; sans correspondance, comportement actuel (la plus proche de toutes). Non confirmé par Lucas.
- H2 — Récurrente sans catégorie : ancienne reconnaissance conservée (même jour, même montant, libellé contenu). Sans elle, ces récurrentes seraient comptées deux fois.
- H3 — Raison journalisée `non_positive`, ordre des contrôles : après `threshold`. Le pointage d'une paie ≤ 0 prend quand même la date du jour (`docs/periods.md:132` : vrai même sans bascule).
- H4 — Le front n'envoie pas `metadata` à la modification (`frontend/src/features/transactions`, seulement à la création) : `dueDate` survit aux modifications. Une personne qui remplace `metadata` par l'API le perd : retour à la date (limite déjà connue, `docs/recurring.md:25`).
- H5 — Équivalence ≤ 7 jours : une dépense sans lien de même catégorie et signe peut écarter à tort une échéance proche (ex. deux courses dans la semaine d'une récurrente « Courses »). Accepté par la réponse 1 de Lucas ; mesuré par `alreadyPaidCount`.

## Points ouverts
**À trancher (Lucas) : reprise des transactions existantes sans `dueDate`.** Sans reprise, une `pending` déjà injectée qu'on pointe après la mise en prod n'aura pas d'échéance d'origine : au pointage sa date change (paie : date du jour) et l'échéance est perdue, donc CA1 et CA4 ne valent que pour les occurrences créées après le déploiement, soit jusqu'à un mois de retard.
- Option A — aucune reprise : 0 fichier, 0 risque ; le lien `recurringId` + équivalence 7 jours règlent déjà CA1 pour les paies pointées ≤ 7 jours en avance ; le cas du loyer redaté (CA4) n'est corrigé qu'à partir du mois suivant.
- Option B — migration SQL idempotente : `dueDate = date` pour les transactions `pending` avec `recurringId` et sans `dueDate` (leur date est encore celle d'injection). 1 fichier, métadonnées seulement, aucune date ni montant touché. Les transactions déjà pointées restent sans échéance (leur date d'origine est inconnue : lue comme la date). Couvre toutes les occurrences encore à régler.
- Option C — migration sur toutes les transactions avec `recurringId` (pending ou non) : fige la date actuelle comme échéance, ce qui reproduit l'erreur pour les redatées ; aucun gain sur B.
- **Recommandation : B** (une migration, déploiement dans n'importe quel ordre grâce au repli sur la date, vérifier avec un `count` avant/après en lecture seule). Le « db push » reste à faire après vérification complète.

Autre point : aucun. Zones d'ombre de `docs/reporting.md` touchées : « une transaction écarte plusieurs récurrences identiques » (`:132`) est tranchée par la règle un pour un ; « `getTime()` à minuit UTC » (`:129`) disparaît avec la comparaison par échéance.
