# Dépenses cumulées (onglet Évolution)

## Le problème
Dans Analyses > Évolution, on voit le total dépensé de chaque période fermée, mais pas combien on a dépensé au total depuis N périodes. L'utilisateur additionne à la main. Les barres, la catégorie et le solde en banque couvrent aussi toutes les périodes fermées, sans moyen de réduire la fenêtre.

## Critères d'acceptation
- [ ] CA1 — Étant donné deux périodes fermées avec 100 € dépensés chacune, quand j'ouvre l'onglet Évolution, alors une nouvelle section « dépenses cumulées », placée sous les barres « Total dépensé », montre une courbe : 100 € pour la plus ancienne, 200 € pour la suivante.
- [ ] CA2 — Le cumul de chaque période = somme des montants « Total dépensé » (barres) de la plus ancienne période de la fenêtre jusqu'à cette période. La valeur de chaque point est lisible (étiquette / infobulle) sans calcul.
- [ ] CA3 — Seules les périodes clôturées entrent dans le cumul ; la période active n'apparaît pas.
- [ ] CA4 — Un sélecteur unique en haut de l'onglet propose 3 / 6 / 12 dernières périodes clôturées, 12 par défaut.
- [ ] CA5 — Changer le filtre change la fenêtre de tout l'onglet : barres « Total dépensé », cumul, graphique et tableau de la catégorie choisie, courbe du solde en banque.
- [ ] CA6 — Le cumul repart de zéro à la plus ancienne période de la fenêtre filtrée (avec 3 : le premier point égale le total de cette période seule, pas celui des périodes plus anciennes).
- [ ] CA7 — Avec moins de périodes clôturées que le filtre, toutes celles qui existent sont affichées, sans message ni choix grisé.
- [ ] CA8 — La légende de la section dit que les factures en attente sont comprises (même règle que les barres).

## Règle critique
Le cumul d'une période est la somme exacte (centimes entiers) des montants « Total dépensé » affichés, de la plus ancienne période de la fenêtre filtrée à cette période incluse. Il doit donc rester cohérent avec les barres, quelle que soit la fenêtre. Test écrit avant le code (p1 100, p2 100 → 100, 200 ; fenêtre réduite → cumul repart de 0).

## Mesure d'impact
- Indicateur qui doit bouger : usage, lecture directe du cumul sans recalcul à la main.
- Équipe qui en profite : Performance.
- Comment on le mesure : Lucas a donné « usage » sans indicateur chiffré ; voir Points ouverts.

## Exploitation
- Rien de particulier à voir en prod (affichage seul, aucune écriture).
- Retour arrière : revert du commit front.
- Feature flag : non.

## Parties sensibles
Aucune. Somme de montants déjà calculés (règle `spentAmount` inchangée), sans nouvelle donnée ni accès. Cas limite : c'est de l'argent, mais seulement de l'addition d'affichage ; le test de la règle critique suffit.

## Ce qui change dans l'existant
Complète la ligne « Évolution, total des dépenses par période » de `docs/reporting.md` : l'onglet gagne un filtre 3/6/12 (défaut 12) qui réduit les périodes fermées affichées, là où il affichait toutes les périodes fermées. Aucune règle de calcul contredite. Le sous-titre de l'écran Analyses (`analysisSpan`, 6 périodes) n'est pas modifié (voir Points ouverts).

## Fichiers concernés
- À modifier : `frontend/src/features/reporting/ui/analyses/evolution-tab.tsx` — sélecteur, fenêtre appliquée aux 4 blocs, nouvelle section cumul
- À modifier : `frontend/src/features/reporting/model/analysis-periods.ts` — fenêtre « N dernières périodes fermées » (réutilise `closedPeriodsChronological`) ; le calcul du cumul peut y vivre aussi
- À modifier : `frontend/messages/fr.json`, `frontend/messages/en.json` — clés sous `Reporting.analyses.evolution` (titre, série, légende, sélecteur)
- Tests : `frontend/src/features/reporting/model/analysis-periods.test.ts` (existe : cumul et fenêtre), `frontend/src/features/reporting/ui/analyses-screen.test.tsx` (existe : section, filtre, application à tout l'onglet)
- Doc : `docs/reporting.md` (ligne l.81), tenue par le documentaliste
- Pas de backend : `GET /reporting/evolution` renvoie déjà toutes les périodes (`functions/src/reporting/application/get-evolution.use-case.ts:38-45`) ; pas de schéma ni de migration.

## Hors périmètre
- Cumul par mois calendaire.
- Période active dans le cumul.
- Onglets Répartition et Dépassements (le filtre ne les touche pas).
- Backend / nouvel endpoint.

## Hypothèses
- Le cumul additionne les montants « Total dépensé » des barres : dépense et épargne, `pending` comprises, remboursements nets d'une période comptés 0 (`spentAmount`). Le cumul ne baisse donc jamais. Non confirmé mot pour mot par Lucas (« règle `spentAmount` inchangée » le suggère).
- Le sélecteur unique pour tout l'onglet suit une recommandation que Lucas peut revisiter (`besoin.md`).
- La catégorie choisie garde sa sélection quand le filtre change ; seules ses périodes changent (`first`/`last` de la fenêtre).
- Le sélecteur s'affiche dès qu'il y a au moins une période clôturée ; les états « aucune période » existants restent inchangés.

## Décisions sur les points ouverts (Lucas, go)
- Sous-titre de l'écran Analyses : laissé tel quel (6 périodes, commun aux trois onglets).
- Mesure : aucun indicateur ajouté (appli perso sans analytics).
