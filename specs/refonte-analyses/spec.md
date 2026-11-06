# Analyses sur un seul écran à onglets (refonte, cycle 4 sur 7)

## Le problème
Pour analyser ses comptes, Lucas ouvre trois pages (Évolution, Flux, Dépassements) reliées par des onglets de navigation. Chaque changement recharge une page, et les dépassements se lisent catégorie par catégorie. Maquette : `specs/refonte-interface/maquette/Analyses.dc.html`.

## Critères d'acceptation
- [ ] CA1 — Étant donné Lucas connecté, quand il ouvre Analyses (menu, F4, barre du bas mobile, palette Ctrl/Cmd + K), alors il arrive sur un seul écran à trois onglets (Répartition, Évolution, Dépassements) ; changer d'onglet ne recharge pas la page ; le titre du header est « Analyses ».
- [ ] CA2 — Étant donné un lien ou un favori vers `/evolution`, `/flux` ou `/depassements` (avec ou sans `/fr`, `/en`), quand Lucas l'ouvre, alors il voit ce même écran ouvert sur l'onglet correspondant (Évolution, Répartition, Dépassements), l'entrée Analyses allumée et le titre « Analyses ».
- [ ] CA3 — Étant donné au moins deux périodes fermées, quand Lucas ouvre Répartition, alors la dernière période fermée est comparée à la précédente (la période active n'est jamais choisie par défaut) : total dépensé, puis par catégorie le montant et l'écart avec la période de comparaison selon la règle « Comparaison » de `docs/reporting.md` (flèche ↗/↘, signe, « Nouveau » si la comparaison vaut 0). Il peut changer la période affichée et la période de comparaison.
- [ ] CA4 — Étant donné une seule période fermée, quand Lucas ouvre Répartition, alors les montants s'affichent avec « première période disponible » et aucun écart ; étant donné aucune période fermée, alors un message l'explique, sans erreur ni tableau vide.
- [ ] CA5 — Étant donné des périodes fermées, quand Lucas ouvre Évolution, alors il voit (a) une barre par période fermée avec le total des dépenses (pas de découpage fixes / variables, décision de Lucas), (b) pour une catégorie de dépense ou d'épargne qu'il choisit, son réel par période fermée face à son budget, avec la marque « dépassement » quand l'onglet Dépassements en compte un, `pending` exclues dans les deux, (c) l'évolution du solde en banque. Le graphique « revenus face aux dépenses » n'existe plus.
- [ ] CA6 — Étant donné des périodes fermées, quand Lucas ouvre Dépassements, alors un tableau catégories × périodes fermées donne l'excédent de chaque case (« — » s'il n'y en a pas) et un total par catégorie ; il reprend la règle « Dépassement d'une catégorie » de `docs/reporting.md` : `pending` exclues, période active absente. La liste par période et le graphique catégorie par catégorie disparaissent.
- [ ] CA7 — Étant donné une catégorie du tableau Dépassements, quand Lucas la sélectionne, alors Opérations s'ouvre filtré sur cette catégorie, toutes périodes (`operationsHref` avec `categoryId` et `allPeriods`).
- [ ] CA8 — Étant donné chaque graphique et le tableau, alors une légende dit ce que représentent les barres, courbes et repères ; aucune information ne passe par la seule couleur (valeurs écrites, libellé ou marque « dépassement », flèche et signe) ; textes en fr et en ; lisible en clair et en sombre (jetons de `globals.css`, plus de couleurs en dur) ; sur mobile (390 px) tableaux défilant horizontalement, cibles tactiles d'au moins 44 px, textes d'au moins 12 px.

## Règle critique
Le tableau Dépassements : chaque case est l'excédent calculé par le back (règle existante, `pending` exclues, périodes fermées seulement), jamais recalculé ni arrondi côté front ; case absente = « — » ; total d'une catégorie = somme exacte en centimes entiers (bigint) de ses cases ; une période fermée sans aucun dépassement garde sa colonne. Testée avant le code (fonction pure qui construit la grille), avec les cas : aucun dépassement, un seul, catégorie dépassant une période sur deux, totaux. Deuxième test écrit avant le code : choix par défaut des périodes de Répartition (0, 1, 2 et plus de périodes fermées ; active ignorée).

## Mesure d'impact
- Indicateur qui doit bouger : nombre de pages à ouvrir pour une analyse, de 3 (Évolution, Flux, Dépassements) à 1.
- Équipe qui en profite : Performance (moins de navigation).
- Comment on le mesure : par vérification (écran lancé), sans suivi ajouté (décision de Lucas).

## Exploitation
- Aucune route back ajoutée ; un champ `real` s'ajoute à chaque point de `GET /reporting/overruns-chart` (ajout compatible). Les journaux existants `overruns_report_built` et `overruns_chart_built` continuent d'être émis.
- Retour arrière : revert des commits locaux (les anciennes adresses restent servies) ; le champ ajouté est inoffensif s'il reste.
- Feature flag : non (commits locaux, pas de mise en production avant la fin de la refonte).

## Parties sensibles
Aucune. Fixes/variables est écarté (pas de donnée ni de calcul nouveau). L'ajout de `real` à `overruns-chart` n'est pas sensible selon `point-de-controle` : il expose, sans le recalculer, le réel que la fonction pure existante `computeOverrunsForPeriod` (`category-overrun.ts:50-76`, règle « Réel d'un dépassement ») produit déjà et que `loadPeriodOverruns` renvoie dans chaque entrée ; pas de nouvelle règle, de nouvel arrondi, de nouvelle route, table ou module, aucune concurrence. Un test sur le champ suffit (`overruns.use-cases.spec.ts`).

## Ce qui change dans l'existant
- `docs/navigation.md` : entrée Analyses et F4 pointent vers la nouvelle adresse (plus `/evolution`) ; bottom-nav idem ; Flux et Dépassements ne sont plus des pages rattachées avec titre propre (titre « Analyses », y compris sur les anciennes adresses) ni des onglets de `SectionTabs` (qui ne sert plus qu'aux Échéances) ; palette : Flux et Dépassements disparaissent du groupe Navigation ; la règle critique « aucune page ne devient inaccessible » (table de `nav-accessibility.test.ts`) : Flux et Dépassements sont atteints par un onglet de l'écran, plus par un onglet de pages. La règle « Aucune redirection dans ce dossier » reste vraie (les anciennes adresses affichent l'écran, sans `redirect`).
- `docs/reporting.md` : la page `/depassements` (graphique d'une catégorie, liste par période), l'écran Flux (comparaison seule) et l'écran Évolution (trois graphiques dont revenus face aux dépenses) sont remplacés. La route back `overruns-chart` reste appelée (réel et budget de la catégorie choisie) et gagne le champ `real` ; la règle « Graphique d'une catégorie » le mentionnera. Aucune règle de calcul modifiée.

## Chemins d'exposition
Pas de règle de visibilité ni de droit nouveaux. Les routes back sont déjà sous `SupabaseAuthGuard` et le contrôle de propriété du compte (`docs/reporting.md`) ; l'écran n'en crée pas. Côté front, le groupe `(dashboard)` est derrière le middleware de session (`docs/navigation.md`) : la nouvelle adresse et les trois anciennes l'exigent aussi.

## Fichiers concernés
Vérifiés par Glob/Grep. Le schéma n'est pas touché (aucune migration).
- À modifier : `frontend/src/shared/ui/layout/nav-config.ts` — entrée Analyses (href, F4), table `ROUTES` (nouvelle route + trois anciennes rattachées à Analyses, titre `analysis`), retrait des onglets d'Analyses et de Flux/Dépassements de `ATTACHED_PAGES`
- À modifier : `frontend/src/shared/ui/layout/section-tabs.tsx` — ne sert plus qu'aux Échéances (type de `entry`)
- À modifier : `frontend/src/shared/ui/layout/bottom-nav.tsx` (ligne 15) — href Analyses
- À modifier : `frontend/src/app/[locale]/(dashboard)/evolution/page.tsx`, `flux/page.tsx`, `depassements/page.tsx` — affichent le nouvel écran sur leur onglet, sans `redirect`
- À créer : `frontend/src/app/[locale]/(dashboard)/analyses/page.tsx` (nom de route : hypothèse) — l'écran à onglets (Glob : n'existe pas)
- À créer : composants dans `frontend/src/features/reporting/ui/` (écran à onglets, onglets Répartition, Évolution, Dépassements) et `frontend/src/features/reporting/model/` (grille des dépassements, choix par défaut des périodes de Répartition)
- À modifier : `frontend/src/features/reporting/ui/period-comparison.tsx` (reprise de `ComparisonGap` et de la règle d'écart pour Répartition), `evolution-chart.tsx` (remplacé ou réécrit)
- À modifier (back) : `functions/src/reporting/application/get-category-overruns-chart.use-case.ts` (interface `CategoryOverrunChartPoint`, lignes 14-20 et 96-102) — ajouter `real` (chaîne de centimes signés, `(entry?.real ?? 0n).toString()`, depuis l'entrée déjà calculée)
- À modifier (back, test) : `functions/src/reporting/application/overruns.use-cases.spec.ts` — le point du graphique porte `real`, `pending` exclues, 0 sans transaction
- À modifier (front) : `frontend/src/features/reporting/model/types.ts` (`CategoryOverrunChartPoint`, champ `real`) ; `api/use-overruns.ts` (`useCategoryOverrunsChart` est réutilisé tel quel ; période de début = première fermée, de fin = dernière fermée)
- Source du total des dépenses : `GET /reporting/evolution` via `api/use-evolution.ts` (existant, champ `realExpenses`, valeur absolue pour la barre) ; aucun nouveau calcul ni nouvelle route
- À supprimer si plus utilisés (Grep avant) : `ui/evolution/category-filter-sidebar.tsx`, `ui/evolution/evolution-tooltip.tsx`, `ui/overruns-by-period.tsx`, `ui/category-overruns-chart.tsx`, `model/overruns-range.ts` (`useCategoryOverrunsChart` et `use-overruns.ts` restent)
- À modifier : `frontend/messages/fr.json`, `frontend/messages/en.json` — libellés (espaces `Navigation`, `Reporting`)
- Tests à modifier : `frontend/src/shared/ui/layout/nav-accessibility.test.ts` (table des pages, lignes 13-15 et 62-63), `sidebar.test.tsx` (lignes 27, 47, 70-71), `header-title.test.ts` (lignes 17, 25-26, 36), `bottom-nav.test.tsx` (ligne 42), `period-comparison.test.tsx`, `evolution-chart.test.tsx`, `overruns-by-period.test.tsx`, `category-overruns-chart.test.tsx`, `overruns-range.test.ts`, `features/tour/config/tour-ui.test.ts` (ligne 77 : la cible `data-tour="evolution"` disparaît avec `evolution-chart.tsx`, la visite ne l'utilise pas)
- Tests à créer : modèle de la grille des dépassements, choix par défaut de Répartition, écran à onglets (pas de navigation entre onglets, anciennes adresses)
- Vérification réelle : `http/depassements-par-periode.http` (existant, alimente les données ; ajouter l'assertion du champ `real` sur `overruns-chart`, lignes 246-262) ; écran à voir à 1440 et 390 px, clair et sombre, fr et en
- À mettre à jour ensuite : `docs/navigation.md`, `docs/reporting.md` (documentaliste)

## Hors périmètre
- Statistiques par tags et patrimoine net : supprimés au cycle 2, ils ne reviennent pas.
- Cycles 5 à 7 ; suppression des routes `/evolution`, `/flux`, `/depassements` (cycle 7) ; nettoyage de la bottom-nav.
- Back : aucune modification de règle de calcul, hormis le champ `real` ajouté à `overruns-chart` ; `realIncome` / `realExpenses` de l'évolution restent dans la réponse (`realExpenses` alimente maintenant la barre du total).
- Fixes / variables : aucun découpage. Note pour le cycle 5 : aucune donnée ne distingue fixes et variables (ni marque sur la catégorie, ni `is_fixed` lu, `docs/budgets.md`) ; le cycle 5 devra composer avec cette absence, ou la créer lui-même (décision et conception à part).
- Push, release, `db push`.

## Hypothèses
- Nouvelle adresse `/analyses` (Lucas n'a pas donné de nom). Onglet gardé dans l'état de l'écran, pas dans l'adresse ; seules les trois anciennes adresses ouvrent un onglet précis.
- Répartition : « dépensé » = catégories de dépense et d'épargne de la réponse de comparaison (comme les « dépenses réelles » de `docs/reporting.md`) ; les revenus ne figurent pas dans la maquette. Les choix de période proposent les périodes fermées et la période active (libellée « en cours »), comme l'ancien Flux ; seul le défaut l'exclut. Avec une seule période fermée, l'appel de comparaison (qui exige `compareWith`) se fait avec la même période et l'écart n'est pas affiché.
- Total des dépenses par période : `realExpenses` de `get-evolution` (`get-evolution.use-case.ts:80-97`) = somme signée, par période, des transactions de toutes les catégories hors revenus et virements, donc dépense et épargne, remboursements nets, **`pending` comprises**, transactions sans catégorie exclues. La barre affiche sa valeur absolue ; rien n'est recalculé côté front. Écart avec la barre de la catégorie choisie : celle-ci vient de `overruns-chart` (`real`, `pending` exclues), donc la barre d'une catégorie peut être plus petite que sa part réelle dans le total ; la légende le dit (« total : factures en attente comprises » / « catégorie : exclues »). Même écart déjà assumé entre Dépassements et À traiter (`docs/reporting.md`).
- Réel de la catégorie choisie : celui des dépassements (`real` ajouté à `overruns-chart`, règle « Réel d'un dépassement », `pending` exclues), un seul calcul avec le tableau Dépassements ; valeur absolue pour la barre, face au budget (`budget`) du même point ; marque « dépassement » si `overrun` > 0. Décision de Lucas (besoin.md, après la mini-spec).
- Évolution et solde en banque : périodes fermées seulement, comme l'écran actuel (`evolution-chart.tsx:39-42`) ; choix de catégorie : dépense et épargne (types des dépassements). Le solde en banque garde sa règle (départ + transactions rapprochées).
- Dépassements : tableau limité aux périodes fermées renvoyées par `GET /reporting/overruns`, sans changer le back ; lignes = catégories ayant au moins un dépassement ; au plus les 6 dernières périodes (maquette), défilement horizontal au-delà de la largeur. Écart assumé avec À traiter (période active, `pending` comprises) : repris tel quel de `docs/reporting.md`, signalé par la phrase « les factures en attente sont exclues » de la maquette.
- Lien d'une catégorie vers Opérations : toutes périodes et `pending` visibles (la liste peut donc contenir plus que le dépassement), car Opérations ne sait filtrer qu'une période déjà choisie ou « toutes » (`operations-link.ts`). À confirmer à l'écran par le développeur.
- La ligne « Budget 2 410 € » de la maquette (budget total par période) est omise : le back ne renvoie pas le budget total par période.

## Décisions de Lucas
- Total des dépenses : il garde les factures en attente, la légende le dit.
- Adresse : `/analyses`.
