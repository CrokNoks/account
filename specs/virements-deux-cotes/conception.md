# Conception — virements à deux côtés (partie sensible : écriture atomique sur deux comptes)

## Ce que ça décide
Entrées : un côté de virement (compte de l'URL + id), une modification de montant/date ou une suppression (simple ou lot), l'utilisateur. Sortie : soit les deux côtés écrits ensemble (montants opposés, même date) ou supprimés ensemble, soit une erreur et rien d'écrit.

## Constats sur l'existant (lus dans le code)
- RLS `transactions` : SELECT = `has_account_access(account_id,'read')`, INSERT/UPDATE/DELETE = `'write'`. **Un UPDATE ou DELETE direct sur une ligne en lecture seule ne lève rien : 0 ligne touchée, en silence.** Donc `deleteMany`/`delete` seuls ne protègent pas : le contrôle de droits doit se faire AVANT, dans le cas d'usage (modèle `ensureCanWriteTo` de `create-transfer.use-case.ts`).
- `update_transactions` (SECURITY INVOKER) passe par `upsert_transactions` (`INSERT … ON CONFLICT DO UPDATE`). Sur une ligne non modifiable, le contrôle RLS lève 42501, que `toDomainError` traduit en 403 `You do not have permission to modify this resource`, et tout est annulé. C'est un filet de sécurité (défense en profondeur), pas le contrôle principal (message peu précis, et un compte invisible donnerait P0002/404).
- `update_transactions` remplace aussi les tags des lignes écrites : le payload de l'autre côté doit porter ses `tagIds` actuels (lus avec la ligne).
- `ensureCanWriteTo` est privé à `CreateTransferUseCase` ; la règle devra servir à 3 chemins (création, modification, suppression) : elle s'extrait une fois (voir Structure).
- La modification simple (contrôleur `:587-662`) appelle `periodSwitch.process` puis `save`. Un virement n'a pas de catégorie, donc pas de bascule (spec CA3).

## Approche retenue : pas de migration
`update_transactions([côté modifié, autre côté])` couvre montant et date des deux lignes en une transaction base. La suppression de plusieurs lignes est déjà atomique (`deleteMany` = un seul `DELETE … IN`, une instruction SQL) et ne demande aucune fonction nouvelle. **Aucune migration** : le « Fichiers concernés » de la spec la prévoyait « seulement si update_transactions ne couvre pas » ; elle la couvre. (La phrase « la migration ajoute seulement une fonction » du retour arrière devient « aucune migration » ; à corriger dans la spec par l'orchestrateur, je ne la modifie pas.)

## Structure (relecture limitée à ces fichiers)
1. `domain/transfer-link.ts` — **fonctions pures**, sans I/O :
   - `findOtherSide(self, candidates)` : candidats = lignes du compte lié ayant le même `transferId`. 0 → `null` (orphelin) ; 1 de type opposé (`transfer_in` ↔ `transfer_out`) → la ligne ; sinon (≥ 2, type identique, `relatedAccountId` ne pointant pas vers le compte de `self`) → `ConflictError` 409.
   - `checkTransferAmount(self, cents)` : sortie → `< 0` exigé ; entrée → `> 0` exigé ; sinon `DomainValidationError` 400.
   - `checkMetadataKeepsLink(existingMetadata, providedMetadata)` : si `transferId`, `type` ou `relatedAccountId` change ou disparaît → 400. Un `metadata` sans lien à l'origine (non-virement) n'est pas contrôlé.
   - `planTransferUpdate(self, other, {amount?, date?})` : renvoie les deux lignes à écrire (l'autre : montant `-nouveauMontantDeSelf`, date de self ; reste inchangé). Pas de changement effectif de montant/date → `null` (rien à propager).
2. `application/transfer-write-access.service.ts` — extrait `ensureCanWriteTo(accountId, userId, label)` (code actuel de create-transfer, même 404/403, libellé du compte paramétré). `create-transfer.use-case.ts` l'appelle (comportement identique, test existant inchangé).
3. `application/update-transfer.use-case.ts` (nouveau) et `application/delete-transfer-sides.ts` ou intégration dans `bulk-delete-transactions.use-case.ts` + contrôleur (suppression simple).
4. Dépôt : `findTransferSides(transferId, accountId)` (lecture RLS du compte lié, avec tags). Écriture : `updateMany` et `deleteMany` existants, aucune nouvelle méthode d'écriture.

## L'algorithme

### Modification simple (PATCH)
1. Charger `existing` (ensureBelongsToAccount, 404 comme avant). Si `metadata.transferId` est absent : chemin actuel, inchangé.
2. Si le DTO fournit `metadata` : `checkMetadataKeepsLink` → 400 (même si montant/date absents, car le lien serait cassé).
3. `amount`/`date` effectifs de self calculés comme aujourd'hui (`resolvePending`, parse). Si ni le montant ni la date ne **changent réellement** (valeur fournie différente de l'existante) : chemin actuel (`save`), l'autre côté n'est pas lu, aucun droit exigé (CA8).
4. Montant fourni : `checkTransferAmount` → 400 avant toute lecture de l'autre compte.
5. `ensureCanWriteTo(relatedAccountId, userId)` : 404 si compte invisible, 403 si `read`/aucun (rien n'est écrit, y compris sur self). warn en cas de refus.
6. `findOtherSide` : 409 si ambigu ; `null` (orphelin) → écrire seulement self (`save`), log info `orphan`.
7. `updateMany([self modifié, autre modifié])` : une transaction ; toute erreur annule les deux (CA7). Pas de `periodSwitch` pour la branche virement (spec : jamais de bascule). Réponse : self relu (`readBack` via le dépôt).

### Suppression simple et en lot
1. Lot : vérification actuelle (ids du compte, 404 sinon). Garder les lignes chargées (`findAllByAccountUnpaginated`) ; ce sont les côtés « self ».
2. Pour chaque côté portant un `transferId` : regrouper par compte lié ; `ensureCanWriteTo` **une fois par compte lié** (un seul refus = rien supprimé, CA6).
3. Pour chaque côté : `findOtherSide` (409 si ambigu : annule tout le lot) ; ajouter l'id trouvé à l'ensemble d'ids (`Set` : un lot contenant les deux côtés les supprime une fois, CA5).
4. Un seul `deleteMany(ids)` (une instruction SQL). Après : le dépôt renvoie le nombre de lignes supprimées (`.select('id')`) et, si inférieur au nombre attendu, on lève une erreur (filet contre la RLS silencieuse et la suppression concurrente) ; l'instruction étant atomique, rien n'est alors supprimé.
5. Suppression simple = lot d'un seul id (même code, une seule règle).

## Cas particuliers retenus
- Pointé ⊕ pending : on ne copie jamais `reconciled` ni `pending` d'un côté vers l'autre ; la ligne de l'autre côté est réécrite avec ses valeurs lues (la contrainte `not_reconciled_and_pending` ne peut donc pas être violée par la propagation). Pointer self (`resolvePending`) ne touche pas l'autre. Un côté pointé de l'autre compte suit montant et date (Décision 1.3).
- Période : `period_id` des deux lignes n'est pas modifié (trigger `BEFORE INSERT` seulement, la ligne existante conserve le sien). Un côté peut sortir de la fenêtre du prévisionnel, pas l'autre : accepté (hypothèse de la spec).
- Bascule : jamais, la branche virement ne passe pas par `periodSwitch`. Conséquence assumée : pointer un côté en attente ET changer le montant/la date dans la même requête ne remet pas la date au jour (un virement n'a pas de catégorie déclenchante, `docs/periods.md`).
- Orphelin : on modifie/supprime le côté restant après contrôle de droits sur `relatedAccountId` (Décision 1.2). Un compte lié supprimé (CASCADE) ou invisible : 404 sans toucher à rien.
- Montants : centimes entiers (`bigint`), jamais de flottant ; signe vérifié, jamais inversé d'office.
- Concurrence : `update_transactions` réécrit les lignes entières ; deux modifications simultanées ne laissent jamais les côtés désaccordés (chacune écrit les deux d'un coup), la dernière gagne. Fenêtre résiduelle : une modification de note/tags de l'autre côté faite entre notre lecture et notre écriture est écrasée par la valeur lue (quelques ms ; acceptée, comme pour toute modification simple aujourd'hui sur la ligne propre).

## Exploitation
- `info` : `transfer_sync { operation: 'update'|'delete', transferId, ids: [...], sides: 1|2 }` ; `info` `transfer_orphan_handled` ; `warn` `transfer_sync_denied { transferId, relatedAccountId, reason: 'forbidden'|'not_found' }`. Jamais de libellé, de montant ni d'e-mail.
- Retour arrière : revert du déploiement, aucune donnée à corriger, aucune migration. Pas de feature flag (décision de Lucas dans la spec).
- Ordre de déploiement : API seule (le front n'a rien à changer ; seul le texte des erreurs, voir incrément 3). Compatibilité : les routes et formes de réponse ne changent pas ; les seules nouveautés visibles sont les refus 400/403/404/409 sur des virements.

## Alternative écartée
Fonction SQL dédiée `update_transfer_sides(p_id, p_other_id, p_amount, p_date)` qui met à jour uniquement montant et date des deux lignes (aucune réécriture de notes/tags, droits vérifiés en SQL). Plus précise (zéro fenêtre d'écrasement) mais une migration à appliquer en production, plus de SQL à relire, et le contrôle de droits reste à faire côté API pour obtenir 403/404 propres. Reprendre cette option seulement si la fenêtre d'écrasement est jugée gênante.

## Cas de test (écrits avant le code)
| # | Cas | Attendu | Niveau |
| --- | --- | --- | --- |
| 1 | CA1 : −5000/+5000, côté A → −8000 | A −8000, B +8000 en un seul `updateMany` de 2 lignes | use case |
| 2 | CA1 depuis B : +8000 | A −8000, B +8000 | use case |
| 3 | CA2 : sortie à +8000 ou 0 ; entrée à −1 ou 0 | 400, `updateMany` et `save` jamais appelés, autre compte jamais lu | use case |
| 4 | CA3 : date 11-20 → 11-22 sur un côté | l'autre prend 11-22 ; `period_id` des deux inchangé ; pas de `periodSwitch` | use case + e2e |
| 5 | CA4 : suppression simple d'un côté | les deux ids passent dans un seul `deleteMany` | use case |
| 6 | CA5 : lot avec un seul côté, lot avec les deux côtés, lot mêlé à des lignes ordinaires | l'autre est ajouté ; ids dédoublonnés ; une seule suppression, pas d'erreur | use case |
| 7 | CA6 : autre compte en partage `read` (modification puis suppression) | 403, rien écrit/supprimé sur aucun compte | use case + e2e |
| 8 | CA6 : autre compte invisible (aucun accès) | 404 (et non 403), rien écrit | use case + e2e |
| 9 | CA6 lot : 3 lignes dont une seule d'un virement vers compte `read` | 403, aucune des 3 supprimée | use case + e2e |
| 10 | CA6 : propriétaire du compte lié ; partage `write` | autorisé | use case |
| 11 | CA7 : `updateMany` échoue (RLS 42501 simulé, P0002) | erreur propagée (403/404), aucun côté modifié ; test dépôt : la fonction SQL annule les deux lignes | use case + repo/e2e |
| 12 | CA7 suppression : `deleteMany` supprime moins de lignes que prévu | erreur, rien supprimé (atomique) | repo |
| 13 | CA8 : PATCH sans montant ni date (libellé, notes, catégorie, tags, `reconciled`, `pending`) | autre côté non lu, non modifié ; aucun contrôle de droits (marche même avec le compte lié en `read`) | use case + e2e |
| 14 | CA8 : montant/date fournis mais identiques à l'existant | traité comme sans changement : pas de droit exigé, pas d'écriture de l'autre côté | use case |
| 15 | CA8 : bulk update (catégorie, tags, pointé, pending) sur un côté | inchangé, autre côté intact | e2e (existant à compléter) |
| 16 | Pointé ⊕ pending : changer le montant d'un côté pointé, l'autre côté en pending | les deux suivent ; `reconciled`/`pending` de chacun conservés ; contrainte CHECK respectée | e2e |
| 17 | Orphelin : l'autre côté est absent, compte lié en écriture | seul le côté restant est modifié/supprimé | use case |
| 18 | Orphelin, compte lié en `read` | 403 | use case |
| 19 | Lien ambigu : 2 lignes candidates, ou 1 ligne du même type | 409, rien écrit (modification, suppression, lot entier) | fonction pure + use case |
| 20 | Metadata : retirer `transferId` ; changer `type` ; changer `relatedAccountId` ; metadata ajoutant une autre clé en gardant le lien | 400 ×3 ; le 4e passe | fonction pure + use case |
| 21 | Transaction non virement (sans `transferId`) | comportement actuel strictement inchangé (PATCH/DELETE/lot) | use case + e2e existants |
| 22 | Mauvais compte dans l'URL / id inconnu | 404 comme avant | existants |
| 23 | `create-transfer.use-case.spec.ts` après extraction de `ensureCanWriteTo` | inchangé (404 puis 403) | existant |
| 24 | Messages : les nouveaux textes d'API sont dans la table `ApiErrors` fr/en | clé présente dans les deux fichiers et dans la table exacte | front (test existant de la table s'il y en a un) |

## Fichiers sensibles (relecture contrôle 2)
- `functions/src/transactions/domain/transfer-link.ts` (+ spec)
- `functions/src/transactions/application/update-transfer.use-case.ts` (+ spec)
- `functions/src/transactions/application/bulk-delete-transactions.use-case.ts` (+ spec) et la suppression simple du contrôleur
- `functions/src/transactions/application/transfer-write-access.service.ts` (extraction) et la mise à jour de `create-transfer.use-case.ts`
- `supabase-transaction.repository.ts` : `findTransferSides` et le décompte de `deleteMany` (+ spec)
- Branche PATCH du contrôleur (`:587-662`) : aiguillage vers le cas d'usage uniquement.

## Ordre des commits (3 de code)
1. **Règle critique, modification** : `transfer-link.ts`, service de droits extrait, `update-transfer.use-case.ts`, `findTransferSides`, aiguillage du PATCH, ApiErrors des erreurs 400/409 liées, tests (cas 1 à 4, 7, 8, 10, 11, 13, 14, 16 à 20, 21, 23). Sensible : contrôle 2 avant commit.
2. **Suppression** : suppression simple et en lot (cas 5, 6, 9, 12, 17 à 19, 21). Sensible, relu avec le 1 si Lucas préfère un seul contrôle 2.
3. **Non sensible (mode standard, sans dépendre des deux autres pour le code)** : messages d'API fr/en, `specs/virements-deux-cotes/mesure.sql`, `functions/http/virements-deux-cotes.http` (committé avec la fonctionnalité, via fixup), e2e. Les messages et `mesure.sql` peuvent partir tout de suite ; le `.http` et les e2e attendent les commits 1 et 2.

## Messages à ajouter (table `EXACT` de `frontend/src/shared/api/mutation-error.ts` + `ApiErrors.exact` de `frontend/messages/{fr,en}.json`)
- 409 : « This transfer is linked to several transactions, nothing was changed » / « Ce virement est lié à plusieurs transactions : rien n'a été modifié ».
- 400 (signe) : « Transfer amount must be negative on the outgoing side » et « … positive on the incoming side ».
- 400 (metadata) : « The transfer link cannot be changed ».
- 403 : « Write access to the other account of the transfer is required » (l'actuel « Write access to the destination account is required » n'est lui-même pas dans la table : à ajouter aussi, écart existant).
- 404 : « Other account of the transfer not found » (ou réutiliser `Account not found` : à trancher).
Les textes anglais exacts sont figés dans le code ; la table front doit les citer à l'identique.

## À trancher par Lucas
1. **Pas de migration** (`update_transactions` + `deleteMany` existants) au lieu de la fonction SQL dédiée de la spec. Recommandé : oui.
2. **« Changement » = valeur différente de l'existante** : un PATCH qui renvoie le même montant/date (formulaire d'édition complet) ne propage pas et n'exige pas de droit, donc un utilisateur avec un compte lié en `read` peut encore éditer libellé et notes. Alternative : propager dès que le champ est fourni (plus strict, bloque ces éditions). Recommandé : valeur différente.
3. **Pas de bascule ni de remise de la date au jour** pour un côté de virement, même si la requête sort le côté du pending. Recommandé : oui (cohérent avec CA3 et avec la mesure « dates différentes »).
4. **Décompte de `deleteMany`** : le dépôt compte les lignes supprimées et lève une erreur si moins que prévu. Ajoute un `.select('id')` à un code existant utilisé aussi par les autres suppressions. Recommandé : oui, car la RLS échoue en silence.
5. **Extraction de `ensureCanWriteTo`** dans un service partagé (touche `create-transfer.use-case.ts`, comportement identique). Recommandé : oui (règle écrite une fois).
6. **Texte 404 du compte lié** : message dédié ou « Account not found » existant.

## Validé par Lucas (contrôle 1, 2026-11-26 : « Go ») ; prime sur ce qui précède
1. Pas de migration : `update_transactions` et `deleteMany` existants (risque d'écrasement de notes/étiquettes de l'autre côté en cas d'écritures simultanées, accepté).
2. « Changement » = valeur différente de l'existante : renvoyer le même montant ou la même date ne propage rien et n'exige aucun droit.
3. Aucune bascule ni date du jour pour un côté de virement qui sort du `pending`.
4. Les suppressions comptent les lignes réellement supprimées et refusent si une ligne a été ignorée en silence (code partagé avec les autres suppressions).
5. Compte lié invisible : message existant « Account not found » (404), pas de message dédié.
La phrase de la spec « la migration ajoute seulement une fonction » (retour arrière) devient « aucune migration ».

## Validé par Lucas (contrôle 2, 2026-11-26 : « Commit »)
Suppression partielle acceptée : le décompte de `deleteMany` détecte une ligne ignorée par la RLS (403) mais n'annule pas les autres ; le contrôle de droits fait avant l'écriture ferme ce cas en pratique. Pas de fonction SQL dédiée.
