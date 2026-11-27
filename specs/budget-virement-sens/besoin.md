# Besoin (tel quel, Lucas, 2026-11-27)

Budget de virement (relevé aux cycles soldes-et-prevu-justes et echeance-origine-recurrentes, « Reste ouvert »). Les catégories de type virement (transfer) sont comptées côté revenus dans le prévu (period-forecast.ts, incomeRule) : un budget de virement positif encore non parti compte comme revenu attendu (+|budget|), qu'il s'agisse d'un virement entrant ou sortant. Exemple réel en prod : « Virement CJ » (virement sortant récurrent, budget +2 032,48 €) ; tant que le virement n'est pas passé, le prévu monte de 2 032,48 € pour de l'argent qui va sortir. Seul le virement sortant déjà passé (réel < 0) est corrigé (décision « virements sortants », v4.2.0 : retenu = réel, budget ignoré). Le sens d'un budget de virement (entrant ou sortant) n'est défini nulle part (signe du budget ignoré partout : valeur absolue). Écran Budgets : le virement est affiché dans le tableau « Dépenses » mais compté dans « Revenus prévus » (écart déjà noté). Indicateur : écart du prévu dû aux budgets de virement en prod (requête lecture seule avant/après) ; « Non réparti » et « Revenus prévus » justes pour un compte avec virement sortant budgété.

## Mesure de départ (orchestrateur, prod, lecture seule, 2026-11-27)
4 catégories de type virement. Le signe du budget stocké correspond déjà au sens des opérations :
- « Virement CJ » : 15 sorties, 0 entrée ; budgets tous négatifs (4) ; budget de la période active −2 032,48 € ; montant par défaut −2 032,48 €.
- « Salaire Lucas » (24 entrées), « Pension invalidité Flo » (24 entrées), « CAPSSA Flo » (23 entrées) : 0 sortie ; budgets tous positifs.
Le calcul prend la valeur absolue du budget, donc ignore ce sens. Attention : l'écran Budgets enregistre un budget modifié en positif (`budget-draft.ts`), ce qui transformerait le budget de « Virement CJ » en virement entrant à la première modification.

## Questions à Lucas (cadrage, 2026-11-27)

Réponse de Lucas, tel quel : « Je valide les 3 . Go » :
1. Pour les catégories de type virement, le signe du budget porte le sens : négatif = sortie, comptée comme une dépense (max(dépensé, |budget|)) ; positif = entrée, comptée comme un revenu (comme aujourd'hui). Aucune migration de données.
2. Écran Budgets : un virement sortant s'affiche dans « Dépenses » et compte dans « Total budgété » ; un virement entrant dans « Revenus ». Modifier le montant garde le sens déjà enregistré. Une catégorie de virement sans budget ni opération est traitée comme une entrée, sauf si Lucas tape un montant négatif (accepté seulement pour les virements).
3. Mesure : Lucas vérifie sur l'écran Budgets qu'avec « Virement CJ » budgété mais pas encore parti, le prévu baisse de 2 032,48 € au lieu de monter ; plus une requête lecture seule de l'écart du prévu sur toutes les périodes.

## Décision 1 (Lucas, 2026-11-27 : « Go »)
1. Virement entrant qui revient négatif (budget positif, réel < 0) : retenu = réel, budget ignoré (règle actuelle conservée).
2. Ligne « Budget » du rythme de dépense (Aujourd'hui) : garde sa valeur hors virements (champ de plus dans les stats).
3. Saisie d'un budget de virement : le sens appliqué est le sens connu (signe du budget enregistré, à défaut signe du réel) ; « entrant par défaut » seulement pour un virement sans budget ni opération. Un montant positif tapé sur « Virement CJ » sans budget reste donc enregistré en négatif.
