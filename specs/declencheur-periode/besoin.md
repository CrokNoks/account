# Besoin (tel quel, Lucas, 2026-11-25)

Je souhaiterais un mode trigger où lorsqu'on saisit une transaction associée à une catégorie en particulier, ça ferme la période active et ça en rouvre une nouvelle avec les règles actuelles du mois et tout ça, en changeant la date de fin de la période active qui est clôturée. Est-ce que c'est clair ?

## Réponses de Lucas (cadrage, 2026-11-25)

1. Dates : l'ancienne période finit la veille de la date de la transaction ; la nouvelle commence à la date de la transaction et dure un mois (fin proposée actuelle : début + 1 mois - 1 jour). Exemple : paie du 28 nov. → ancienne jusqu'au 27 nov., nouvelle à partir du 28 nov.
2. Déclenchement : toute création, import en lot compris, sans confirmation ; sauf si la période active a commencé depuis peu (protection contre une prime de la même catégorie). Seuil : non fixé par Lucas, à trancher à la décision 1.
3. Impact : moins de gestes. Indicateur : part des périodes ouvertes par le déclencheur plutôt qu'à la main.
4. Récurrentes : corriger dans ce cycle l'injection d'une période à cheval sur deux mois (chaque récurrente à sa bonne date dans la période), aussi pour les périodes créées à la main.

## Points repérés par l'orchestrateur, non tranchés par Lucas

- Seuil « commencée depuis peu » (proposition : moins de 15 jours entre le début de l'active et la date de la transaction).
- Import contenant plusieurs transactions déclencheuses, ou une date antérieure au début de l'active.
- Transaction déclencheuse `pending` ou datée dans le futur ; récurrentes générées (elles ne doivent pas redéclencher en boucle) ; virement ; changement de catégorie après coup.
- Aucune période active au moment de la saisie.
- Budgets : « règles actuelles » compris comme les montants fixes du compte, et récurrentes injectées (hypothèse).
- Doc de l'existant : clôture (PATCH) puis création (POST) ne sont pas atomiques ; le trigger `assign_period_id` rattache à la période active au moment de l'insertion sans regarder la date (à résoudre en conception : la transaction déclencheuse doit être dans la nouvelle période).

## Hypothèses annoncées à Lucas (sans objection à ce stade, à valider à la décision 1)

- Pas de bascule si la transaction tombe moins de 15 jours après le début de la période active.
- `pending` ou date future : ne déclenche rien (ni plus tard, seule la création déclenche).
- Une seule catégorie déclencheuse par compte, désactivé par défaut.
- Budgets = montants fixes du compte ; récurrentes injectées.
- Aucune période active, ou date avant le début de l'active : rien.
- Import : au plus une bascule par échéance, dans l'ordre des dates.
- Virement et changement de catégorie après coup : ne déclenchent pas.

## Réponse de Lucas à la décision 1 (2026-11-25, tel quel ; pas encore de « go »)

« Paye correspondant aux catégories en tant que récurrente, le fait de la sortir du pending déclencherait le changement de période, à la différence que en sortie du pending, il faut changer la date de saisie de la transaction pending à la date du jour de sortie du pending. Parce que ça veut dire que je viens de le faire, par exemple un virement, je viens de le faire depuis un autre compte, et il ne faut pas que la date soit dans le futur, il faut qu'elle soit vraiment au jour où je retire le pending, pour déclencher la nouvelle période. »

Remplace l'hypothèse « `pending` ne déclenche rien, ni plus tard ; seule la création déclenche » (une création `pending` ne déclenche toujours pas).

Conséquence repérée par l'orchestrateur (non tranchée) : paie récurrente jour 28, période 28 nov. → 27 déc. : l'occurrence du 28 déc. est hors période, donc jamais injectée en `pending`, rien à sortir du `pending` le mois suivant. Et une paie du 1er déc. sortie du `pending` le 28 nov. ne doit pas être réinjectée au 1er déc. dans la nouvelle période.

## Décision 1 validée par Lucas (2026-11-25) : « A go »

A : s'il existe une paie récurrente (catégorie déclencheuse), la nouvelle période finit la veille de sa prochaine occurrence (au lieu de début + 1 mois - 1 jour, gardé sinon) ; cette prochaine paie est quand même injectée en `pending`, hors période, hors prévu, visible dans Opérations « toutes les périodes » et par un accès direct depuis Aujourd'hui.
Le « go » valide aussi les hypothèses présentées : seuil de 15 jours (écart 14 rien, 15 bascule) ; date du jour à la sortie du `pending` pour la seule catégorie déclencheuse (dates prévues passées comprises, aussi sous le seuil, sans bascule) ; date envoyée dans la même modification ignorée ; catégorie finale décisive ; une bascule au plus par lot ; virement de l'app jamais déclencheur ; paie à moins de 15 jours non réinjectée ; paie saisie à la main : la `pending` restante n'est pas touchée ; rattachement des opérations déjà saisies et non-réinjection d'une récurrente déjà présente le même mois (H1) ; import : chaque opération dans la période qui contient sa date.
