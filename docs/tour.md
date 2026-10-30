# Visite guidée — présente à l'utilisateur les écrans clés pas à pas (front uniquement)

Mise à jour : 2026-10-30 · Commit : 157b272

Code : `frontend/src/features/tour/config/`, moteur `frontend/src/shared/ui/tour/AppTour.tsx`, état `frontend/src/shared/model/use-ui-store.ts`. Aucun code back ni base.

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Tour | Une visite guidée : `dashboard`, `account` ou `transactions`. |
| Étape | Une bulle d'explication accrochée à un élément repéré par `data-tour="…"`. |
| react-joyride | Bibliothèque qui affiche les bulles. |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| 3 visites : tableau de bord (6 étapes : accueil, stats, évolution, répartition, transactions, bouton d'ajout), compte (7 étapes : accueil, bouton de création, nom, solde, catégories, récurrentes, périodes ; l'étape « type de compte », qui ne ciblait aucun élément, est retirée), transactions (5 étapes : date, description, montant, en attente, raccourcis). | `features/tour/config/dashboard-tour.ts`, `account-tour.ts`, `transactions-tour.ts` | ❌ |
| Les textes viennent de la traduction `Tour.*` (aucun texte en dur). | `AppTour.tsx:10-12` | ❌ |
| Visite « compte » : après l'étape 1 on ouvre la fenêtre de création de compte (avec 500 ms de délai), on la ferme après l'étape 4, et on la rouvre si l'utilisateur revient en arrière. | `AppTour.tsx:30-62` | ❌ |
| Si une cible est introuvable, la visite n'avance pas et écrit un avertissement dans la console. | `AppTour.tsx:70-74` | ❌ |
| Fin ou abandon d'une visite : elle est marquée terminée (`completedTours[nom] = true`) et la visite active repasse à « aucune ». | `AppTour.tsx:64-66`, `use-ui-store.ts:64-70` | ❌ |
| Seul `completedTours` est conservé dans le navigateur (clé `ui-storage`) ; l'état d'avancement ne l'est pas. | `use-ui-store.ts:73-74` | ❌ |

Aucun test.

## Ce qu'on stocke
Rien en base. `completedTours` (nom de visite → vrai) dans le stockage local du navigateur ; donc propre à un navigateur, pas à un compte utilisateur.

## Ce qu'on peut faire
| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Lancer la visite du tableau de bord | `startTour('dashboard')` | tout utilisateur de l'écran | démarre | `app/[locale]/(dashboard)/page.tsx:140` |
| Lancer la visite des comptes | `startTour('account')` | idem | démarre | `app/[locale]/(dashboard)/accounts/page.tsx:17` |
| Lancer une visite à la demande | bouton d'aide | idem | démarre la visite choisie à l'étape voulue | `shared/ui/tour/HelpButton.tsx:27` |

## Statuts et transitions
`activeTour` : none → dashboard / account / transactions → none (fin, abandon ou `stopTour`). `resetTours` existe pour tout remettre à zéro (`use-ui-store.ts:29`).

## Zones d'ombre
- Les deux lancements en dur (`page.tsx:140`, `accounts/page.tsx:17`) ne sont pas lus ici jusqu'à leur condition : on ignore s'ils se déclenchent seulement à la première visite (selon `completedTours`) ou à chaque fois.
- Où démarre la visite « transactions » : non trouvé hors du bouton d'aide.
