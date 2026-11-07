# Écran Échéances : courbe, point bas, calendrier, liste

Cycle 6 sur 7 de la refonte. Maquette : `specs/refonte-interface/maquette/Echeances.dc.html`. Commits locaux, sans push, release ni db push.

## Le problème
Avant une grosse dépense, il faut ouvrir deux pages (Calendrier, Prévisions) pour savoir si le compte tiendra. Aucune ne dit le jour où le solde est au plus bas, et la trésorerie compte deux fois une récurrence déjà payée le jour même. Le bloc Factures d'Aujourd'hui affiche un total qui ne porte que sur 5 lignes, sans le dire.

## Critères d'acceptation
- [ ] CA1 — Un seul écran. Étant donné l'entrée « Échéances » (menu, F6, palette), quand je l'ouvre, alors la courbe, le point bas, le calendrier et la liste sont sur la même page, sans onglets. L'écran a sa propre adresse (`/echeances`, hypothèse). Les anciennes adresses `/calendar` et `/cashflow` affichent le même écran sans redirection (comme `/flux` pour Analyses) et gardent l'entrée Échéances active. Titre « Échéances » (fr) / « Due dates » (en) partout. Le menu, F6 et la palette pointent vers la nouvelle adresse, « Prévisions » disparaît de la palette, `SectionTabs` est supprimé.
- [ ] CA2 — Horizon. Étant donné la courbe, quand je choisis 30, 60 ou 90 jours (30 par défaut, choix visible sans la couleur seule), alors elle va d'aujourd'hui à aujourd'hui + l'horizon, et le point bas est celui de cet horizon, sans changer de page.
- [ ] CA3 — Point bas. Le titre de la courbe dit « Point bas : {montant} le {date} ». C'est le plus bas des soldes de fin de journée (aujourd'hui compris) ; si plusieurs jours sont au même minimum, c'est le premier. Il est marqué sur la courbe et écrit. Le montant vient du back, le front ne le recalcule pas. Sous le titre : « Solde du jour et récurrences uniquement, dépenses courantes non comprises. »
- [ ] CA4 — Écart assumé. Étant donné que le prévu d'Aujourd'hui et le point bas peuvent différer, quand je lis le point bas, alors une phrase dit que ce n'est pas le prévu de fin de période : le prévu tient compte des budgets restants, des factures à venir et des revenus attendus ; le point bas, du solde du jour et des seules récurrences. Le même endroit dit aussi (réponse de Lucas) qu'une facture à venir sans récurrence correspondante n'est pas dans la courbe, même si le calendrier et la liste l'affichent.
- [ ] CA5 — Récurrence déjà payée. Étant donné une récurrence due aujourd'hui et une transaction d'aujourd'hui de même montant dont le libellé contient le sien, quand la courbe se calcule, alors elle n'est comptée qu'une fois (dans le solde du jour), donc ni dans la courbe ni dans le point bas en double. Le calendrier ne change pas.
- [ ] CA6 — Calendrier conservé, style de la maquette. Mois au choix (précédent, suivant, aujourd'hui, passé compris), vue semaine, détail du jour au clic. Une semaine à cheval sur deux mois montre les échéances des deux. Réel et prévu se distinguent par le trait (plein ou pointillé) et par un libellé « Réel » / « Prévue » dans le détail, pas par la couleur seule ; les montants portent toujours leur signe. Une légende (réel, prévue, aujourd'hui, point bas) est visible.
- [ ] CA7 — Liste « À venir en {mois} ». Étant donné le mois affiché, la liste donne les échéances d'aujourd'hui et des jours suivants de ce mois, par date : libellé, date, état (« Facture en attente » pour une transaction `pending`, « Prévue » pour une récurrence), montant signé. Un lien « Gérer les récurrences » ouvre `/recurring`. Mois sans rien à venir : message.
- [ ] CA8 — États et lisibilité. Sans récurrence : la courbe reste au solde du jour avec un message et un lien vers les récurrences, le calendrier montre le réel. Sans compte : message qui demande d'en choisir un. Erreur de chargement : message par bloc (courbe, calendrier et liste), les autres blocs restent utilisables. Textes en fr et en, clair et sombre, bureau (1440 px) et mobile (390 px), cibles de 44 px, jetons de `globals.css`.

Aussi dans le cycle (comportement du bloc Factures d'Aujourd'hui, reporté du cycle 2) : le total est libellé « Total des {n} échéances affichées » ; s'il y en a plus de 5 dans les 7 jours, la ligne ajoute « {k} autres non comprises ». Le bloc couvre bien les 7 jours à venir même quand la fenêtre déborde sur le mois suivant (ex. le 28, il montre aussi les échéances du 1er au 4 du mois suivant ; le « {k} autres » les compte aussi). Un échec de lecture du mois suivant ne doit pas masquer les échéances du mois en cours. Testé dans `upcoming-deadlines-widget.test.tsx` (date fixée au 28, échéance le 2 du mois suivant ; cas de fin d'année).

## Règle critique
Une récurrence déjà payée le jour même n'est comptée qu'une fois dans la trésorerie, avec la même règle que le calendrier.

Code actuel, à reprendre exactement :
- Calendrier (`get-calendar-data.use-case.ts:61,69-76`) : projette aujourd'hui et les jours futurs du mois affiché (`day >= today`). Une récurrence est écartée si une transaction du même jour (`getTime()` égal) a le même montant et un libellé qui contient le sien (minuscules). Aucun filtre sur le statut (`pending`, rapprochée ou non) ni sur la catégorie. Jours passés : aucune projection.
- Trésorerie (`get-cashflow-forecast.use-case.ts:56-77`) : compte toutes les récurrences d'aujourd'hui à aujourd'hui + `days`, même payées.

Règle partagée : un seul prédicat « déjà payée » (même jour, même montant, libellé contenu, sans tenir compte de la casse), utilisé par les deux cas d'usage. Dans la courbe elle s'applique à aujourd'hui seulement, et c'est le seul jour qu'elle peut couvrir : le solde du jour ne contient que les transactions jusqu'à aujourd'hui inclus (`:38-45`). Pour un jour futur, la transaction n'est pas dans le solde ; écarter la récurrence ferait disparaître le montant de la courbe. Le calendrier garde aujourd'hui et les jours futurs.

Double compte avec une facture `pending` (vérifié dans le code) :
- `pending` datée demain ou plus tard, et sa récurrence : comptée une fois dans la courbe. Le solde du jour l'exclut par la date (`sum_transactions_before_date` ne filtre que la date, pas `pending`), la récurrence l'ajoute (`:69`). Calendrier : une fois aussi, la `pending` est affichée et la récurrence écartée (`:69-76`), si le montant et le libellé correspondent.
- `pending` datée aujourd'hui ou avant : déjà dans le solde du jour. Si sa récurrence est due aujourd'hui, c'est le double compte actuel, corrigé par CA5.
- Omission assumée (réponse de Lucas) : une `pending` future sans récurrence correspondante (ou d'un autre montant) reste absente de la courbe, alors que le calendrier et la liste l'affichent. Pas de nouvelle règle d'argent ; l'écran le dit (CA4).

## Mesure d'impact
- Indicateur qui doit bouger : pages à ouvrir pour juger une grosse dépense (2 aujourd'hui, 1 après).
- Équipe qui en profite : Performance.
- Comment on le mesure : par vérification de l'écran lancé, sans suivi ajouté (réponse de Lucas).

## Exploitation
- À voir en prod : un journal `cashflow_forecast_built` sur la trésorerie (compte, horizon, nombre de récurrences, nombre écartées comme déjà payées ; ni montant ni libellé), comme les autres `*_built` de `reporting`.
- Retour arrière : revert des commits locaux ; aucune donnée ni migration, la route `cashflow` ne gagne qu'un champ, les anciennes adresses restent servies.
- Feature flag : non.

## Parties sensibles
- Prédicat « récurrence déjà payée », partagé trésorerie et calendrier — calcul qui touche l'argent, règle partagée par deux cas d'usage.
- Point bas (plus bas solde de fin de journée, premier jour en cas d'égalité) — calcul qui touche l'argent.
Une seule conception (`specs/refonte-echeances/conception.md`) et un seul contrôle. Tests écrits avant le code : (a) déjà payée aujourd'hui comptée une fois ; (b) non payée comptée ; (c) autre montant ou libellé non contenu, comptée ; (d) jour futur : pas écartée dans la courbe ; (e) non-régression du calendrier (spec existant « not project already paid » et un cas `pending` future écartée) ; (f) point bas : plusieurs événements le même jour (solde de fin de journée, pas un solde intermédiaire), égalité, aucun événement, premier jour = aujourd'hui, solde négatif ; (g) même prédicat appelé par les deux cas d'usage.

## Ce qui change dans l'existant
- Change la règle « Trésorerie prévue » de `docs/reporting.md` (« Même si elle a déjà été payée aujourd'hui, elle est comptée ») : désormais écartée si déjà payée aujourd'hui. La règle « Calendrier d'un mois » ne change pas, son prédicat devient partagé. La réponse de `cashflow` gagne `lowPoint` (date, solde) ; la réponse de `calendar` gagne `pending` pour afficher « Facture en attente ».
- `docs/navigation.md` : entrées et F6 (`/echeances`), entrée active et titres (`/calendar`, `/cashflow` ; « Prévisions » disparaît), onglets `SectionTabs` supprimés, palette sans Prévisions, règle « aucune page inaccessible » (anciennes adresses d'Échéances servies jusqu'au cycle 7, comme Analyses). Bottom-nav : aucun changement, elle n'a pas d'entrée Échéances (`bottom-nav.tsx:12-16`).
- `docs/reporting.md` : bloc Factures (libellé du total), écran Échéances, `recurring.md` (jour du mois : inchangé).

## Fichiers concernés
Back (`functions/`) :
- Créer : `src/reporting/domain/recurring-already-paid.ts` + `.spec.ts` — prédicat partagé
- Créer : `src/reporting/domain/cashflow-low-point.ts` + `.spec.ts` — point bas
- Modifier : `src/reporting/application/get-cashflow-forecast.use-case.ts` — prédicat à aujourd'hui, `lowPoint`, journal ; `get-cashflow-forecast.use-case.spec.ts`
- Modifier : `src/reporting/application/get-calendar-data.use-case.ts` — prédicat partagé, champ `pending` ; `get-calendar-data.use-case.spec.ts`
- Modifier : `test/front-contract.e2e-spec.ts` (bloc `cashflow forecast`, `lowPoint`)
- Créer : `http/echeances.http` (httpYac, trésorerie et calendrier) — aucun `.http` existant pour ces routes
Front (`frontend/src/`) :
- Créer : `app/[locale]/(dashboard)/echeances/page.tsx`, `features/reporting/ui/echeances-screen.tsx` (+ test), blocs de courbe et de liste
- Modifier : `app/[locale]/(dashboard)/calendar/page.tsx`, `cashflow/page.tsx` — affichent l'écran, sans redirection
- Modifier : `features/reporting/ui/financial-calendar.tsx`, `calendar/calendar-grid.tsx`, `calendar-header.tsx`, `calendar-day-detail.tsx` — style maquette, mois voisins, signe
- Remplacer : `features/reporting/ui/cashflow-forecast.tsx` (rend `0` quand la liste d'événements est vide, `data?.events.length &&`)
- Modifier : `features/reporting/ui/upcoming-deadlines-widget.tsx` + `.test.tsx` — libellé du total, « autres non comprises », lecture du mois suivant quand la fenêtre de 7 jours le touche (réutilise `api/use-calendar-data.ts`, sans le modifier)
- Modifier : `features/reporting/model/types.ts`, `api/use-cashflow-forecast.ts` (horizon, `lowPoint`)
- Modifier : `shared/ui/layout/nav-config.ts` (entrée, routes, `TABS`, `ATTACHED_PAGES`), `command-menu.tsx`
- Supprimer : `shared/ui/layout/section-tabs.tsx`
- Tests : `nav-accessibility.test.ts`, `sidebar.test.tsx`, `header-title.test.ts`, `shared/ui/mobile-readability.test.ts`
- Textes : `frontend/messages/fr.json`, `en.json` (`Navigation`, `Reporting.cashflow|calendar|deadlines`, clé `prevision` retirée)
Pas de migration : le schéma est géré par `supabase/migrations/` et rien ne change en base.

## Hors périmètre
Cycle 7 : barre du bas mobile (Échéances n'y est pas aujourd'hui, atteinte par l'adresse ou la palette), suppression des anciennes adresses. Pas de nouvelle route back, pas d'inclusion des budgets ni des dépenses courantes dans la courbe, pas de total sur la liste de l'écran Échéances.

## Hypothèses
- Adresse du nouvel écran `/echeances` (sur le modèle de `/analyses`), non confirmée.
- La courbe et le point bas viennent de `GET /reporting/cashflow?days=` (30, 60, 90 sont dans les bornes 1 à 365) ; `lowPoint` est calculé dans le même cas d'usage, sans nouvelle route.
- Le solde du jour garde sa définition actuelle : toutes les transactions jusqu'à aujourd'hui incluses, `pending` comprises. Il peut donc différer du « solde à venir » d'Aujourd'hui, qui exclut les `pending`.
- « Le jour même » = aujourd'hui (fuseau métier). Le même prédicat peut écarter deux récurrences avec une seule transaction ; comportement actuel du calendrier, conservé.
- Le calendrier lit le mois affiché ; pour une semaine à cheval, le front appelle la route existante pour chacun des deux mois.
- Bloc Factures d'Aujourd'hui : il lit aujourd'hui le seul mois en cours (`upcoming-deadlines-widget.tsx:19-22`) ; la correction se fait côté front par un second appel à la route calendrier existante pour le mois suivant, sans nouvelle route. Le filtre actuel exclut aujourd'hui (`isAfter(date, now)`, `:33`) : comportement conservé, hors correctif.
- Aucun point de cette spec n'est « confirmé par Lucas » au-delà des réponses de `besoin.md`.

## Décisions de Lucas
- « Déjà payée » s'applique à aujourd'hui seulement dans la courbe.
- Adresse : `/echeances`.
- Bloc Factures d'Aujourd'hui : il exclut aujourd'hui, comme actuellement.
