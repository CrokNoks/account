# Visite guidée — présente à l'utilisateur les écrans clés pas à pas (front uniquement)

Mise à jour : 2026-11-02 · Commit : voir historique git (fix(tour))

Code : `frontend/src/features/tour/config/`, moteur `frontend/src/shared/ui/tour/AppTour.tsx` (monté une fois dans `app/[locale]/providers/query-provider.tsx:31`), état `frontend/src/shared/model/use-ui-store.ts`, textes `frontend/messages/{fr,en}.json` (espace `Tour`). Aucun code back ni base.

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Tour | Une visite guidée : `dashboard`, `account` ou `transactions`. |
| Étape | Une bulle d'explication accrochée à un élément repéré par `data-tour="…"`. |
| react-joyride | Bibliothèque qui affiche les bulles. |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| 3 visites : tableau de bord (5 étapes : accueil, stats, répartition, transactions, bouton « + » d'ajout ; l'étape « évolution » est retirée, son élément n'existe que sur la page Évolution), compte (7 étapes : accueil, bouton de création, nom, solde, catégories, récurrentes, périodes), transactions (5 étapes dans le tiroir de création : date, description, montant, en attente, raccourcis). | `features/tour/config/dashboard-tour.ts`, `account-tour.ts`, `transactions-tour.ts` | ✅ `tour-ui.test.ts` (chaque cible existe dans le code ; pas d'étape évolution), `dashboard-tour.test.ts` (étape « stats ») |
| Étape « stats » du tableau de bord : texte fr « Retrouvez ici votre solde en banque (opérations pointées) pour la période en cours. », en « Find your bank balance (reconciled transactions) for the current period. » ; elle vise `[data-tour="stats"]`, posé sur la carte « Solde en banque » (widget `stat-bank`), les deux autres cartes de solde n'étant pas ciblées | `frontend/messages/fr.json:487`, `en.json` (`Tour.dashboard.stats`), `features/tour/config/dashboard-tour.ts:10-14`, `features/preferences/config/dashboard-widgets.tsx:18-22` | ✅ `features/tour/config/dashboard-tour.test.ts` (texte fr et en de l'étape ; la cible n'est pas vérifiée) |
| Éléments ciblés (`data-tour`) : `stats`, `budget-breakdown`, `transaction-list` (widgets du tableau de bord, `dashboard-widgets.tsx`), `add-transaction` (bouton « + » du widget Transactions, mode compact de `transaction-list.tsx`), `add-account-btn` (`create-account-dialog.tsx`), `account-name`, `account-balance` (`account-form.tsx`), `nav-categories`, `nav-recurring`, `nav-budgets` (`sidebar.tsx`), `tx-date`, `tx-description`, `tx-amount`, `tx-pending` (`transaction-form.tsx`), `tx-shortcuts` (rappel du raccourci dans `create-transaction-drawer.tsx`, masqué sur mobile). `evolution` (`evolution-chart.tsx`) n'est visé par aucune visite. | `features/tour/config/tour-ui.test.ts` | ✅ |
| Les textes viennent de la traduction `Tour.*` (aucun texte en dur dans les étapes ; boutons Retour/Fermer/Terminer/Suivant/Passer pris dans `Common`). | `AppTour.tsx:14-15,101-107`, `features/tour/config/*.ts` | ❌ |
| Visite « compte » (numéros d'étape à partir de 0) : en quittant l'étape 1 (bouton de création) vers l'avant, on ouvre la fenêtre de création de compte, avec 500 ms de délai avant d'afficher l'étape suivante ; en revenant de l'étape 2 vers l'arrière, on la ferme ; en quittant l'étape 4 vers l'avant (dernière du dialogue), on la ferme ; en revenant de l'étape 5 vers l'arrière, on la rouvre (500 ms de délai aussi). | `AppTour.tsx:40-59,66-75` | ❌ |
| Si une cible est introuvable (widget masqué dans les préférences, élément masqué sur mobile), l'étape est sautée automatiquement (suivante, ou précédente en reculant) ; au-delà de la dernière, la visite se termine. Exceptions : elles attendent l'ouverture d'un panneau, avec un avertissement console « Tour target not found, waiting... » : visite « compte » aux étapes 2 et 4 (formulaire de création), visite « transactions » à l'étape 0 (tiroir). | `AppTour.tsx`, `features/tour/config/tour-flow.ts` | ✅ `tour-flow.test.ts` |
| Boutons de la bulle : libellés tirés de `Common` ; « Suivant » avec progression via `Tour.next_with_progress` (fr « Suivant (étape {step} sur {steps}) »). Couleurs en `var(--primary)` (variables en oklch, pas de `hsl()`). | `features/tour/config/tour-ui.ts` | ✅ `tour-ui.test.ts` |
| Visite « transactions » : au démarrage (`AppTour`), le tiroir de création s'ouvre, la visite démarre 500 ms plus tard ; fin ou « Passer » ferment le tiroir. | `AppTour.tsx` | ❌ vérifiée dans le navigateur (2026-11-01) |
| Fin ou abandon (bouton « Passer ») d'une visite : elle est marquée terminée (`completedTours[nom] = true`) et la visite active repasse à « aucune ». `stopTour` (fin de parcours Joyride, `TOUR_END`) remet la visite à « aucune » sans la marquer terminée. | `AppTour.tsx:61-62,83-84`, `use-ui-store.ts:58-69` | ✅ `shared/model/stores.test.ts` (« marks a tour as completed and stops it », « stopping a tour does not mark it as completed ») |
| Seul `completedTours` est conservé dans le navigateur (clé `ui-storage`) ; l'état d'avancement ne l'est pas. | `use-ui-store.ts:72-75` | ✅ `shared/model/stores.test.ts` (« persists completed tours in localStorage and can reset them ») |
| Lancement automatique : la visite « compte » démarre 1 s après l'affichage de la page Comptes si elle n'est pas terminée ; la visite « tableau de bord » démarre 1 s après l'affichage du tableau de bord si elle n'est pas terminée **et** que la visite « compte » l'est. La visite « transactions » démarre 1 s après l'affichage de la page Transactions si « tableau de bord » est terminée et « transactions » ne l'est pas. Le bouton d'aide (`HelpButton`) relance une visite à la demande ; il est placé sur le tableau de bord (`tour="dashboard"`), la page Comptes (`tour="account"`) et la page Transactions (`tour="transactions"`) | `app/[locale]/(dashboard)/page.tsx:145-151,161`, `accounts/page.tsx:15-21,29`, `transactions/page.tsx` | ❌ |

Tests : `dashboard-tour.test.ts`, `tour-ui.test.ts`, `tour-flow.test.ts` et `shared/model/stores.test.ts` (état des visites) ; le composant `AppTour.tsx` n'est pas testé.

## Ce qu'on stocke
Rien en base. `completedTours` (nom de visite → vrai) dans le stockage local du navigateur ; donc propre à un navigateur, pas à un compte utilisateur.

## Ce qu'on peut faire
| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Lancer la visite du tableau de bord | `startTour('dashboard')` | tout utilisateur de l'écran | démarre | `app/[locale]/(dashboard)/page.tsx:147` |
| Lancer la visite des comptes | `startTour('account')` | idem | démarre | `app/[locale]/(dashboard)/accounts/page.tsx:17` |
| Lancer une visite à la demande | bouton d'aide | idem | démarre la visite choisie à l'étape voulue | `shared/ui/tour/HelpButton.tsx:27` (boutons : `page.tsx:161`, `accounts/page.tsx:29`) |

## Statuts et transitions
`activeTour` : none → dashboard / account / transactions → none (fin, abandon ou `stopTour`). `resetTours` existe pour tout remettre à zéro (`use-ui-store.ts:70`) ; aucun écran ne l'appelle (seul le test de la boutique).

## Zones d'ombre
- Aucune connue à ce jour. Les vérifications dans le navigateur (parcours complet des 3 visites en français, widget masqué, mobile) ont été faites le 2026-11-01, sans fichier `.http` (pas de route HTTP pour la visite).
