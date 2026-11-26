# Besoin (tel quel, Lucas, 2026-11-26)

Lot 3 — échéance d'origine des récurrentes et bascule, partie sensible (argent, algorithme de bascule). Quatre trous repérés à la relecture du 2026-11-25 (reproduits en exécutant le code) :

(n°5) Échéances (trésorerie get-cashflow-forecast et calendrier get-calendar-data) : une récurrente payée en avance est comptée deux fois. isRecurringAlreadyPaid (reporting/domain/recurring-already-paid.ts) ne reconnaît une occurrence payée que le même jour, même montant, libellé contenu, et la trésorerie seulement à d===0 : une paie du 28 pointée le 26 est encore projetée le 28 (la sortie du pending à la date du jour, déclencheur v4.1.0, rend ce cas courant). Piste : reconnaître par metadata.recurringId et l'échéance prévue, pas par date/libellé/montant.

(n°10) Bascule : une occurrence est sautée si une transaction de la même récurrente existe déjà dans le même mois civil (period-switch.ts, règle c, monthKey) ; une facture redatée au mois suivant (loyer du 30/11 payé et daté 01/12) fait disparaître l'occurrence du 30/12. Piste : mémoriser l'échéance d'origine de l'occurrence (dueDate dans metadata), et comparer sur elle.

(n°7) Bascule : deux paies récurrentes (jours 28 et 2) : la règle (d) « paie à moins de 15 jours du début non injectée » vise toutes les paies (salaries.includes), donc la seconde n'est jamais injectée. Piste : n'écarter que la récurrente qui a déclenché la bascule.

(n°8) Décision de Lucas : la bascule n'a lieu que pour un montant strictement positif (aujourd'hui un montant négatif ou nul de la catégorie déclencheuse bascule, le planificateur ne reçoit pas le montant).

Décisions déjà prises dans specs/declencheur-periode/ (seuil 15 jours, règle A, nettoyage à l'import, etc.) : ne pas les remettre en cause.

Indicateur : nombre de récurrentes comptées deux fois dans Échéances et d'occurrences manquantes après bascule (logs ou requête lecture seule en prod).

## Questions à Lucas (cadrage, 2026-11-26)

Réponse de Lucas, tel quel : « Go t'es recos » (les trois recommandations de l'orchestrateur sont retenues) :
1. Un paiement saisi sans lien avec sa récurrente (saisie à la main, import du relevé) règle aussi l'échéance dans Échéances, par la règle d'équivalence déjà validée pour l'import (`docs/periods.md`, nettoyage) : même catégorie non nulle, même signe, écart de date ≤ 7 jours. Le lien `metadata.recurringId` reste prioritaire.
2. Deux paies récurrentes (jours 28 et 2), bascule partie du 28 : la fin de la nouvelle période ne se cale que sur la paie qui a déclenché la bascule (sa prochaine occurrence à au moins 15 jours), pas sur la plus proche de toutes les paies ; la paie du 2 est injectée normalement (pending) dans la nouvelle période.
3. Mesure : Lucas regarde Échéances après avoir pointé une paie en avance (courbe, point bas) ; plus une requête en lecture seule en prod qui compte les échéances comptées deux fois.

## Décision 1 (Lucas, 2026-11-26 : « Go »)
1. Reprise des transactions existantes sans `dueDate` : option A, aucune reprise. Vérifié en prod (lecture seule, 2026-11-26) : 0 transaction `pending` liée à une récurrente (`metadata.recurringId`), 1 seule réglée liée, 0 avec `dueDate`. Sans échéance d'origine, on lit la date de la transaction (repli). Prime sur la recommandation B de la spec.
2. Paie déclenchante (hypothèse H1 de la spec, validée) : celle de `metadata.recurringId` de la transaction ; sans lien, la récurrente équivalente la plus proche en date (même catégorie, même signe, ≤ 7 jours) ; sans correspondance, comportement actuel (la plus proche).
