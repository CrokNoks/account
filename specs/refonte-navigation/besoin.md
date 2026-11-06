# Besoin

Refonte interface, cycle 1 sur 7 : nouvelle coque de navigation à 5 entrées (Aujourd'hui, Opérations, Analyses, Budgets, Échéances) plus Réglages, et jetons visuels de la maquette.

Plan : `specs/refonte-interface/plan.md`. Maquette : `specs/refonte-interface/maquette/`.

Consigne de Lucas pour tout le plan : tout reste en local, commits sans push, sans release ni db push.

Base du cycle : `4a44004`.

## Réponses de Lucas

- Transition : Analyses ouvre Évolution, avec des onglets vers Flux et Dépassements. Échéances ouvre Calendrier, avec un onglet vers Prévisions. Rien ne devient inaccessible.
- Réglages : une page liste Comptes, Catégories, Tags, Règles et Récurrences, avec une ligne d'explication. La visite guidée « compte » pointe l'entrée Réglages, avec un texte adapté.
- Impact : clics vers les écrans clés. Transactions passe de la 13e à la 2e entrée du menu, et le menu de 13 à 6 entrées. Mesure par comptage, sans suivi ajouté.

- Release : aucune tant que toute la refonte n'est pas terminée, front et back.

## Hypothèse annoncée à Lucas

Les jetons visuels s'appliquent à toute l'application via les variables du thème, sans retoucher les pages une par une.

## Zones d'ombre de la doc (`docs/navigation.md`)

- Correspondance des entrées : Aujourd'hui = `/`, Opérations = `/transactions`, Analyses = `/evolution` (onglets `/flux`, `/depassements`), Budgets = `/budgets`, Échéances = `/calendar` (onglet `/cashflow`), Réglages = nouvelle page.
- Raccourcis F2-F6 : hypothèse à valider dans la spec, ils suivent les 5 entrées du menu dans l'ordre.
- Valeurs des jetons : celles de `specs/refonte-interface/maquette/` (classes `.t-light` et `.t-dark`).
- La barre du bas mobile reste à revoir au cycle 7 ; dans ce cycle, elle suit au minimum les nouveaux noms.
