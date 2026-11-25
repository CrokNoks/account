# Déclencheur de période : une transaction « paie » ouvre la période suivante

## Le problème
Aujourd'hui Lucas clôture la période à la main (PATCH de la fin) puis en crée une autre (POST), deux gestes séparés sans reprise si le second échoue. Il veut qu'enregistrer une transaction d'une catégorie choisie (ex. « Salaire ») le fasse seul, y compris quand la paie est une récurrente `pending` qu'il sort du pending le jour où le virement arrive. En plus, la création d'une période à cheval sur deux mois perd des récurrentes (`docs/periods.md`, règle d'injection) ; Lucas demande de le corriger dans ce cycle.

## Décidé par Lucas (`besoin.md`, « A go » du 2026-11-25)
1. Ancienne période : fin = la veille de la date de la transaction. Nouvelle : début = date de la transaction. Ex. paie du 28 nov. : ancienne jusqu'au 27 nov., nouvelle dès le 28 nov.
2. Toute création déclenche (import compris), sans confirmation, sauf période active commencée depuis peu.
3. Impact : moins de gestes ; indicateur = part des périodes ouvertes par le déclencheur plutôt qu'à la main.
4. Récurrentes : corriger l'injection d'une période à cheval sur deux mois, aussi pour les périodes créées à la main.
5. Sortir du pending une transaction de la catégorie déclencheuse déclenche aussi la bascule ; sa date devient celle du jour de la sortie, jamais le futur.
6. **Règle A** : s'il existe une paie récurrente (récurrente de la catégorie déclencheuse), la nouvelle période finit la veille de sa prochaine occurrence (sinon début + 1 mois - 1 jour). Cette prochaine paie est quand même injectée en `pending`, hors période, hors prévu ; visible dans Opérations « toutes les périodes » et par un accès direct depuis Aujourd'hui.
7. Hypothèses validées par le « go » : seuil de 15 jours (écart 14 : rien ; 15 : bascule) ; date du jour à la sortie du pending pour la seule catégorie déclencheuse (dates prévues passées comprises, aussi sous le seuil, sans bascule) ; date envoyée dans la même modification ignorée (H2) ; catégorie finale décisive, en lot aussi (H4) ; une bascule au plus par lot, les autres sorties prennent la date du jour (H5) ; virement de l'app jamais déclencheur ; paie à moins de 15 jours du début non réinjectée (H3) ; paie saisie à la main : la `pending` restante n'est pas touchée (H7) ; rattachement des opérations déjà saisies à la nouvelle période et non-réinjection d'une récurrente déjà présente le même mois calendaire, `metadata.recurringId` (H1) ; import : chaque opération va dans la période qui contient sa date.
8. Hypothèses annoncées sans objection, tenues pour décidées : une seule catégorie déclencheuse par compte, désactivée par défaut ; « règles actuelles » = montants par défaut du compte + récurrentes injectées ; création `pending`, date future, aucune active, date <= début de l'active : rien ; changement de catégorie seul : ne déclenche pas.

## Critères d'acceptation
- [ ] CA1 — Réglage. Étant donné un compte, quand on ouvre la catégorie (écran Catégories, fr et en), alors on peut la marquer « déclencheur de période » ou retirer la marque ; une seule par compte (en marquer une autre retire la première) ; rien n'est marqué par défaut, donc aucun comportement ne change tant que Lucas ne l'a pas fait ; une catégorie d'un autre compte est refusée. Tout type de catégorie peut être marqué.
- [ ] CA2 — Bascule (création, import compris). Étant donné une période active commencée depuis au moins 15 jours, quand on enregistre une transaction non `pending` de la catégorie déclencheuse, datée d'aujourd'hui ou du passé, alors l'active est close à la veille de la date ; une nouvelle période commence à cette date, avec les montants par défaut du compte et ses récurrentes injectées ; sa fin est la veille de la prochaine paie récurrente (CA8), à défaut début + 1 mois - 1 jour ; la transaction déclencheuse appartient à la nouvelle période, et les transactions déjà existantes datées à partir du nouveau début lui sont rattachées, comptées une seule fois. Import : bascules dans l'ordre des dates, au plus une par échéance (CA5 à chaque déclencheuse), chaque opération dans la période qui contient sa date.
- [ ] CA3 — Sortie du pending. Étant donné une transaction `pending` de la catégorie déclencheuse (catégorie finale), quand on la sort du pending (pointer, décocher « pending » à l'édition, ou en lot), alors sa date devient celle du jour (fuseau métier), qu'elle fût prévue dans le futur ou dans le passé, puis la bascule se fait comme en CA2 (seuil de CA4 compris), sans réinjecter la paie qu'on vient de sortir (CA8). Les autres pending (factures…) gardent leur date. Seule la transition `pending` → non `pending` compte. En lot : toute sortie déclencheuse prend la date du jour, une seule bascule.
- [ ] CA4 — Seuil et cas sans bascule. Étant donné la période active commencée le jour D, quand la date de la déclencheuse est à moins de 15 jours de D (14 : rien ; 15 : bascule), alors elle est enregistrée sans bascule ; en sortie du pending sa date est tout de même celle du jour. Même résultat, sans erreur, pour : création `pending` ou datée dans le futur, date <= début de l'active, aucune période active, virement de l'app. Modifier seulement la catégorie, et les récurrentes injectées par une création de période, ne déclenchent jamais.
- [ ] CA5 — Tout ou rien. Quand la bascule est déclenchée (création, import, sortie du pending), alors la transaction (date comprise), la clôture, l'ouverture, le rattachement et l'injection réussissent ensemble ou rien n'est modifié (erreur, une seule période active) ; deux déclenchements simultanés donnent une seule bascule, la seconde est enregistrée sans bascule ; lecture seule refusée comme aujourd'hui.
- [ ] CA6 — Information. Quand la bascule est confirmée, alors la personne voit (fr et en) la période clôturée et celle ouverte (dates), et, pour une sortie du pending, que la date est devenue celle du jour ; les écrans périodes, transactions et reporting se rafraîchissent.
- [ ] CA7 — Accès direct à la prochaine paie. Étant donné une paie `pending` de la catégorie déclencheuse datée après la fin de l'active, quand on ouvre Aujourd'hui (fr et en), alors une ligne de « À traiter » la signale (libellé, date, montant) et mène à Opérations « toutes les périodes » sur cette transaction, où on peut la pointer ; sans cette pending, pas de ligne, et « tout est à jour » reste vrai. Cette paie n'entre dans aucun total de la période (prévu, à venir, composition, répartition, évolution, anomalies, rythme).
- [ ] CA8 — Récurrentes. Étant donné une période de dates quelconques (déclencheur ou main), quand `injectRecurring` est vrai, alors chaque récurrente est injectée à chaque date où son jour tombe dans la période, mois court ramené à son dernier jour (25 oct. → 24 nov. : le jour 5 est créé le 5 nov. ; plus d'un mois : plusieurs occurrences). À la bascule : (a) la « prochaine occurrence » est la première date d'une récurrente de montant positif de la catégorie déclencheuse à au moins 15 jours du début de la nouvelle période ; plusieurs : la plus proche ; aucune : fin = début + 1 mois - 1 jour ; (b) cette occurrence est injectée en `pending` à la fin + 1 jour, hors période ; (c) une occurrence n'est pas injectée si une transaction de la même récurrente existe déjà dans le même mois calendaire, y compris datée dans l'ancienne période (pas de doublon) ; (d) une paie à moins de 15 jours du début n'est pas injectée.

## Règle critique
Une saisie ou sortie du pending déclencheuse laisse exactement une période active contenant la transaction, ou ne change rien (CA5) ; ne ferme jamais une période commencée depuis moins de 15 jours (CA4) ; la transaction sortie du pending porte la date du jour ; la nouvelle fin est la veille de la prochaine paie et cette paie n'existe qu'une fois en `pending` (CA8) ; aucune transaction n'est perdue ni comptée deux fois. Tests écrits avant le code : atomicité (échec simulé à l'ouverture), deux déclenchements concurrents, bornes 14/15 jours (seuil, et occurrence à 14/15 jours du début), prochaine paie injectée hors période une seule fois (déjà présente, y compris dans l'ancienne période), aucune récurrente → début + 1 mois - 1 jour, plusieurs récurrentes → la plus proche, récurrente négative → règle A non appliquée, sortie d'une paie datée dans le futur (date = aujourd'hui, bascule), sortie d'une facture non déclencheuse (date inchangée), prévu inchangé par la pending hors période.

## Mesure d'impact
- Indicateur : part des périodes ouvertes par le déclencheur plutôt qu'à la main.
- Mesure : log structuré `period_opened` avec `origin: 'trigger' | 'manual'` (création manuelle comprise ; sortie du pending = `trigger`), plus `period_trigger_skipped` avec la raison (seuil, pending, futur, aucune active…). Part = `trigger` / total sur 3 mois.

## Exploitation
- À voir en prod : les deux logs et les erreurs de bascule (409 chevauchement / période active).
- Retour arrière : retirer la marque de la catégorie (désactive tout, y compris le changement de date et la ligne d'accès, sans déploiement) ; code : revert. Périodes ouvertes corrigées par PATCH des dates ; date changée à la sortie du pending remise par PATCH ; la pending de la prochaine paie se supprime à la main. CA8 (récurrentes à cheval) se revert à part.
- Feature flag : aucun mécanisme dans `functions/src` ; le réglage de CA1, vide par défaut, en tient lieu.

## Parties sensibles
- Bascule atomique clôture + ouverture + rattachement sous concurrence : concurrence, probablement une fonction SQL dans l'esprit de `create_period_with_budgets`.
- Choix de la date, seuil de 15 jours, ordre et rattachement d'un import, réécriture de la date à la sortie du pending, calcul de la prochaine occurrence (fin de période) : algorithme.
- Occurrences des récurrentes sur période à cheval et non-réinjection : algorithme.

## Ce qui change dans l'existant
- Change la règle d'injection de `docs/periods.md` (mois de la date de début, jours 25 à 31) et celle de `docs/recurring.md` (« une seule occurrence par mois »).
- Change : une période peut finir autrement qu'à début + 1 mois - 1 jour (règle A) ; une `pending` de récurrente peut être injectée après la fin de la période (exception à CA8 « dans la période »).
- Change le trigger `assign_period_id` (`docs/periods.md`, `docs/transactions.md`) pour la transaction déclencheuse.
- Complète « Création : enregistrée telle quelle » et l'import « tout ou rien » de `docs/transactions.md`.
- Change la modification simple et en lot de `docs/transactions.md` : sortir du pending réécrit la date pour la catégorie déclencheuse (`resolvePending`, `functions/src/transactions/domain/pending-rule.ts:7-14`, ne touche aujourd'hui qu'aux booléens).
- Contredit « Pas de notion de déclencheur » de `docs/categories.md` et la dernière puce de « Clôturer… » de `docs/periods.md`.

## Fichiers concernés
- Modifier : `functions/src/transactions/application/create-transaction.use-case.ts`, `bulk-create-transactions.use-case.ts` — bascule (création, import).
- Modifier : `functions/src/transactions/infrastructure/transactions.controller.ts` — `update` (l. 513-570) : sortie du pending, date du jour, bascule.
- Modifier : `functions/src/transactions/application/bulk-update-transactions.use-case.ts` (l. 41-52) — sortie en lot (`data` sans `date`, l. 10-15).
- Modifier : `functions/src/transactions/domain/pending-rule.ts` (+ `.spec.ts`) — détecter pending → non pending.
- Modifier : `functions/src/periods/application/create-period-with-budgets.use-case.ts` — occurrences, prochaine paie, non-réinjection, log (l. 67-94 : mois de début seul aujourd'hui).
- Modifier : `functions/src/shared/domain/recurring-day.ts` (+ `recurring-day.spec.ts`) — occurrences dans une période, prochaine occurrence.
- Modifier : `functions/src/periods/infrastructure/supabase-period.repository.ts`, `period.repository.interface.ts` — appel atomique.
- Modifier : `functions/src/categories/domain/category.entity.ts`, `infrastructure/categories.controller.ts`, `supabase-category.repository.ts` — réglage (si porté par la catégorie).
- Modifier : `frontend/src/features/categories/ui/category-list.tsx`, `create-category-dialog.tsx` ; `frontend/messages/fr.json`, `en.json` (marque, message CA6, ligne `todo_…` de CA7).
- Modifier : `frontend/src/features/transactions/ui/transaction-list.tsx` (pointage l. 261 et 299, édition l. 517-527), `api/use-update-transaction.ts`, `api/use-bulk-transactions.ts` — message et rafraîchissement ; la réponse du lot doit porter la bascule.
- Modifier : `frontend/src/features/reporting/ui/to-handle.tsx` (+ `to-handle.test.tsx`) — ligne d'accès (CA7) ; lecture via `frontend/src/features/transactions/api/use-transactions.ts` (liste existante filtrée catégorie + pending, sans période).
- Créer : migration dans `supabase/migrations/` (réglage + fonction atomique) ; `functions/http/declencheur-periode.http`.
- Tests à modifier : `create-transaction.use-case.spec.ts`, `bulk-create-transactions.use-case.spec.ts`, `bulk-update-transactions.use-case.spec.ts`, `create-period-with-budgets.use-case.spec.ts`, `supabase-period.repository.spec.ts`, `category.entity.spec.ts`, `category-list.test.tsx`, `transaction-list.test.tsx`, `functions/test/periods-creation.e2e-spec.ts`, `functions/test/transactions.e2e-spec.ts`.

## Ce que le code tranche
- Fenêtre : date >= début et <= fin ; pour l'active seulement, une dépense (montant < 0) après la fin compte (`reporting/domain/period-window.ts:26-34`). Un revenu après la fin est exclu : la paie `pending` à fin + 1 est hors prévu, d'où la règle A limitée aux récurrentes de montant positif (une négative compterait).
- Calculs qui touchent cette pending (positive, datée fin + 1) :
  - Prévu, à venir, composition, solde de départ des stats : exclue par la fenêtre (`load-period-forecast-input.ts:55-61`, `get-period-stats.use-case.ts:78-87`), idem simulation.
  - Répartition du budget (`get-budget-breakdown.use-case.ts:51`), évolution (`get-evolution.use-case.ts:70`), anomalies (`get-anomalies.use-case.ts:62-73`) : même fenêtre, exclue.
  - Dépassements (`period-overruns.ts:23-30`, borne = fin ; `category-overrun.ts:57` ignore les pending), rythme (`spending-pace.ts:48` ignore les pending ; chargement borné à aujourd'hui/fin, `get-spending-pace.use-case.ts:70`), détail d'une étiquette (`get-tag-details.use-case.ts:66-73`, borné à la fin) : exclue.
  - Calendrier (`get-calendar-data.use-case.ts:41-55`, par mois civil) : l'affiche à sa date avec `pending: true`, sans total ; la projection de la même récurrente est écartée car `isRecurringAlreadyPaid` ignore le statut (`recurring-already-paid.ts:4`, appel l. 71-75) : pas de doublon.
  - Prévision de trésorerie (`get-cashflow-forecast.use-case.ts:49-53`) : le solde courant (`sum_transactions_before_date`, `20260308100000_add_sum_transactions_func.sql`, sans filtre `pending`) n'y compte la pending qu'à partir de sa date ; la récurrente est projetée aux jours futurs l. 72-99 sans la pending (future, hors solde) : une seule fois. Le jour même (`d === 0`), la pending déjà dans le solde écarte la projection (l. 83-89). Si la date passe sans pointage, la paie entre dans le solde courant comme toute pending échue (comportement existant).
  - Solde de départ des périodes ultérieures : compte les transactions datées avant leur début (`load-period-forecast-input.ts:46-51`) ; cohérent par dates.
  - Aucun calcul de période ne la compte donc hors de la fenêtre ; le seul risque est un double compte avec une paie saisie à la main (décidé H7).
- Accès : seule la liste Opérations avec « toutes les périodes » (`transactions/page.tsx:61`, pas de `periodId` envoyé, donc pas de fenêtre, `transactions.controller.ts:443-457`) la montre ; le sélecteur de période de l'écran est l'autre point d'entrée. Le lien existant `operationsHref({ ids, allPeriods: true })` (`operations-link.ts:13-22`, déjà utilisé par `anomalies-widget.tsx:107`) suffit : `ids` filtre côté back (`supabase-transaction.repository.ts:177-179`), `period=all` lève la fenêtre. L'id se trouve avec la liste existante (`categoryId`, `pending`, l. 466 et 472 du contrôleur) : pas de nouveau lien ni de nouveau filtre d'URL.
- Rien n'est perdu : les totaux se calculent par dates, pas par `period_id` ; `period_id` n'est rempli qu'à l'insertion, avec l'active sans regarder la date (`20251229111000_add_period_id_to_expenses.sql:15-20`), d'où sa mise à jour explicite (H1).
- Virements de l'app : sans catégorie, jamais `pending` (`create-transfer.use-case.ts:51,61,66,76`) : ne déclenchent pas ; pas de virement récurrent (`recurring-transaction.entity.ts`).
- Chemins de sortie du pending : PATCH simple (`transactions.controller.ts:546-550`), lot (`bulk-update-transactions.use-case.ts:50`), front `transaction-list.tsx:261`, `:299`, `:517-527` ; « À traiter » et Échéances n'appellent aucune modification ; l'import est une création (CA2). `reconciled: true` sort aussi du pending (`pending-rule.ts:12`).
- La détection par `recurringId` est fragile (`metadata` modifiable, `transactions.controller.ts:528`) ; posée à l'injection (`create-period-with-budgets.use-case.ts:90`).
- Posé par le cadreur : écart en jours sur dates sans heure ; date égale au début de l'active = sous le seuil (sinon fin < début).

## Hypothèses
Réellement nouvelles (issues de la règle A), à confirmer ou corriger par Lucas :
- Plusieurs récurrentes dans la catégorie déclencheuse : la prochaine occurrence est la plus proche ; les autres, plus tardives, ne sont pas injectées.
- La règle A ne s'applique qu'aux récurrentes de montant positif ; une récurrente négative de la catégorie est traitée comme les autres (injectée dans la période si elle y tombe, fin = début + 1 mois - 1 jour sans autre récurrente positive).
- Accès direct : une ligne dans « À traiter » de l'écran Aujourd'hui, visible seulement si cette pending existe ; sans changement du sélecteur de période de Opérations.

## Points ouverts
- Où porter le réglage : catégorie ou compte (conception).
- À découper : CA8 (récurrentes à cheval, hors règle A) est indépendant ; le livrer dans son propre commit, avant le déclencheur. Import et sortie du pending peuvent suivre CA2 si le cycle est trop long.

## Précision après le canard (découle de la décision A ; prime sur CA8 (c) pour la prochaine paie)
La prochaine paie est toujours présente en `pending` à fin + 1 jour. Son contrôle de doublon ne regarde pas le mois calendaire : seule compte une transaction de la même récurrente, encore `pending`, datée d'au moins 15 jours après le début de la nouvelle période. La transaction déclencheuse n'est jamais un doublon. Cas testé avant le code : paie du 28 nov. sortie le 1er déc. → nouvelle période 1er → 27 déc., paie du 28 déc. injectée en `pending`, une seule fois.
