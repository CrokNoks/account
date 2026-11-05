# Dépassements de catégorie par période

## Le problème
Lucas voit les dépassements une période à la fois (répartition du budget). Il ne peut pas voir quelles catégories dépassent d'une période à l'autre, ni lesquelles varient le plus. Il budgète à l'aveugle.

## Critères d'acceptation
- [ ] CA1 — Étant donné un compte avec des périodes fermées (`is_active` faux), quand j'ouvre la page « Dépassements », alors je vois une section par période fermée (la plus récente en premier) avec ses catégories en dépassement et le montant de chaque dépassement. La période active n'apparaît pas.
- [ ] CA2 — Étant donné une catégorie de dépense ou d'épargne avec un budget ≠ 0, quand le réel de la période est négatif (dépense nette) et que sa valeur absolue dépasse la valeur absolue du budget, alors elle est listée avec son budget, son réel et l'excédent (`|réel| − |budget|`, en centimes). Égalité exacte : pas de dépassement.
- [ ] CA3 — Étant donné un budget à 0 ou une catégorie sans budget, quand elle a des dépenses, alors elle n'est jamais listée.
- [ ] CA4 — Étant donné une catégorie de revenu ou de virement, quand son réel dépasse son budget, alors elle n'est pas listée.
- [ ] CA5 — Étant donné une transaction en attente (`pending`) dans une période fermée, quand le dépassement est calculé, alors elle n'est pas comptée dans le réel (une catégorie qui ne dépasse que grâce à elle n'est pas listée).
- [ ] CA6 — Étant donné que je choisis une catégorie, une période de début P1 et une période de fin P2, quand je valide, alors un graphique en barres montre, pour chaque période fermée de P1 à P2 incluses, une barre (ou un groupe de barres) par période, en ordre chronologique, avec le budget et le dépassement de cette catégorie. Le dépassement affiché suit exactement les règles de CA2 à CA5 (même calcul que la liste).
- [ ] CA7 — Étant donné une période fermée sans aucun dépassement, ou aucune période fermée, quand j'ouvre la page, alors un message le dit au lieu d'un écran vide. Dans le graphique, une période de la plage sans dépassement ou avec un budget à 0 garde sa barre avec un dépassement de 0.
- [ ] CA8 — Étant donné un compte dont je n'ai pas l'accès ou une période d'un autre compte, quand j'appelle la page ou le graphique, alors rien n'est renvoyé (même refus que les autres routes de reporting).

## Règle critique
Le calcul du dépassement d'une catégorie sur une période fermée : dépense ou épargne, budget ≠ 0, `|réel hors pending| > |budget|`, en centimes entiers (bigint, aucun flottant). Testée avant le code : cas égalité, budget négatif ou positif, budget 0, revenu, pending, remboursement. Cette règle sert à la liste (CA1) et au graphique (CA6) : une seule fonction.

## Mesure d'impact
- Indicateur qui doit bouger : Lucas sait nommer les catégories qui varient le plus d'une période à l'autre (il consulte l'évolution budget/dépassement d'une catégorie sur une plage). Mesuré par l'usage : nombre d'ouvertures de la page et de graphiques demandés, par catégorie.
- Équipe qui en profite : Performance (décider plus vite où ajuster les budgets).
- Comment on le mesure : logs structurés `overruns_report_built` (compte, nombre de périodes, nombre de dépassements) pour la liste, et `overruns_chart_built` (compte, catégorie, P1, P2, nombre de périodes) pour le graphique ; la requête `supabase/queries/depassements-par-periode.sql` reste inchangée (règle différente, voir Ce qui change).

## Exploitation
- En prod : les logs `overruns_report_built` et `overruns_chart_built` ; les erreurs 404/403 habituelles du reporting.
- Retour arrière : revert du commit (lecture seule, aucune donnée écrite, aucune migration).
- Feature flag : non (page nouvelle, lecture seule, entrée de menu ajoutée).

## Parties sensibles
- Calcul des dépassements par période — calcul métier qui touche l'argent (règle à plusieurs branches : type, budget ≠ 0, pending, signe). À garder en fonction pure, moins de 150 lignes, la même pour la liste et le graphique ; conception à valider par Lucas avant le code.

## Ce qui change dans l'existant
- Aucune règle modifiée, mais trois écarts assumés avec `docs/reporting.md` « Répartition budget » (`get-budget-breakdown.use-case.ts:56-90`) :
  1. La répartition COMPTE les `pending` dans le réel ; la page les EXCLUT. Une catégorie peut donc être « X de dépassement » dans la répartition et absente ici, et inversement.
  2. La répartition affiche aussi les catégories à budget 0 (barre pleine rouge) ; la page les exclut.
  3. Le dépassement de la répartition est `reste < 0` avec `reste = |budget| + réel` : un réel positif (remboursements nets) n'en est jamais un. La page garde ce sens : le dépassement vaut `−réel − |budget| > 0`.
- `supabase/queries/depassements-par-periode.sql` (docs/budgets.md, rubrique Mesure) compte les budgets à 0, tous types de catégorie, et relie les transactions par `period_id` ; la page exclut les budgets à 0 et les revenus/virements. Les chiffres ne sont donc pas comparables tant que la requête n'est pas alignée.
- Le rattachement des transactions diffère : la répartition prend les transactions par dates de la période (`findAllByAccountUnpaginated`, bornes incluses) ; la requête SQL par `period_id`. La page reprend la règle de la répartition (dates). À signaler au développeur : les deux peuvent diverger si une transaction a un `period_id` différent de sa date.
- Le budget est propre à chaque période (`budgetRepository.findAllByPeriod`, `get-budget-breakdown.use-case.ts:47`) : le graphique montre donc l'évolution réelle du budget d'une période à l'autre.

## Fichiers concernés
Schéma : géré par migrations Supabase (`supabase/migrations/`), aucune nécessaire ici.
- À créer : `functions/src/reporting/application/get-overruns-by-period.use-case.ts` — cas d'usage liste (périodes fermées, réel hors pending, dépassements) et fonction pure partagée
- À créer : `functions/src/reporting/application/get-category-overruns-chart.use-case.ts` — cas d'usage graphique (catégorie, plage P1-P2, budget et dépassement par période, réutilise la fonction pure)
- À créer : les `.spec.ts` correspondants (règle critique d'abord)
- À modifier : `functions/src/reporting/infrastructure/reporting.controller.ts` — deux routes GET sous `SupabaseAuthGuard` (contrôleur déjà `@Controller(':accountId')`, garde l.239) ; le graphique prend catégorie, P1, P2 en paramètres de requête (style `@Query` existant, ex. l.323)
- À modifier : `functions/src/reporting/reporting.module.ts` — déclarer les cas d'usage
- À modifier : `functions/test/front-contract.e2e-spec.ts` — contrat des nouvelles routes
- À créer : `http/depassements-par-periode.http` — scénarios réels CA1 à CA8
- À créer : `frontend/src/features/reporting/api/use-overruns.ts`, `frontend/src/features/reporting/ui/overruns-by-period.tsx` (+ test `overruns-by-period.test.tsx`), `frontend/src/features/reporting/ui/category-overruns-chart.tsx` (+ test), `frontend/src/app/[locale]/(dashboard)/depassements/page.tsx`
- À modifier : `frontend/src/features/reporting/model/types.ts` — types des réponses ; `frontend/src/shared/ui/layout/sidebar.tsx` (et `bottom-nav.tsx`, `command-menu.tsx` si on l'y met) — entrée de menu ; `frontend/messages/fr.json` et `en.json` — libellés
- À modifier : `docs/reporting.md`, `docs/budgets.md` (par le documentaliste)
- Lecture : `functions/src/periods/domain/period.repository.interface.ts` (`findAllByAccount`, pas de filtre « fermées » : à filtrer dans le cas d'usage), `functions/src/transactions/domain/transaction.entity.ts` (`pending`)

## Hors périmètre
- Période active (décision de Lucas), revenus « au-delà du budget », virements.
- Export ; cumul ou classement par catégorie (écarté par Lucas).
- Modifier la répartition actuelle ou y masquer les `pending`.
- Changer les budgets depuis cette page.

Chemins d'exposition : deux routes (liste par période, graphique d'une catégorie). Aucune règle de visibilité nouvelle ; le contrôle d'accès est celui du reporting (RLS + garde) : couvert par CA8 pour les deux routes. Ni favori, ni export, ni autre accès existant ne reprend cette donnée.

## Hypothèses
Non confirmées par Lucas, sauf mention contraire :
- Réel d'une catégorie = somme signée de ses transactions de la période (dates, bornes incluses), `pending` exclues ; un remboursement vient en déduction (comme la répartition et la requête SQL).
- Une transaction sans catégorie n'entre dans aucune catégorie (comme la répartition).
- Période « fermée » = `is_active` faux. Une période a toujours une date de fin (confirmé par Lucas) : aucun cas « sans date de fin » à traiter.
- Budget négatif ou positif : seule la valeur absolue compte (règle existante de la répartition) ; le graphique affiche le budget en valeur absolue.
- La page porte sur un compte à la fois (celui sélectionné), comme les autres écrans de reporting.
- Tant qu'aucune catégorie n'est choisie, aucun graphique n'est affiché (catégorie non présélectionnée).
- Les périodes sont ordonnées par date de début (ordre chronologique) ; une période sans budget pour cette catégorie compte comme budget 0.

## Décisions de Lucas
- Réel net positif sur une catégorie de dépense (remboursements) : pas un dépassement. Le dépassement exige un réel négatif.
- Pas de cumul par catégorie. Pour une catégorie donnée, Lucas veut voir, pour toutes les périodes entre P1 et P2 incluses, un bargraph de l'évolution du budget et du dépassement, une barre par période.
- `supabase/queries/depassements-par-periode.sql` n'est pas modifiée (indicateur historique conservé). La mesure passe par les logs `overruns_report_built` et `overruns_chart_built`.
- Le graphique ne montre que des périodes fermées : P1 et P2 se choisissent parmi elles.
- Dans la plage, une période sans dépassement ou avec budget 0 garde sa barre, dépassement à 0.
- Une barre empilée par période : le budget (valeur absolue) en bas, le dépassement en rouge au-dessus.
- Catégories proposées dans le choix : dépense et épargne uniquement.
- P1 après P2 : le choix est refusé à l'écran, jamais permuté en silence.
- Plage par défaut : P2 = la dernière période clôturée ; P1 = la période clôturée située 6 rangs avant P2 (7 barres), ou la plus ancienne clôturée s'il y en a moins.
