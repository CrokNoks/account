# Écran Aujourd'hui fixe

## Le problème
Lucas ouvre l'app et doit parcourir un tableau de bord personnalisable pour savoir où il en sera à la fin de la période : le solde prévu n'est qu'une sous-ligne de carte et n'est pas décomposé. On le remplace par un écran fixe où le prévu est le chiffre principal, avec sa composition, et on retire la personnalisation devenue inutile.

## Critères d'acceptation
- [ ] CA1 — Étant donné un compte avec une période choisie, quand j'ouvre Aujourd'hui (bureau 1440 px et mobile 390 px), alors le prévu (chiffre principal), le solde en banque, le solde à venir et la composition du prévu sont visibles sans clic ni défilement.
- [ ] CA2 — Composition : en banque + CB non pointées (non rapprochées, non en attente) + factures à venir (`pending` non rapprochées) − budget restant + revenus attendus = prévu, au centime. Les lignes sont signées : une dépense est négative. Le prévu affiché est toujours celui de `docs/reporting.md` (stats), jamais un second calcul.
- [ ] CA3 — Quand tous les segments de la composition sont positifs, ils s'affichent en barre ; sinon (revenus attendus > 0, remboursement en CB, prévu négatif…), en lignes signées : en banque, CB, factures, budget restant, revenus attendus, prévu.
- [ ] CA4 — Rythme de dépense : courbe du cumul des sorties d'argent par jour de la période choisie (dépenses, épargne et transactions sans catégorie ; `pending` exclues), comparée à la période précédente au même jour, avec la phrase d'écart (« X de plus / de moins qu'à la même date »). Sans période précédente : courbe seule, sans comparaison.
- [ ] CA5 — À traiter liste les anomalies, les CB à pointer (nombre et total) et les dépassements en cours, chaque ligne menant à l'écran concerné (sinon « tout est à jour »). Le dépassement en cours est calculé comme la répartition du budget (`pending` comprises) : un seul chiffre à l'écran, le même dans À traiter et dans Budgets. Budgets reprend la répartition du budget de la période. Factures reprend les prochaines échéances (date, libellé, montant, total).
- [ ] CA6 — Plus de bouton Personnaliser, de catalogue ni de widgets Patrimoine net, Statistiques par tags, Dernières transactions. Le back n'expose plus `/preferences`, `reporting/net-worth` ni `reporting/tags-summary` (404) ; leurs hooks front et leurs tests disparaissent avec elles. La page Tags et le détail d'un tag fonctionnent comme avant.
- [ ] CA7 — La visite guidée « dashboard » ne contient aucune étape dont la cible est introuvable ; chaque étape pointe un bloc de l'écran fixe, en fr et en.
- [ ] CA8 — Le choix de période reste sur Aujourd'hui et pilote tous les blocs ; l'écran est correct en fr et en, clair et sombre, bureau et mobile. Sans aucune période : tout l'écran est remplacé par une explication et un bouton pour créer une période (ni barre, ni rythme, ni blocs).

## Règle critique
La somme des lignes de composition égale le prévu au centime, en centimes entiers, sans inverser `pending` (facture à venir, hors soldes) et CB non pointée (déjà faite, comptée dans le solde à venir). Elle est testée avant le code, y compris avec max(réel, prévu) pour revenus et dépenses, transactions sans catégorie, `pending` rapprochée et remboursements.

## Mesure d'impact
- Indicateur : temps pour connaître le prévu de fin de période (plan : cycle 2).
- Équipe : Performance.
- Mesure : par vérification (prévu et composition visibles à l'ouverture), sans suivi ajouté (réponse de Lucas).

## Exploitation
- Logs : journal de construction du rythme (compte, période, nombre de jours), sans montant ni libellé, comme `overruns_report_built`.
- Retour arrière : `git revert` des commits du cycle ; la migration n'étant pas appliquée avant la fin de la refonte, rien en base à défaire. Une fois appliquée, la suppression de `user_preferences` est irréversible sans sauvegarde.
- Feature flag : non (rien n'est déployé avant la fin de la refonte).
- Ordre à la mise en prod : déployer front et back, puis appliquer la migration (le front actuellement en prod lit `/preferences`).
- Livraison : commits locaux, sans push, release ni `supabase db push`.

## Parties sensibles
- Composition du prévu — calcul métier qui touche l'argent, à plusieurs branches (max réel/prévu, sans catégorie, `pending`, CB).
- Rythme de dépense — calcul de cumul par jour et alignement de deux périodes de longueurs différentes.

## Ce qui change dans l'existant
- `docs/preferences.md` : le module, la route `/preferences`, la table `user_preferences`, le store et l'édition disparaissent ; les zones d'ombre du cycle 2 sont closes.
- `docs/reporting.md` : la réponse « stats » gagne la décomposition du prévu (nouvelles valeurs, formules inchangées) ; nouveau rythme de dépense ; widgets Patrimoine net, Tags et le catalogue ne sont plus au tableau de bord.
- `docs/tour.md` : étapes « stats », « transactions » et « + » déplacées ; `data-tour` n'est plus posé par les widgets.
- `docs/reporting.md` : les routes `reporting/net-worth` et `reporting/tags-summary` (et leurs règles : patrimoine net sur 31 points, résumé par tag) sont retirées ; `docs/tags.md` : `tag-stats-summary`, `use-tags-summary` et la route associée sont retirés (le détail d'un tag reste).
- Écart assumé entre deux écrans : la page Dépassements (périodes fermées) exclut les factures en attente (`pending`) (`docs/reporting.md`, « Réel d'un dépassement ») ; À traiter (période active) les inclut, comme la répartition du budget. Les deux chiffres peuvent donc différer pour une même catégorie ; décision de Lucas, aucune des deux règles n'est modifiée.
- Aucune règle de calcul existante n'est modifiée (le retrait des deux routes retire des fonctionnalités, pas des règles de calcul encore utilisées).

## Fichiers concernés
Vérifiés par Glob/Grep. Le schéma passe par `supabase/migrations/` (fichiers datés, pas de `synchronize`).
- Modifier : `functions/src/reporting/application/get-period-stats.use-case.ts` (+ `.spec.ts`) — CB, factures, budget restant, revenus attendus dans la réponse ; `functions/src/reporting/infrastructure/reporting.controller.ts` (+ `reporting.module.ts`) — route du rythme, retrait des routes `net-worth` (l.321) et `tags-summary` (l.393), du `NetWorthResponseDto` et des injections associées ; `functions/src/reporting/application/get-tag-details.use-case.ts` — reçoit l'interface `TagSummary` (aujourd'hui exportée par `get-tags-summary.use-case.ts`, encore utilisée par le détail d'un tag et par `TagSummaryDto`) ; `functions/src/app.module.ts` — retrait de `PreferencesModule`.
- Créer : `functions/src/reporting/application/get-spending-pace.use-case.ts` (+ spec) ; `supabase/migrations/<horodatage après 20261105100100>_drop_user_preferences.sql` — supprime la table et `public.widen_balance_cards`.
- Supprimer : `functions/src/preferences/` ; `frontend/src/features/preferences/` ; `frontend/src/features/reporting/ui/net-worth-widget.tsx` (+ test) ; `frontend/src/features/tags/ui/tag-stats-summary.tsx` ; `frontend/src/features/reporting/api/use-net-worth.ts` ; `frontend/src/features/tags/api/use-tags-summary.ts` ; `functions/src/reporting/application/get-net-worth.use-case.ts` (+ `.spec.ts`) ; `functions/src/reporting/application/get-tags-summary.use-case.ts` (+ `.spec.ts`) ; `supabase/tests/widen_balance_cards_test.sql` ; `http/tableau-de-bord-allege.http` ; clés `Dashboard.widgets.*`, `customize`, `layout_title`, `available_widgets`, `show/hide_*` de `frontend/messages/{fr,en}.json`.
- Modifier (retrait des références) : `frontend/src/app/[locale]/(dashboard)/page.tsx` (réécrit : écran fixe, garde le sélecteur de période, la redirection `/accounts`, le lancement de la visite) ; `functions/test/e2e-app.ts`, `auth.e2e-spec.ts` (l.40 `net-worth`), `route-ids.e2e-spec.ts` (l.49 `net-worth`), `validation.e2e-spec.ts` (cas `/preferences` ; cas `tags-summary` l.880-894), `account-ownership.e2e-spec.ts` (l.323 `tags-summary`) ; `http/suppression-gemini.http` (l.23-26, la route `net-worth` y sert d'exemple de route conservée : retirer ce cas, `evolution` suffit) ; `functions/http/reporting-dates.http` (l.27-35, cas `netWorth`) ; `frontend/src/features/reporting/model/types.ts` (l.73-80, types `NetWorth*`) ; `frontend/src/shared/model/stores.test.ts` (bloc `useDashboardStore`) ; `supabase/tests/utility_functions_privileges_test.sql` (cite `widen_balance_cards`) ; `frontend/src/features/tour/config/dashboard-tour.ts`, `dashboard-tour.test.ts`, `tour-ui.test.ts`.
- Réutiliser : `dashboard-stats.tsx`, `anomalies-widget.tsx`, `budget-breakdown.tsx`, `upcoming-deadlines-widget.tsx` (adaptés) et leurs tests.
- Tests à ajouter : cas de composition dans `get-period-stats.use-case.spec.ts` ; spec du rythme ; test front de l'écran (barre / lignes signées) ; fichier `http/aujourdhui.http` (httpYac).

## Hors périmètre
Refonte d'Opérations, Analyses, Budgets, Échéances ; accueil mobile spécifique (cycle 7) ; page Tags et détail d'un tag.

## Hypothèses
- Chaque ligne : CB = somme des transactions non rapprochées et non `pending` ; factures = `pending` non rapprochées ; budget restant = max(|dépenses réelles|, |prévues|) − |dépenses réelles| ; revenus attendus = max(réels, prévus) − réels. Une `pending` rapprochée est déjà dans le solde en banque : pas de ligne propre, la somme reste exacte. À vérifier par le test de la règle critique.
- Le calcul de la composition vit dans le back, avec les données de « stats », pour ne pas dupliquer la règle.
- Le rythme se calcule dans le back (aucune route ne fournit un cumul par jour ; le front ne peut pas le reconstituer sans charger toutes les transactions). Route nouvelle sous `reporting`, mêmes règles d'accès que `stats` (jeton exigé, période du compte sinon 404).
- Sorties du rythme (réponse de Lucas : toutes les sorties d'argent, dépenses et sorties sans catégorie, `pending` exclues) : somme nette des catégories de dépense et d'épargne, plus les transactions sans catégorie de montant négatif. L'épargne est comptée : le type de catégorie `savings` existe toujours (`functions/src/categories/domain/category.entity.ts:7`, `docs/categories.md:9`) et la spec `suppression-epargne` ne retire que les objectifs d'épargne (« un autre concept : elle reste », spec:39) ; `docs/reporting.md` classe déjà l'épargne dans les dépenses réelles. Les catégories de type revenu et virement n'entrent pas dans le rythme.
- Période précédente = période du même compte dont le début est immédiatement antérieur ; jour n = n-ième jour depuis le début. Période sans fin ou active : courbe jusqu'à aujourd'hui. Si la précédente est plus courte, son cumul final est conservé.
- Un segment à 0 ne rend pas la barre impossible.
- Cibles de la visite : « stats » → barre des soldes ; « répartition » → bloc Budgets ; « transactions » → bloc À traiter (le bloc Dernières transactions disparaît, texte à réécrire) ; « + » → bouton « Nouvelle opération » ou équivalent.
- À traiter : les CB à pointer viennent des mêmes données que la composition ; les dépassements en cours, de celles de la répartition du budget.

## Décisions de Lucas
- Rythme : virements catégorisés, revenus négatifs et remboursements sans catégorie sont exclus.
- Visite guidée : « stats » → barre des soldes, « répartition » → bloc Budgets, « transactions » → À traiter (texte réécrit), « + » → Nouvelle opération.
