# Besoin (tel quel, Lucas, 2026-11-25)

Lot 2 — soldes et prévu justes, partie sensible (argent). Trois trous repérés à la relecture du 2026-11-25, après le lot 1 (v4.1.1, remboursement net ajouté au prévu via expenseRule, décision « option B »).

(n°1) Le solde de départ d'une période (load-period-forecast-input.ts, sum_transactions_before_date) prend toutes les transactions avant le début, pending et non pointées comprises : les factures pending et CB non pointées d'une période finie entrent dans « En banque » et « À venir » de la suivante, contrairement à la définition (docs/reporting.md:13-14 : en banque = pointées ; à venir = non pending). Piste : un départ par solde (pointées pour En banque, non pending pour À venir, tout pour le prévu), les anciennes lignes restant visibles en CB / Factures ; vérifier la composition (banque + CB + factures + budget restant + revenus attendus = prévu) et l'évolution.

(n°6) Période active dont la fin est passée : un revenu pointé daté après la fin n'est pas compté « En banque » (fenêtre isInPeriodWindow) tant que la période suivante n'est pas ouverte. Le prévu l'ignore volontairement (factures-reservees, assumé) ; la banque doit compter tout ce qui est pointé.

(n°4) Décision de Lucas : le prévu prend le max (dépensé, budget) PAR CATÉGORIE et non sur le total des dépenses ; aujourd'hui un dépassement est masqué par un budget non consommé (courses -500 pour budget 300, loyer 800 non payé : prévu trop haut de 200). Garder expenseRule et l'option B du remboursement net, la simulation (expensesEffect, « Sans effet » par côté), la composition, et décider côté revenus (même règle par catégorie ou non : à soumettre à Lucas).

Indicateur : écart entre « En banque » affiché et le solde réel du relevé ; part des périodes dont le prévu change avec la nouvelle règle (requête lecture seule en prod).

## Questions à Lucas (cadrage, 2026-11-25)

1. Revenus : même règle par catégorie que les dépenses (max(réel, prévu) par catégorie) ? — Lucas : « OK » (par catégorie).
2. Une CB non pointée ou une facture `pending` d'une période fermée, toujours pas réglée, apparaît-elle dans la période en cours (lignes CB et Factures, « À pointer · N ») ? — Lucas, tel quel : « non la ligne a pointer est une facture qui va être prélevé sous peu (cb a venir) et le pendant est de l'argent réservé car elle forcément tomber a la date de saisie ( provision sur cb par exemple). »
3. Mesure de « En banque » juste — Lucas : « en comparant a la main avec mon relevé ».

## Lecture de l'orchestrateur (hypothèse, à confirmer à la décision 1)
Réponse 2 = non : les lignes d'une période fermée ne sont pas reprises comme lignes de la période en cours. Une ligne « à pointer » est une CB qui sera prélevée sous peu, une `pending` est de l'argent réservé (provision CB) qui tombera à sa date : les deux restent donc dues. Ce qui n'est pas tranché : si elles ne sont plus « En banque » et ne sont pas des lignes de la période en cours, comptent-elles encore dans « À venir » et le prévu (via le solde de départ), et comment l'égalité de la composition (banque + CB + factures + budget restant + revenus attendus = prévu) tient-elle alors ?

## Décisions de Lucas après le canard (2026-11-25, tel quel : « 1 a. 2 garde le prévu tel quel. 3 miroir »)
1. Lignes non réglées d'une période fermée : option A, une ligne « Reports » à part dans la composition ; les lignes CB, Factures et « À pointer · N » restent celles de la période.
2. Revenu pointé daté après la fin d'une période active : compté dans « En banque », le prévu reste tel quel (il l'ignore) ; la composition ajoute une ligne « Arrivé après la fin » (négative) pour que l'égalité tienne au centime.
3. Réel négatif dans une catégorie de revenu ou de virement : miroir de l'option B, le budget reste entier et le négatif se déduit (salaire budget 2 000, correction −50 : revenus retenus 1 950).

## Décision 1 (Lucas, 2026-11-25, tel quel : « Une transaction ne peut pas être pointé et pendant en même temps. Sinon go »)
Règle métier : `reconciled` et `pending` ne sont jamais vrais ensemble. Vérifié en prod (lecture seule, 2026-11-25) : 0 transaction sur 2 735 dans cet état. Le petit cas du canard « revenu pointé et `pending` » n'existe donc pas. Proposition de l'orchestrateur, ajoutée à la spec : l'API refuse toute écriture qui produirait cet état (pointer continue de retirer `pending` ; mettre `pending` sur une transaction pointée est refusé).
