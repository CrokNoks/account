# Besoin

Refonte interface, cycle 7 sur 7 (slug refonte-mobile) : accueil et saisie d'une opération sur mobile, barre du bas, retrait des anciennes adresses (/evolution, /flux, /depassements, /calendar, /cashflow) et ordre des deux migrations de la refonte à régler (drop_user_preferences doit passer après le déploiement, replace_period_budgets_expected avant le back).

Plan : `specs/refonte-interface/plan.md`. Maquettes : `specs/refonte-interface/maquette/MobileAccueil.dc.html` et `MobileSaisie.dc.html`.

Consigne pour tout le plan : commits locaux, sans push, sans release ni db push, tant que toute la refonte n'est pas terminée, front et back.

Vérifications réelles des cycles 1 à 6 non faites : Lucas a choisi de continuer sans elles.

Reportés : sur mobile, l'étape Budgets de la visite « compte » est sautée si la sidebar n'est pas rendue ; Budgets, Échéances et Réglages absents de la barre du bas.

## Réponses de Lucas

- Barre du bas : Aujourd'hui, Opérations, +, Analyses, Plus. « Plus » ouvre Budgets, Échéances et Réglages.
- Anciennes adresses : supprimées, elles répondent 404.
- Migrations : tout en une fois. On accepte que l'ancien front casse sur le tableau de bord entre l'application des migrations et le déploiement.
- Impact : saisie mobile en 3 gestes (ouvrir, toucher +, saisir et enregistrer, catégorie suggérée). Mesure par vérification, sans suivi ajouté.

## Mode

Complet : retrait d'adresses, migration qui supprime des données, saisie d'une opération.

## Réponses de Lucas après la mini-spec

- Accueil mobile : comme la maquette, prévu, À traiter et budgets à surveiller seulement. Le solde à venir, le rythme et les factures ne sont pas affichés sur mobile.
- Montant : sur mobile seulement, bouton Dépense/Revenu et pavé numérique. Le bureau garde le champ actuel. Partie sensible : signe du montant testé avant le code.
- Options : virement, étiquettes et « en attente » dans un bloc « Plus d'options », replié par défaut.
- Export de `user_preferences` : non, perte assumée.

## Défauts retenus et annoncés à Lucas

- Budgets à surveiller : les dépassés, puis les plus consommés, 5 au plus, sans seuil.
- Visite « compte » sur mobile : une étape pointe « Plus ».
- Touche Entrée : elle ne doit jamais envoyer deux fois la même opération pendant l'envoi.

## Réponses de Lucas après le canard

- Factures : la ligne « Factures à venir » reste dans la composition du prévu, pour une somme juste au centime. Seul le bloc des prochaines factures disparaît du mobile.
- « Plus » propose aussi la déconnexion. Le solde à venir reste visible sur mobile en tête d'Opérations.
- Pavé numérique : le clavier natif du téléphone en mode chiffres avec virgule, pas un pavé dessiné.
- Le bouton « Nouvelle opération » en haut de l'accueil est retiré sur mobile, le « + » de la barre suffit. Le bureau garde son bouton.
