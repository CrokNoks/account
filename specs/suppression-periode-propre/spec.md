# Supprimer une période proprement (et annuler une bascule)

## Le problème
Supprimer une période garde ses factures `pending` issues des récurrentes (les transactions perdent seulement leur période) : recréer la période avec injection les crée une seconde fois. Une bascule ouverte par erreur n'a pas d'annulation : supprimer la période ouverte ne rouvre pas l'ancienne et laisse la prochaine paie et les récurrentes. Aujourd'hui 0 cas en prod (0 période créée depuis le déclencheur, 0 doublon) : le problème est préventif.

Exemple (bascule par erreur le 25/11, paie 2 800,00 EUR) : la période 25/11 → 24/12 reçoit 3 récurrentes `pending` (assurance 42,00 le 1/12, loyer 750,00 le 5/12, abonnement 15,99 le 10/12) et la prochaine paie `pending` 2 800,00 datée du 25/12 (rattachée à la période par `period_id`, mais datée après sa fin). L'ancienne période a été close le 24/11 (sa fin d'avant : 30/11).

## Critères d'acceptation
- [ ] CA1 — Étant donné la période de l'exemple, quand je la supprime après confirmation, alors ses 4 `pending` générées (3 récurrentes + la prochaine paie, même datée après la fin) sont supprimées avec la période et ses budgets.
- [ ] CA2 — Étant donné la même période, quand je la supprime, alors sont conservées : les transactions pointées, saisies à la main ou importées, la paie déclenchante, et les récurrentes déjà sorties du pending (payées). Une `pending` sans `source: 'recurring'` (saisie à la main, côté de virement) reste aussi. Leur période : voir la règle unique du CA4 (rouverte si annulation de bascule, sinon aucune).
- [ ] CA3 — Étant donné une période à supprimer, quand je clique sur supprimer, alors l'écran annonce le nombre de factures à venir qui seront supprimées et le nombre de transactions conservées, et ne supprime rien avant ma confirmation ; annuler la confirmation ne change rien.
- [ ] CA4 — Étant donné la dernière période du compte, active, ouverte par le déclencheur, quand je la supprime, alors la période qu'elle avait close est rouverte : active, avec la fin qu'elle avait avant la bascule (30/11 dans l'exemple) ; l'écran l'annonce dans la confirmation. **Règle unique de période des transactions conservées** : en annulation de bascule (ce critère), elles sont rattachées à la période rouverte ; dans tous les autres cas (CA5, période non rouverte), elles restent sans période, comme aujourd'hui. Exemple : la paie déclenchante de 2 800,00 EUR (25/11, pointée) et une saisie de 18,50 EUR (27/11) étaient dans la période 25/11 → 24/12 ; après suppression, les deux ont pour période celle rouverte (fin 30/11), les 4 `pending` sont supprimées. Vérifiable : lire ces deux transactions après la suppression, leur période = la rouverte ; dans le cas CA5 leur période est vide.
- [ ] CA5 — Étant donné une période ouverte à la main, non dernière, inactive, ou dont la précédente n'existe plus, quand je la supprime, alors rien n'est rouvert (suppression simple, pending nettoyées).
- [ ] CA6 — Étant donné un import ayant enchaîné 3 bascules (A → B → C → D), quand je supprime D, alors C est rouverte avec sa fin d'avant ; B et A ne bougent pas. Supprimer ensuite C rouvre B, et ainsi de suite.
- [ ] CA7 — Étant donné un accès en lecture seule au compte, quand je supprime une période, alors refus (403) et rien n'est modifié (ni période, ni pending, ni période rouverte). Toute erreur en cours annule tout : jamais de période supprimée avec ses `pending` restantes, ni de pending supprimées avec la période conservée, ni de période rouverte avec l'autre non supprimée.
- [ ] CA8 — Étant donné une période supprimée avec ses `pending`, quand je recrée une période avec `injectRecurring`, alors chaque récurrente n'existe qu'une fois en `pending` (0 doublon).

## Règle critique
Le périmètre exact de ce qui est supprimé avec la période : `pending` vrai ET `metadata.source = 'recurring'` ET `period_id` = la période supprimée, du même compte. Jamais une transaction pointée ou non `pending` (le filtre `pending` est relu dans la transaction de suppression, comme pour le nettoyage d'import). Testée avant le code (SQL + cas du CA1/CA2).

## Mesure d'impact
- Indicateur qui doit bouger : factures `pending` récurrentes en double après recréation de période. Départ : 0 (prod, 2026-11-26). Cible : reste à 0 une fois les bascules et créations avec injection arrivées ; erreurs évitées : bascule défaite en un geste au lieu de 3 corrections à la main.
- Équipe qui en profite : Performance (temps gagné à corriger).
- Comment on le mesure : log `period_deleted` (compte, période, `removedPending`, `keptTransactions`, `reopenedPeriodId` ou null, `origin` manual/trigger), sans libellé ni montant ; requête lecture seule en prod avant/après : `pending` avec `metadata->>'source'='recurring'` groupées par compte, `metadata->>'recurringId'` et mois civil de `coalesce(metadata->>'dueDate', date)`, `having count(*) > 1` (attendu 0 ligne).

## Exploitation
- Log `period_deleted` ; erreurs 403/404/409 existantes.
- Retour arrière : revert du code ; la nouvelle migration ajoute des colonnes nullables (rien à corriger) ; une pending supprimée à tort se recrée en la réinjectant.
- Feature flag : non (suppression derrière confirmation, 0 donnée concernée en prod).

## Parties sensibles
- Suppression atomique de la période, de ses pending, réouverture de la précédente — état des périodes (une seule active, pas de chevauchement) et factures à venir comptées dans le prévisionnel (`docs/reporting.md`) : concurrence/transaction SQL, même brique que `apply_period_switches`.
- Mémorisation à la bascule (fin d'avant) : modifie la fonction `apply_period_switches` (algorithme de bascule).

## Ce qui change dans l'existant
- Change la règle « Supprimer une période supprime ses budgets ; ses transactions perdent leur période (restent) » de `docs/periods.md` : les `pending` récurrentes de la période sont supprimées aussi, et la période précédente est rouverte dans le cas CA4.
- Change la ligne « Supprimer » de la table des actions (`DELETE`, 204) : refus 403 en lecture seule (aujourd'hui un `DELETE` sans droit ne touche aucune ligne et répond 204 sans erreur : `supabase-period.repository.ts:191-193`).
- Change la règle de la bascule : elle mémorise désormais l'origine et la fin d'avant de la période close. Ne change pas : seuil, règle A, injection, rattachement, création manuelle sans contrôle de doublon (décision Lucas, `docs/periods.md`).

## Fichiers concernés
- À modifier : `functions/src/periods/infrastructure/periods.controller.ts` (`remove`, l. 253-263 ; route d'aperçu de suppression)
- À modifier : `functions/src/periods/domain/period.repository.interface.ts`, `functions/src/periods/infrastructure/supabase-period.repository.ts` (`delete` l. 191 ; `closeEnd` l. 156 : transmettre la fin d'avant)
- À modifier : `functions/src/periods/application/apply-period-switch.service.ts` (l. 234-256 : fin d'avant de la période close) et `functions/src/periods/domain/period-switch.ts` (l. 462-468, chaînage de l'import)
- À modifier : `frontend/src/features/periods/ui/period-list.tsx` (`handleDelete` l. 48), `frontend/src/features/periods/api/use-delete-period.ts`, `frontend/messages/fr.json` et `en.json` (`confirm_delete`, l. 535)
- À créer (Glob : absents) : migration `supabase/migrations/2026112…_delete_period_clean.sql` (le projet gère le schéma par migrations ; remplace `apply_period_switches`, ajoute la mémoire de bascule et la fonction de suppression) ; `supabase/tests/delete_period_test.sql` ; `functions/test/periods-deletion.e2e-spec.ts` ; `functions/http/suppression-periode.http` ; `functions/src/periods/application/delete-period.use-case.spec.ts`
- Tests existants à compléter : `functions/src/periods/application/apply-period-switch.service.spec.ts`, `functions/src/periods/infrastructure/supabase-period.repository.spec.ts`, `supabase/tests/period_trigger_test.sql`, `frontend/src/features/periods/ui/period-list.test.tsx`

## Hors périmètre
- Corriger la paie déclenchante après annulation (Lucas la corrige).
- Annuler une bascule autrement que par la suppression de la dernière période ; bouton « annuler la bascule » distinct.
- Reprise des périodes existantes (aucune bascule en prod : elles sont traitées comme manuelles).
- Contrôle de doublon à la création manuelle (décision Lucas inchangée) ; verrou contre une bascule concurrente au-delà de ce que l'unicité active et le non-chevauchement garantissent déjà.

## Hypothèses
- Chemins d'exposition : seuls `DELETE /:accountId/periods/:id` et son écran (liste « Gérer les périodes ») suppriment une période ; la suppression d'un compte (cascade) ne passe pas par cette règle.
- « Générée par la période » = `period_id` de la période (pas la fenêtre de dates) : cela couvre la prochaine paie datée après la fin et ne touche pas une `pending` rattachée à une autre période. Une `pending` récurrente dont le montant a été modifié à la main est supprimée aussi (elle est comptée dans l'annonce).
- Le nombre annoncé à l'écran est celui lu à l'ouverture de la confirmation ; la suppression applique la règle au moment où elle s'exécute (une pending pointée entre-temps reste).
- La réponse du DELETE reste 204 sans corps ; l'aperçu est une lecture séparée.
- Mémoriser à la bascule, pour la période ouverte : « ouverte par le déclencheur », la période close et sa fin d'avant (nullable). Pour l'import chaîné (CA6), la « fin d'avant » de C est la fin de B telle qu'insérée par la même opération.
- Réouverture (décision 3 de Lucas : seulement si la période supprimée est active) ; en plus : la dernière du compte (même règle `hasNewerPeriod`), et si la période close existe encore et sera la dernière après suppression : ordre dans la transaction = supprimer d'abord, puis rouvrir (compatible avec « une seule active » et « pas de chevauchement »). La fin posée à la réouverture écrase une fin modifiée à la main depuis la bascule.
- `docs/` et le code tranchent : un côté de virement `pending` n'a pas `source: 'recurring'` (`docs/periods.md`, règle virement) donc reste.

## Décisions de Lucas (`besoin.md`, « Décision 1 », 2026-11-26)
1. Annulation de bascule : les transactions conservées sont rattachées à la période rouverte ; hors annulation, elles restent sans période (règle unique, CA2/CA4/CA5).
2. Annonce à l'écran : nombres seulement (factures à venir supprimées, transactions conservées, période rouverte), sans montants.
3. Réouverture seulement si la période supprimée est encore active ; sinon simple suppression avec nettoyage des factures générées.

## Points ouverts
- Aucun.
