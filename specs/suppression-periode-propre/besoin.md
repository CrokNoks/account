# Besoin (tel quel, Lucas, 2026-11-26)

Lot 4c — suppression de période (n°9 de la relecture du 2026-11-25). Supprimer une période (DELETE /:accountId/periods/:id) supprime ses budgets (cascade) mais ses transactions perdent seulement leur period_id (ON DELETE SET NULL) : les factures pending générées depuis les récurrentes (metadata.source 'recurring', recurringId, dueDate) restent. Recréer la période avec injectRecurring les injecte une seconde fois (création manuelle sans contrôle de doublon, décision Lucas du cycle declencheur-periode). Une bascule ouverte par erreur n'a donc pas d'annulation propre : supprimer la nouvelle période ne rouvre pas l'ancienne (fin et is_active), et laisse la prochaine paie pending et les récurrentes injectées. Piste : à la suppression, proposer de supprimer aussi les pending générées par la période (récurrentes non pointées) ; éventuellement « annuler la bascule » (supprimer la période ouverte par le déclencheur et rouvrir la précédente). Indicateur : factures pending en double après recréation de période (requête lecture seule en prod avant/après).

## Mesure de départ (orchestrateur, prod, lecture seule, 2026-11-26)
41 périodes ; 24 récurrentes ; 1 catégorie déclencheuse marquée ; 0 période créée depuis la v4.1.0 (déclencheur) ; 0 facture `pending` issue d'une récurrente ; 0 `pending` sans période ; 0 occurrence récurrente en double. Le problème est préventif : il apparaîtra avec les prochaines bascules ou créations de période avec injection.

## Questions à Lucas (cadrage, 2026-11-26)

Réponse de Lucas, tel quel : « Go reco » :
1. Supprimer une période supprime aussi ses factures `pending` générées par les récurrentes et non pointées, après confirmation à l'écran ; les transactions pointées, saisies ou importées restent.
2. Annuler une bascule faite par erreur, en version simple : supprimer la dernière période, si elle a été ouverte par le déclencheur, rouvre la précédente (active, fin d'avant la bascule). La paie déclenchante reste à sa date ; Lucas la corrige ensuite.
3. À faire maintenant.

## Décision 1 (Lucas, 2026-11-26 : « Go reco »)
1. Annulation d'une bascule : les transactions conservées de la période supprimée (paie déclenchante, saisies, importées, pointées) sont rattachées à la période rouverte. Hors annulation de bascule, elles restent sans période, comme aujourd'hui.
2. Annonce avant suppression : nombres seulement (factures à venir supprimées, transactions conservées, période rouverte), sans montants.
3. Réouverture seulement si la période supprimée est encore active ; sinon, simple suppression avec nettoyage des factures générées.
