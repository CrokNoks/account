# Virements : modifier ou supprimer un côté fait suivre l'autre

## Le problème
Un virement = deux transactions liées par `metadata.transferId` (sortie négative sur la source, entrée positive sur la destination). Aujourd'hui, modifier ou supprimer un côté laisse l'autre intact : argent sorti sans arriver, ou l'inverse, et les soldes des deux comptes divergent. Prod au 2026-11-26 : 3 virements, 0 orphelin, 0 désaccordé. Le risque est préventif.

## Critères d'acceptation
- [ ] CA1 — Montant. Virement de 50 € (−5000 sur A, +5000 sur B). Je passe le côté A à −8000 : B passe à +8000, dans la même opération. Depuis B (+8000), A passe à −8000. Chaque côté garde son signe.
- [ ] CA2 — Montant refusé. Sur le côté sortie, un montant ≥ 0 (ex. +8000 ou 0) est refusé (400) ; sur le côté entrée, un montant ≤ 0 aussi. Rien n'est écrit sur aucun des deux comptes.
- [ ] CA3 — Date. Je change la date d'un côté (2026-11-20 → 2026-11-22) : l'autre côté prend la même date. La période de chaque côté ne change pas (comme une modification simple aujourd'hui) ; il n'y a jamais de bascule.
- [ ] CA4 — Suppression simple : supprimer un côté supprime l'autre.
- [ ] CA5 — Suppression en lot : un lot contenant un seul côté supprime aussi l'autre ; un lot contenant les deux côtés les supprime une seule fois, sans erreur. Les autres lignes du lot sont supprimées comme avant.
- [ ] CA6 — Droits. Si l'autre compte n'est pas en écriture pour moi (partage `read` ou aucun accès), la modification de montant/date et la suppression sont refusées (403 ; 404 si le compte m'est invisible), et rien n'est écrit, y compris sur le compte que je voulais toucher. Pour une suppression en lot, un seul refus annule tout le lot.
- [ ] CA7 — Tout ou rien. Si l'écriture de l'un des deux côtés échoue, aucun des deux n'est modifié ni supprimé.
- [ ] CA8 — Champs propres à chaque côté. Pointage, `pending`, catégorie, notes, libellé, tags d'un côté ne touchent jamais l'autre. La modification en lot (catégorie, tags, pointé, pending seulement) n'est donc pas concernée : elle ne change ni montant ni date.

## Règle critique
Après toute modification de montant ou de date, ou toute suppression, les deux côtés d'un virement sont encore cohérents (montants opposés, même date) ou ont tous deux disparu, et rien n'est écrit si l'utilisateur n'a pas le droit d'écriture sur les deux comptes. Test écrit avant le code : modifier −5000 / +5000 en −8000 donne −8000 / +8000 ; avec l'autre compte en `read`, rien ne bouge.

## Mesure d'impact
- Indicateur : nombre de virements orphelins (un seul côté) ou désaccordés (montants qui ne s'annulent pas, ou dates différentes). Départ 2026-11-26 : 3 virements, 0 orphelin, 0 désaccordé. Cible : reste à 0.
- Équipe : Performance (erreurs évitées, soldes justes).
- Mesure : requête lecture seule `specs/virements-deux-cotes/mesure.sql` (`begin read only`), regroupée par `transferId`. Elle suit les virements créés avant et après la mise en prod.

## Exploitation
- Journal `info` à chaque propagation (nombre de côtés touchés, ids, jamais libellé ni montant) ; refus de droits en `warn`.
- Retour arrière : revert du déploiement ; aucune donnée à corriger, aucune migration (décision de Lucas au contrôle 1).
- Feature flag : non (Lucas a demandé la version courte ; seuls les virements sont touchés).

## Parties sensibles
- Écriture atomique sur deux comptes : argent, deux lignes à écrire ensemble (point de contrôle).
- Droit d'écriture sur le compte d'un autre utilisateur : traité en critère (CA6), pas une partie sensible en soi.

## Ce qui change dans l'existant
- `docs/transactions.md`, « Modification : seuls les champs fournis changent » : pour une transaction de virement, montant et date se propagent à l'autre côté.
- « Modification/suppression en lot » et suppression simple : supprimer un côté supprime l'autre.
- Modification simple : `metadata` ne peut plus casser le lien (voir hypothèses).
- Corrige un écart du besoin : la règle « période par date » n'existe pas à la modification. Le trigger `assign_period_id` est `BEFORE INSERT` seulement et ne regarde pas la date (`docs/periods.md`, ligne « période_id vide »).

## Fichiers concernés
- Modifier : `functions/src/transactions/infrastructure/transactions.controller.ts` — modification simple (`:587-662`) et suppression simple (`:664-678`) passent par la règle des deux côtés.
- Modifier : `functions/src/transactions/application/bulk-delete-transactions.use-case.ts` — compléter le lot avec les autres côtés, droits, tout ou rien.
- Modifier : `functions/src/transactions/domain/transaction.repository.interface.ts` et `functions/src/transactions/infrastructure/supabase-transaction.repository.ts` — recherche de l'autre côté par `transferId`, écriture atomique de deux lignes, suppression de plusieurs.
- Créer : nouveau cas d'usage de modification d'un virement (aucun `update-transaction.use-case.ts` n'existe : la logique est dans le contrôleur) et sa spec.
- Créer : `supabase/migrations/2026…_atomic_update_transfer.sql` — fonction SQL `SECURITY INVOKER` (le dossier de migrations existe, schéma géré par migrations). Seulement si `update_transactions` ne couvre pas montant et date.
- Créer : `specs/virements-deux-cotes/mesure.sql` — requête de mesure ; `functions/http/virements-deux-cotes.http` — vérification en réel (deux comptes, partage `read`).
- Tests : `functions/src/transactions/application/bulk-delete-transactions.use-case.spec.ts`, `create-transfer.use-case.spec.ts` (modèle des droits), `supabase-transaction.repository.spec.ts`, e2e `functions/test/transactions.e2e-spec.ts` et `cross-account-references.e2e-spec.ts`.
- Front : aucun changement requis (les invalidations de modification et de suppression existent, `docs/transactions.md` « rafraîchissement »). Le toast d'erreur affiche un message inconnu en texte de repli : ajouter les nouveaux messages d'API à la table `ApiErrors` de `frontend/messages/{fr,en}.json` (à vérifier).

## Chemins d'exposition
| Chemin | Couvert |
| --- | --- |
| `PATCH /:accountId/transactions/:id` (montant, date, metadata) | CA1 à CA3, CA6, CA7 |
| `DELETE /:accountId/transactions/:id` | CA4, CA6, CA7 |
| `DELETE /:accountId/transactions/bulk` | CA5, CA6, CA7 |
| `PATCH /:accountId/transactions/bulk` | CA8 : ne touche ni montant ni date, rien à propager |
| `POST /transactions` et `POST /transactions/bulk` avec une `metadata.transferId` imposée | hors périmètre (voir hypothèses) |
| Suppression d'un compte (CASCADE sur ses transactions) | hors périmètre ; peut créer un orphelin que la mesure comptera |

## Hors périmètre
- Réparer des virements déjà orphelins ou désaccordés (il n'y en a pas en prod).
- Modifier le libellé, le pointage, `pending`, la catégorie ou les notes d'un côté vers l'autre.
- Suppression d'un compte avec ses virements ; création de transactions avec un `transferId` choisi à la main.
- Modifier le compte d'un virement.

## Hypothèses
Non confirmées par Lucas (« Go recos » couvre les 3 réponses du besoin, pas ces détails) :
- Montant de signe contraire ou nul : refusé (400), cohérent avec la création (« strictement positif », `create-transfer.use-case.ts:34`).
- Autre côté introuvable alors que le compte lié est en écriture (orphelin) : on modifie ou supprime le seul côté restant. Un refus empêcherait de nettoyer un orphelin.
- Droit : on le contrôle sur le compte lié (`relatedAccountId`), comme `ensureCanWriteTo` : propriétaire ou partage `write`. Sans cela, un compte invisible par la RLS ressemblerait à un orphelin et l'autre côté resterait.
- L'autre côté = la ligne du compte lié, de type opposé, avec le même `transferId`. Si le lien est ambigu (plusieurs lignes, types incohérents), refus (409) plutôt que deviner.
- Modifier `metadata` d'un côté en changeant ou retirant `transferId`, `type` ou `relatedAccountId` : refusé (400).
- Un côté pointé : son montant et sa date suivent quand même l'autre côté (pointage propre à chaque côté, sans blocage).
- Concurrence : deux modifications simultanées des deux côtés sont écrites chacune en bloc, donc jamais désaccordées ; la dernière gagne.
- Effet sur le prévisionnel : une date déplacée peut faire sortir un côté de sa fenêtre de période et pas l'autre. Exemple : période active finissant le 2026-11-30, date → 2026-12-05 : la sortie (négative) y reste, l'entrée (positive) en sort (règle de fenêtre existante, `docs/transactions.md`). Pas de bascule : un virement n'a pas de catégorie déclencheuse (`docs/periods.md`).

## Points ouverts
Aucun bloquant : toutes les hypothèses ont une recommandation.
À trancher (si Lucas veut passer outre mes recommandations) :
1. Montant de signe contraire ou 0 : refuser (recommandé) ou inverser le signe d'office. Inverser peut transformer une faute de frappe en virement dans l'autre sens.
2. Orphelin : modifier/supprimer le côté restant (recommandé) ou refuser.
3. Côté pointé de l'autre compte : suivre (recommandé, pas de blocage) ou refuser tant qu'il est pointé (protège un relevé déjà vérifié, mais empêche la correction).
