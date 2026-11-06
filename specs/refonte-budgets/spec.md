# Écran Budgets : saisie avec effet immédiat sur le prévu

## Le problème
Pour savoir ce qu'un budget change au prévu de fin de période, Lucas ouvre une feuille de saisie, enregistre, puis retourne sur Aujourd'hui. L'écran `/budgets` n'est aujourd'hui qu'une liste de périodes. Il faut voir l'effet d'un budget sans quitter l'écran, et sans rien enregistrer avant un clic.

## Critères d'acceptation
- [ ] CA1 — Étant donné une période choisie, quand Lucas ouvre `/budgets`, alors il voit le prévu de fin de période, les revenus prévus, le total budgété et une seule liste de catégories (fixes et variables mélangées). Dépenses et épargne sont triées par % consommé décroissant, factures en attente comprises (dépassés d'abord), puis revenus et virements. Chaque ligne donne réel, reste ou dépassement (même chiffre que le bloc Budgets d'Aujourd'hui) et budget modifiable.
- [ ] CA2 — Étant donné une saisie dans un budget, quand Lucas change le montant, alors le prévu affiché change aussitôt et indique l'écart avec le prévu enregistré. Rien n'est écrit en base. Le chiffre est égal au centime à `forecastBalance` des stats après enregistrement.
- [ ] CA3 — Étant donné un budget abaissé sous le réel de sa catégorie, quand le total prévu des dépenses reste sous les dépenses réelles totales, alors le prévu ne bouge pas (règle max(réel, prévu) sur les totaux) et l'écran le dit ("sans effet : le réel est déjà plus haut") au lieu d'afficher un écart nul sans explication.
- [ ] CA4 — Étant donné des saisies non enregistrées, quand Lucas clique sur Annuler, alors les montants reviennent à ceux enregistrés et aucun autre écran n'est touché ; quand il clique sur Enregistrer, alors tous les budgets de la période sont enregistrés (y compris ceux qu'il n'a pas modifiés ni vus), puis le prévu affiché est celui des stats, égal au prévu simulé juste avant. S'il change de période, de compte ou quitte l'écran, une confirmation lui demande d'abandonner ou de rester ; sans saisie, rien ne s'affiche.
- [ ] CA5 — Étant donné un enregistrement qui échoue ou une valeur illisible ou négative, quand Lucas enregistre, alors un message l'explique, sa saisie et la simulation sont conservées, et les budgets enregistrés ne changent pas. Pendant l'envoi, le bouton est bloqué (un double clic n'envoie qu'une requête). Un champ vidé vaut 0 : le budget n'est plus enregistré, la ligne reste affichée avec un budget à 0, et le prévu (simulé puis enregistré) est celui d'une catégorie sans budget.
- [ ] CA6 — Étant donné un compte partagé où les budgets de la période ont changé depuis l'ouverture de l'écran (par une autre personne), quand Lucas enregistre, alors l'enregistrement est refusé, un message l'explique, et les montants enregistrés sont rechargés à l'écran. Si rien n'a changé, l'enregistrement passe comme avant.
- [ ] CA7 — Étant donné une période fermée, quand Lucas la sélectionne, alors un avertissement (visible avant tout enregistrement) dit que les dépassements passés vont changer ; l'enregistrement reste possible.
- [ ] CA8 — Étant donné la page `/budgets`, alors la liste des périodes garde ses capacités (créer, modifier les dates, clôturer, supprimer) dans une zone "Gérer les périodes", et l'écran des montants par défaut reste à `/budgets/fixed` sous le nom "Montants par défaut des nouvelles périodes" (jamais "budgets fixes"). Tout en fr et en, clair et sombre, bureau et mobile (zones tactiles de 44 px, tableau défilant horizontalement).

## Règle critique
Le prévu simulé = `forecastBalance` que donneraient les stats après enregistrement des mêmes budgets : départ + max(revenus réels, \|revenus prévus\|) − max(\|dépenses réelles\|, \|dépenses prévues\|) + transactions sans catégorie, `pending` comprises, budgets en valeur absolue, bigint en centimes (`docs/reporting.md`, règle « Solde prévisionnel »). Test écrit avant le code : mêmes entrées, simulation et stats donnent la même valeur (budget sous le réel, au-dessus, négatif, à 0, catégorie sans budget, revenus).

## Mesure d'impact
- Indicateur qui doit bouger : nombre d'allers-retours pour ajuster un budget et voir son effet sur le prévu (aujourd'hui : enregistrer puis changer d'écran ; cible : zéro).
- Équipe qui en profite : Performance.
- Comment on le mesure : par vérification (décision de Lucas), sans suivi ajouté : un `.http` de parité simulation/stats, puis écran vu en réel.

## Exploitation
- À voir en prod : les erreurs existantes de l'enregistrement des budgets ; aucun log ajouté.
- Retour arrière : revert des commits locaux ; aucune donnée à corriger. Si la détection passe par une migration (fonction SQL modifiée, pas de table), elle est à rejouer en sens inverse au revert, et reste non poussée tant que la refonte n'est pas finie.
- Feature flag : non (l'enregistrement des budgets reste la route existante, avec le refus en cas de changement concurrent).

## Parties sensibles
- Simulation du prévu : calcul qui touche l'argent, règle de `get-period-stats` à ne pas dupliquer. Aujourd'hui elle est écrite en ligne dans `get-period-stats.use-case.ts:86-133`, sans fonction réutilisable. Recommandation à valider au point de contrôle : en extraire une fonction pure unique, utilisée par les stats et par la simulation côté back ; le front n'affiche que le résultat (la copie en JS de la maquette, qui ignore sans-catégorie et max des revenus, ne doit pas être reprise). La simulation devient une nouvelle route en lecture seule (brique nouvelle) : à valider avec la conception.
- Enregistrement concurrent sur compte partagé (CA6) : concurrence. Refus si les budgets ont changé depuis l'ouverture ; le code d'erreur et la forme de la réponse sont à fixer en conception. Aujourd'hui, `PUT :id/budgets` supprime puis réinsère tout avec de nouveaux `id` et dates à chaque appel (`update-period-budgets.use-case.ts:31-46`, `replace_period_budgets`) : aucun `id` ni `updated_at` ne sert de version. La comparaison se fera donc sur le contenu (catégorie → montant) lu à l'ouverture, ce qui impose de l'envoyer avec l'enregistrement ; la vérification et l'écriture doivent être indivisibles (sinon deux enregistrements simultanés passent tous deux). Si la comparaison est faite dans la fonction SQL, une migration est nécessaire (voir Fichiers concernés).

## Ce qui change dans l'existant
- `docs/periods.md` / front : `/budgets` n'est plus la liste des périodes mais l'écran des budgets de la période choisie ; la feuille `edit-period-budgets-sheet.tsx` (qui enregistrait sans simulation) est remplacée par cet écran ; la liste des périodes passe dans "Gérer les périodes".
- `docs/budgets.md` : le mot "Budget fixe" ne s'affiche plus ; à l'écran, "montant par défaut". Le code, les routes et les tables gardent leur nom (`budget_templates`, `/budget-templates`). La maquette "Charges fixes" n'est pas reprise : aucune donnée ne distingue fixes et variables (zone d'ombre `is_fixed`).
- Aucune règle de calcul modifiée. Rien n'est retiré de la liste des périodes.

## Fichiers concernés
- À modifier : `functions/src/reporting/application/get-period-stats.use-case.ts` — appelle la fonction pure extraite (comportement inchangé)
- À créer : `functions/src/reporting/domain/period-forecast.ts` (nom indicatif) + son spec — règle du prévu, une seule fois ; Glob : absent
- À créer : cas d'usage de simulation + route en lecture seule dans `functions/src/reporting/infrastructure/reporting.controller.ts` (à modifier), câblage dans `functions/src/reporting/reporting.module.ts` (à modifier)
- À modifier : `functions/src/periods/application/update-period-budgets.use-case.ts` (+ son spec), `functions/src/periods/infrastructure/periods.controller.ts` (`UpdateBudgetsDto`, `PUT :id/budgets`), `functions/src/budgets/domain/budget.repository.interface.ts` et `functions/src/budgets/infrastructure/supabase-budget.repository.ts` (+ spec) — refus si les budgets ont changé depuis l'ouverture
- À créer (si la comparaison est faite en SQL, atomique avec l'écriture) : nouvelle migration dans `supabase/migrations/` modifiant `replace_period_budgets` (dernière version : `20261030100200_atomic_replace_period_budgets.sql`) ; le projet gère le schéma par migrations
- Tests : `functions/src/reporting/application/get-period-stats.use-case.spec.ts` (à modifier, non-régression), `functions/src/reporting/domain/forecast-composition.spec.ts` (inchangé, doit rester vert)
- À modifier : `frontend/src/app/[locale]/(dashboard)/budgets/page.tsx` — nouvel écran + zone "Gérer les périodes" ; `.../budgets/fixed/page.tsx` — titre
- À modifier : `frontend/src/features/periods/ui/period-list.tsx` — retire l'ouverture de la feuille des budgets, garde le reste ; `frontend/src/features/periods/ui/edit-period-budgets-sheet.tsx` — supprimer (remplacée)
- À modifier : `frontend/src/features/periods/ui/budget-templates-form.tsx`, `frontend/messages/fr.json`, `frontend/messages/en.json` — vocabulaire (clés `Budgets`, `BudgetTemplates`)
- À créer : écran, hook de simulation et logique de tri/saisie sous `frontend/src/features/budgets/` (dossier existant, seul `api/use-periods.ts`) ; réutiliser `overrunAmount` (`features/reporting/model/current-overruns.ts`), `useBudgetBreakdown`, `useUpdatePeriodBudgets`, `PeriodSelect`
- Tests front : à créer à côté des nouveaux fichiers ; `frontend/src/shared/ui/layout/nav-config.ts` et ses tests de navigation à relire (`/budgets/fixed` reste sous-page de `/budgets`)
- Vérification réelle : `http/budgets-simulation.http` (à créer) — parité simulation/stats, PUT, budget à 0, période fermée, enregistrement refusé après changement concurrent

## Hors périmètre
- Marque fixe/variable par catégorie, cycles 6 et 7.
- Moyenne sur 6 périodes : non disponible sans nouvelle règle. Les stats existantes (`get_category_historical_stats`) sont min/moy/max sur toutes les périodes passées, `pending` et tous types confondus ; la colonne de la maquette est omise. Le trait "jour 13 sur 31" est omis aussi (hypothèse).
- Bloc Budgets d'Aujourd'hui : inchangé (règle de dépassement partagée conservée ; décision de Lucas dans `besoin.md`).

## Hypothèses
- Chemins qui exposent les budgets, tous couverts ou inchangés : lecture `GET :id/budgets` (utilisée par l'écran), répartition `budget-breakdown` (source des lignes), stats (prévu), dépassements des périodes fermées (changent à l'enregistrement, d'où CA7), création de période (inchangée), montants par défaut (inchangés).
- Ce que fait l'existant à l'enregistrement : `PUT :id/budgets` remplace tout dans une transaction (`replace_period_budgets`), ne verrouille rien et ne compare aucune version : dernier arrivé gagne (changé par CA6). En erreur (doublon 409, RLS) les anciens budgets restent. Le front d'avant n'envoyait que les budgets existants plus les saisies ; le nouvel écran envoie la liste complète.
- Budget à 0, vérifié dans le code : c'est le cas d'usage, pas la fonction SQL, qui écarte les montants à 0 (`update-period-budgets.use-case.ts:30-33`) ; la fonction SQL supprime tous les budgets de la période puis insère ce qu'on lui donne (`20261030100200_atomic_replace_period_budgets.sql:36-43`). Un budget mis à 0 est donc supprimé. Ensuite, stats et répartition le lisent comme « pas de budget » : 0 (`get-period-stats.use-case.ts:91`, `get-budget-breakdown.use-case.ts:74`), et la catégorie reste listée (boucle sur les catégories). Effet sur le plafond : le prévu des dépenses de la catégorie passe à 0, donc le total prévu baisse ; le prévu final ne bouge que si le total prévu reste au-dessus des dépenses réelles totales, sinon max(réel, prévu) garde le réel (CA3 s'applique). La simulation doit donc traiter 0 comme absent, comme les stats, pour que le prévu simulé égale le prévu après enregistrement.
- Tri : % consommé décroissant, factures en attente comprises (décision de Lucas). Reste à fixer dans les tests : le rang d'une ligne à budget 0 avec du réel (division par 0) ; hypothèse : traitée comme dépassée, en haut de liste.
- Les saisies négatives sont refusées à l'écran (comme la maquette) ; l'API les accepte et les stats les comptent en valeur absolue. Un budget existant stocké en négatif est envoyé tel quel s'il n'est pas modifié.
- Le réel de la simulation est celui des stats (tous les types de transactions, `pending` comprises), différent du réel des dépassements (`pending` exclues, `docs/reporting.md`) : le "reste" des lignes suit la répartition, le prévu suit les stats.
- La période choisie est celle du store partagé (`activePeriodId`), via `PeriodSelect`.
- Couleurs et libellés du bloc Aujourd'hui (rouge/vert, onglets) ne sont pas repris dans l'écran Budgets, qui suit la maquette (un seul jeton d'alerte) ; le bloc Aujourd'hui lui-même ne change pas.

## Points ouverts
- Simulation côté back (nouvelle route) plutôt que copie du calcul dans le front : à trancher au point de contrôle (voir Parties sensibles).
- Détection du changement concurrent : à concevoir au point de contrôle (comparaison sur le contenu des budgets, atomique avec l'écriture, migration ou non). Le comportement est fixé par CA6.
