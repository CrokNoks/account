# Besoin (tel quel, Lucas, 2026-11-26)

Lot 4b — virements à deux côtés (n°12 de la relecture du 2026-11-25). Un virement entre comptes crée deux transactions liées par metadata.transferId (create-transfer.use-case.ts : sortie négative sur la source, entrée positive sur la destination, type transfer_out / transfer_in, relatedAccountId), écrites ensemble (create_transfer). Mais transferId n'est jamais relu : supprimer (simple ou en lot) ou modifier (montant, date, simple ou en lot) un côté laisse l'autre intact, donc les deux comptes divergent (argent sorti sans arriver, ou l'inverse). Piste : supprimer ou modifier les deux côtés ensemble (montant opposé, même date), ou refuser si la personne n'a pas l'accès en écriture à l'autre compte. Indicateur : nombre de virements orphelins ou désaccordés en prod (requête lecture seule avant/après).

## Mesure de départ (orchestrateur, prod, lecture seule, 2026-11-26)
Transactions portant `metadata.transferId` : 3 virements de l'application en tout, 0 orphelin (un seul côté), 0 désaccordé (montants qui ne s'annulent pas ou dates différentes). Le problème est donc préventif à ce jour.

## Questions à Lucas (cadrage, 2026-11-26)

Réponse de Lucas, tel quel : « Go recos » :
1. Modifier ou supprimer un côté d'un virement : les deux côtés suivent (montant opposé, même date ; suppression des deux), refusé sans rien modifier si la personne n'a pas le droit d'écrire sur l'autre compte.
2. Seuls le montant et la date sont synchronisés ; pointage, `pending`, catégorie, notes et libellé restent propres à chaque côté.
3. À faire maintenant, en version courte (synchroniser montant et date, supprimer les deux côtés).

## Décision 1 (Lucas, 2026-11-26 : « Go »)
1. Montant de signe contraire ou nul : refus (400), rien n'est écrit.
2. Autre côté disparu (orphelin) : on modifie ou supprime le côté restant ; le contrôle de droits porte sur `relatedAccountId` (un compte invisible n'est pas pris pour un orphelin).
3. Autre côté déjà pointé : le montant et la date suivent quand même.
