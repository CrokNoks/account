# Budgets fixes du compte

## Le problème
À la création d'une période, le montant proposé par catégorie vient de la moyenne historique des dépenses réelles (ou de la somme des récurrentes). Le budget suit donc la dépense : un débordement d'un mois est absorbé dans le suivant et le dépassement n'apparaît jamais. Lucas veut un budget fixe par catégorie, configuré pour le compte.

## Critères d'acceptation
- [ ] CA1 — Étant donné un montant configuré pour la catégorie C, quand Lucas ouvre la création d'une période, alors C est pré-remplie avec ce montant, même si C a des récurrentes ou un historique différent ; les statistiques min/moyenne/max restent affichées à titre indicatif.
- [ ] CA2 — Étant donné une catégorie sans montant configuré (compte sans aucune période, ou catégorie créée après la reprise), quand Lucas ouvre la création d'une période, alors elle est pré-remplie à 0 (ni moyenne historique, ni somme des récurrentes).
- [ ] CA3 — Étant donné un écran dédié du compte, quand Lucas l'ouvre, alors il voit toutes les catégories du compte, chacune avec son montant fixe, peut le modifier et l'enregistrer ; le montant enregistré est revu à la réouverture. Une catégorie non configurée (sans ligne ou ligne à 0) qui a des récurrentes y est pré-remplie avec la somme de leurs montants, proposée seulement : rien n'est enregistré tant que Lucas n'enregistre pas (réouverture sans enregistrer : la proposition est recalculée, la création de période propose toujours 0). Une catégorie non configurée sans récurrente affiche 0.
- [ ] CA4 — Étant donné un compte qui a déjà des périodes, quand la reprise est faite, alors toute catégorie sans ligne de configuration, ou avec une ligne à 0, reçoit le montant de son budget dans la période la plus récente ; les récurrentes ne sont jamais reprises.
- [ ] CA5 — Étant donné une ligne de configuration non nulle, quand la reprise est faite ou rejouée, alors son montant n'est jamais écrasé.
- [ ] CA6 — Étant donné que Lucas modifie un montant dans la création de période avant de valider, alors la période créée prend le montant saisi et la configuration du compte n'est pas modifiée.
- [ ] CA7 — Étant donné un compte A, quand un utilisateur lit ou modifie la configuration d'un compte B auquel il n'a pas accès (ou en lecture seule pour la modification), alors c'est refusé sans écriture.
- [ ] CA8 — Étant donné une modification de la configuration, quand Lucas crée la période suivante, alors elle propose le nouveau montant ; les budgets des périodes déjà créées ne changent pas.

## Règle critique
Montant proposé pour une catégorie = montant configuré s'il existe, sinon 0 (centimes entiers). Il l'emporte toujours sur la somme des récurrentes et sur la moyenne historique. Seconde règle, même calcul : sur l'écran de configuration uniquement, une catégorie non configurée qui a des récurrentes se voit proposer la somme de leurs montants (centimes entiers), sans enregistrement automatique ; une catégorie configurée affiche son montant, jamais la somme. Testée avant le code (`get-period-draft.use-case.spec.ts` pour la création ; test du calcul de la proposition de l'écran, emplacement au choix du développeur), avec les cas : configuré + récurrentes + historique → configuré ; non configuré + récurrentes + historique → 0 en création de période et somme des récurrentes sur l'écran de configuration.

## Mesure d'impact
- Indicateur qui doit bouger : nombre de catégories en dépassement par période (réel plus dépensé que le budget), qui ne doit plus être absorbé par la moyenne.
- Équipe qui en profite : Croissance (maîtrise du budget, argent mieux suivi).
- Comment on le mesure : requête SQL comparant `budget_instances.amount_allocated` au total réel des transactions de la période par catégorie, comptant les catégories en dépassement par période ; à committer en `.sql` ou `.http` avec la fonctionnalité. Point de comparaison : les périodes avant et après la mise en service.

## Exploitation
- À voir en prod : erreurs de lecture/écriture de la configuration dans les logs ; après la reprise, nombre de lignes de configuration par compte.
- Retour arrière : revert du code (le brouillon retrouve la moyenne/récurrentes) ; les lignes de configuration en base restent inertes ; les budgets des périodes créées ne sont jamais modifiés par la configuration.
- Feature flag : non (les montants restent modifiables avant validation, aucune période existante n'est touchée).

## Parties sensibles
- Calcul du montant proposé (création de période et proposition de l'écran de configuration à partir des récurrentes) — calcul métier qui touche l'argent (règle critique).
- Reprise des données (migration) — écriture en masse dans la configuration à partir des budgets existants, par catégorie, montants en centimes BIGINT, sans jamais écraser une ligne non nulle.

## Ce qui change dans l'existant
- Change la règle « Brouillon : montant par défaut d'une catégorie = moyenne historique ; s'il existe des récurrentes… » de `docs/periods.md` (`get-period-draft.use-case.ts:59-75`).
- Lève la zone d'ombre de `docs/budgets.md` : `budget_templates` devient utilisée.
- Les récurrentes injectées en transactions (`injectRecurring`) ne changent pas.

## Chemins d'exposition
- `GET /:accountId/periods/draft-init` : couvert (CA1, CA2, CA8).
- `POST /:accountId/periods` et `PUT :id/budgets` : reçoivent des montants du client, la configuration ne s'y applique pas (CA6).
- Lecture/modification de la configuration (écran dédié) : nouveau chemin, couvert par CA3, CA7, CA8.
- Aucun autre chemin ne lit `budget_templates` (grep : seulement migrations et `supabase/seed.sql`).

## Fichiers concernés
- À modifier : `functions/src/periods/application/get-period-draft.use-case.ts` — règle du montant proposé.
- À modifier : `functions/src/periods/application/get-period-draft.use-case.spec.ts` — remplacer les cas « avgReal » et « récurrentes » par la règle critique.
- À modifier : `functions/src/budgets/domain/budget.repository.interface.ts` et `functions/src/budgets/infrastructure/supabase-budget.repository.ts` (+ `supabase-budget.repository.spec.ts`) — accès à la configuration (emplacement à choisir par le développeur).
- À modifier : `functions/src/periods/infrastructure/periods.controller.ts` — exposition de la configuration (route à définir par le développeur).
- À modifier : `frontend/src/features/periods/ui/create-period-dialog.tsx` — pré-remplissage (lit déjà `defaultAllocated`), stats indicatives.
- À créer : écran dédié du compte pour la configuration (emplacement, route et composant au choix du développeur, en suivant les conventions de `frontend/src/features/`).
- À modifier : `frontend/src/features/periods/model/types.ts`, `frontend/messages/fr.json`, `frontend/messages/en.json` — libellés et types de l'écran.
- À créer : migration de reprise dans `supabase/migrations/` (le projet gère le schéma par migrations SQL horodatées) ; `http/budgets-fixes.http` — vérification réelle ; requête SQL de mesure.
- Existant, sans code : `supabase/migrations/20251229111500_create_budget_templates_table.sql`, `20251230155500_fix_budget_templates_rls.sql`, `20260307000000_migrate_to_v2.sql:58-59`.
- À mettre à jour ensuite : `docs/periods.md`, `docs/budgets.md` (documentaliste).

## Hors périmètre
- Écran de suivi des dépassements (la mesure se fait en SQL).
- Modification automatique des périodes existantes ou propagation d'un changement de configuration vers elles.
- Suppression de la fonction de statistiques historiques.

## Hypothèses
- « Période la plus récente » = celle de fin la plus récente, comme pour le brouillon (`supabase-period.repository.ts:63-71`, tri sur `end_date`). Le code le tranche ; Lucas n'a pas précisé le terme. Une période sans fin (`end_date` NULL) n'est pas créable par l'API (`docs/periods.md`).
- Lignes existantes de `budget_templates` en production (vérifié le 2026-11-05) : 38 lignes dont 36 non nulles, restes jamais utilisés (dernière mise à jour 2026-03-08). Décision de Lucas : la table est vidée avant la reprise (`20261105100000_reset_budget_templates.sql`). Ensuite, au rejeu de la reprise, les lignes à 0 sont remplies et les non nulles gardées (CA4, CA5).
- La colonne `is_fixed` n'est pas utilisée ici (tous les montants configurés sont « fixes »).
- Le signe des montants configurés est celui des budgets de la période (non imposé par le code, `docs/budgets.md`) ; la reprise copie les montants tels quels.
- Interprétation de la correction de Lucas (confirmée par Lucas : « C'est ça ») : la proposition à partir des récurrentes n'existe que sur l'écran de configuration ; elle s'applique aux catégories encore non configurées après la reprise (une catégorie reprise d'un budget de période a déjà un montant et affiche celui-ci).
- Un montant configuré à 0 équivaut à « non configuré » (propose 0 dans les deux cas) ; une ligne à 0 est donc remplissable par la reprise (réponse de Lucas).
- Une catégorie sans budget dans la période la plus récente reste sans ligne (rien à reprendre).
- Droits de la configuration identiques à ceux des périodes (lecture / écriture par RLS du compte).

## Points ouverts
Aucun.
