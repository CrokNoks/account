# Écarts du tableau de bord (nettoyage après la refonte à 9 widgets)

## Le problème
Après la refonte du tableau de bord (commit 72ebb0c), trois restes : un utilitaire de pourcentage plus utilisé, un texte de visite guidée qui promet trois soldes alors que la carte surlignée n'en montre qu'un, et la disposition enregistrée de Lucas où la carte « Revenus / Dépenses » (deux lignes) reste trop étroite (largeur 2).

## Critères d'acceptation
- [ ] CA1 — Étant donné le code du front, quand on cherche `shared/lib/percentage` (fichier et test), alors ils n'existent plus et le build, les types et les tests du front passent.
- [ ] CA2 — Étant donné la visite guidée du tableau de bord en français, quand on arrive à l'étape « stats », alors la bulle affiche « Retrouvez ici votre solde en banque (opérations pointées) pour la période en cours. » et surligne toujours la carte « Solde en banque ».
- [ ] CA3 — Même chose en anglais : l'étape « stats » affiche l'équivalent anglais du texte du CA2 (traduction de Lucas à valider, voir Hypothèses).
- [ ] CA4 — Étant donné la disposition enregistrée de Lucas, après conversion, `stat-bank`, `stat-upcoming` et `stat-income` sont en largeur 4.
- [ ] CA5 — Étant donné cette même disposition, après conversion, l'ordre, la largeur et la visibilité bureau / mobile de tous les autres widgets sont inchangés, ainsi que la visibilité bureau / mobile des 3 cartes ; les ids retirés (`stat-start`, `insights`…) y restent (déjà ignorés à l'affichage).
- [ ] CA6 — Étant donné un utilisateur dont la disposition ne contient pas ces 3 ids, ou qui n'a pas de préférences, quand la conversion s'applique, alors rien ne change pour lui. Rejouer la conversion deux fois donne le même résultat.

## Règle critique
La conversion de la disposition ne touche que la largeur des 3 cartes de solde : aucune autre donnée de la disposition de Lucas (ni celle d'un autre utilisateur) n'est modifiée ni perdue. Testée avant le code (CA5, CA6).

## Mesure d'impact
- Indicateur qui doit bouger : aucun indicateur produit (entretien).
- Équipe qui en profite : Performance (moins de code mort, texte juste).
- Comment on le mesure : le fichier de code mort n'existe plus ; la disposition en prod est conforme (requête de contrôle sur `user_preferences` après migration : 3 cartes en largeur 4).

## Exploitation
- Ce qu'on doit pouvoir voir en prod : la requête de contrôle ci-dessus ; la carte « Revenus / Dépenses » pleine largeur dans le tableau de bord de Lucas.
- Retour arrière : revert du commit pour code et textes ; pour les données, remettre la largeur 2 sur les 3 ids (migration inverse, ou copie de la disposition notée avant migration).
- Feature flag : non.

## Parties sensibles
Aucune (la migration de données touche une seule ligne, sans argent ni algorithme).

## Ce qui change dans l'existant
- `docs/preferences.md` : la règle de la disposition par défaut dit « pas de migration de données » ; ce besoin ajoute une migration de données sur les largeurs des 3 cartes de solde. Correction de doc faite par le documentaliste en fin de cycle (hors périmètre ici).
- `docs/tour.md` : le texte de l'étape « stats » change.

## Fichiers concernés
- À supprimer : `frontend/src/shared/lib/percentage.ts` — code mort (seul importeur : son test)
- À supprimer : `frontend/src/shared/lib/percentage.test.ts` — test du code mort
- À modifier : `frontend/messages/fr.json` (ligne 487, clé `Tour.dashboard.stats`) — nouveau texte
- À modifier : `frontend/messages/en.json` (ligne 487, même clé) — équivalent anglais
- À créer : `supabase/migrations/<horodatage après 20261101100500>_widen_balance_cards.sql` — conversion de la disposition (le projet gère ses données de prod par migrations Supabase, comme `20261101100400_repair_lost_accents_descriptions.sql`)
- Tests : vérification de la migration sur une disposition type (CA5, CA6) ; la forme du test est laissée au développeur. Lecture seule, sans changement : `frontend/src/features/tour/config/dashboard-tour.ts:11` (cible `stats`), `frontend/src/features/preferences/config/dashboard-widgets.tsx:18-22`.
- Ne pas confondre : `functions/src/shared/domain/percentage.spec.ts` (back, utilisé) reste en place.

## Hors périmètre
- Changer la cible de l'étape « stats » (Lucas veut adapter le texte, pas la cible).
- Libellés « Intérets », prévisionnel (continue de compter les factures en attente), correction de la doc (documentaliste).
- Largeur des cartes pour d'autres utilisateurs : en prod, seule la ligne de Lucas existe.
- Nettoyage des ids retirés dans sa disposition (déjà ignorés).

## Hypothèses
- Traduction anglaise validée par Lucas : « Find your bank balance (reconciled transactions) for the current period. »
- « Opérations pointées » = transactions pointées (sens métier de `stat-bank`, non revérifié ici).
- La migration cible les 3 ids quelle que soit leur largeur actuelle (pas seulement 2), pour que le résultat final soit le même.
- Seule la prod est visée ; un environnement local sans la ligne de Lucas n'est pas modifié.

## Points ouverts
Aucun.
