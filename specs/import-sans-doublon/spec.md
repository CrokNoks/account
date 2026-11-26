# Import sans doublon

## Le problème
Réimporter un relevé (ou un relevé qui chevauche le précédent) recrée toutes les lignes une seconde fois : l'import ne contrôle rien. Les doublons faussent soldes, prévu et périodes (l'import est aussi le chemin de la bascule et du nettoyage des `pending` récurrentes), et ne sont signalés qu'après coup par les anomalies (dépenses de 5 € ou plus seulement). Mesure de départ, prod, 2026-11-26 : 39 groupes de transactions identiques, 61 lignes en trop, sur 3 comptes (mélange de vrais doublons et d'achats identiques réels).

## Vocabulaire
- **Libellé comparé** : `cleanDescription` (espaces réduits, bords retirés, `import-csv.ts:74`) puis minuscules et accents retirés. Rien d'autre (la ponctuation, les chiffres et le bruit bancaire comptent : on ne reprend pas `extractWords` de la prédiction, trop large pour décider d'un doublon).
  Ex. : « CB  Café Paul » = « cb cafe paul » ; « CB CAFE PAUL 12/11 » ≠ « CB CAFE PAUL ».
- **Ligne identique** : même date, même montant (centimes), même libellé comparé.
- **Ligne proche** : même montant, date à 1 à 3 jours d'écart, et qui n'est pas identique (libellé différent, ou libellé identique à un autre jour). La catégorie n'est pas une condition (celle de la ligne du relevé est une prédiction).
- **Ligne de base comparée** : transaction du compte **non `pending`**, datée entre (première date du fichier − 3 jours) et (dernière + 3 jours). Les `pending` (factures récurrentes à venir) sont exclues : une récurrente « Loyer » en attente n'est pas la ligne du relevé, et la décocher casserait le nettoyage à l'import (`docs/periods.md`).

## Critères d'acceptation
- [ ] CA1 — Étant donné un relevé dont une ligne est identique à une transaction du compte, quand j'arrive à l'étape de validation, alors la ligne est décochée par défaut et marquée « Déjà présente » avec la transaction trouvée (date, libellé).
- [ ] CA2 — Étant donné deux cafés identiques le même jour dans le relevé et un seul en base, alors une ligne est décochée et l'autre cochée ; avec deux en base, les deux sont décochées ; avec un seul dans le relevé et deux en base, elle est décochée. (Chaque transaction de base ne « consomme » qu'une ligne du relevé, dans l'ordre du fichier.)
- [ ] CA3 — Étant donné une ligne proche (saisie à la main « Boulangerie −8,50 € » le 25, relevé « CB BOULANGERIE PAUL −8,50 € » le 26), alors la ligne reste cochée et porte un signalement « Ligne proche » avec la transaction concernée ; je décide à l'écran. Une ligne déjà appariée à une identique n'est jamais signalée proche de la même transaction.
- [ ] CA4 — Je peux recocher une ligne décochée : elle est alors importée comme n'importe quelle autre. Rien n'est refusé par le serveur.
- [ ] CA5 — Seules les lignes cochées et valides sont envoyées à l'import ; le bouton « Confirmer l'import » est désactivé s'il n'y en a aucune ; le bandeau et le toast final donnent séparément : importées, ignorées (illisibles), écartées (déjà présentes).
- [ ] CA6 — Une ligne illisible (montant ou date) n'est jamais comparée ni comptée comme doublon : elle garde son comportement actuel.
- [ ] CA7 — Une paie ou une facture écartée comme doublon ne déclenche ni bascule ni nettoyage de `pending` (elle n'est pas envoyée) ; recochée, elle les déclenche comme aujourd'hui.
- [ ] CA8 — Si les transactions existantes ne peuvent pas être lues, l'import reste possible, aucune ligne n'est décochée, et un avertissement le dit (comme l'échec de la prédiction).
- [ ] Textes, bandeau et pluriels en fr et en (espace i18n `Import`).

## Règle critique
Le décompte des occurrences : une ligne n'est décochée que s'il existe en base une transaction identique **non déjà consommée** par une autre ligne du relevé. Une ligne décochée à tort = un achat réel perdu en silence ; une ligne cochée à tort = un doublon (état actuel). Testée avant le code (modèle pur, sans écran) : 2 relevé / 1 base → 1 décochée ; 2/2 → 2 ; 1/2 → 1 ; `pending` en base ignorée ; mêmes lignes dans un autre compte ignorées (la base lue est celle du compte importé).

## Mesure d'impact
- Indicateur qui doit bouger : lignes importées en double (identiques créées après la mise en prod), et lignes écartées à l'import.
- Équipe qui en profite : Performance (moins de nettoyage manuel, soldes et prévu justes).
- Comment on le mesure :
  - Requête lecture seule en prod, avant/après : groupes (compte, date, montant, libellé minuscule sans accents/espaces multiples) de plus d'une ligne dont au moins une a `created_at` postérieure à la mise en prod. Départ : 39 groupes / 61 lignes (stock, non nettoyé : on suit seulement les nouveaux). Le chiffre garde les achats identiques réels : on suit sa tendance, pas zéro.
  - Log à l'import : nombre de lignes envoyées, écartées par défaut, recochées, signalées proches (aucun libellé). Voir Points ouverts 1.

## Exploitation
- Voir en prod : le log d'import ci-dessus (selon la décision), erreurs de lecture des transactions existantes (`console.error` + toast).
- Retour arrière : revert du commit front (le back ne change pas de comportement, aucune donnée à corriger).
- Feature flag : non (le contrôle est décochable ligne par ligne, rien n'est refusé).

## Parties sensibles
Aucune. Pas de calcul d'argent ; la règle de décompte est une aide à la décision, sans effet bloquant (tout est recochable) et sans changement du back. Elle est tout de même testée en premier (règle critique). Lucas peut la passer en point de contrôle s'il juge l'algorithme sensible.

## Ce qui change dans l'existant
Aucune règle de `docs/` n'est contredite. Complète « Import en lot » (`docs/transactions.md`) : le contrôle est côté écran, l'écriture atomique, la bascule et le nettoyage (`docs/periods.md`) ne changent pas. Les lignes qui ne sont pas envoyées n'entrent plus dans la bascule (CA7).

## Chemins d'exposition (import)
| Chemin | Couvert |
| --- | --- |
| Import CSV, étape de validation (seul chemin d'import ; `handleImport` → `POST /:accountId/transactions/bulk`) | CA1 à CA8 |
| Appel direct de l'API `bulk` (hors écran) | hors périmètre : pas de refus serveur, choix de Lucas (recocher) |
| Saisie simple, double envoi mobile (`docs/transactions.md`, zones d'ombre) | hors périmètre, autre lot |

## Fichiers concernés
- À modifier : `frontend/src/app/[locale]/(dashboard)/transactions/import/page.tsx` — lecture des transactions existantes à la fin du mapping (avant la prédiction), calcul des marques, envoi des seules lignes cochées, compteurs
- À modifier : `frontend/src/features/transactions/ui/import/import-validation-step.tsx` — case à cocher par ligne, marques « Déjà présente » / « Ligne proche »
- À modifier : `frontend/src/features/transactions/model/import-types.ts` — état de la ligne (`excluded`, `duplicateOf`, `nearOf`)
- À créer : `frontend/src/features/transactions/model/import-duplicates.ts` — libellé comparé, décompte des occurrences, lignes proches (fonction pure) ; Glob : absent
- À modifier : `frontend/messages/fr.json`, `frontend/messages/en.json` — espace `Import` (marques, bandeau, toast `success_with_skipped`)
- Tests : créer `frontend/src/features/transactions/model/import-duplicates.test.ts` ; modifier `frontend/src/features/transactions/ui/import/import-validation-step.test.tsx`, `frontend/src/app/[locale]/(dashboard)/transactions/import/page.test.tsx`
- Réutilise sans le modifier : `frontend/src/features/transactions/api/use-transactions.ts` (liste avec `startDate`/`endDate`, `limit` ≤ 5000), `frontend/src/components/ui/checkbox.tsx`
- Si log côté back (Points ouverts 1, option A) : modifier `functions/src/transactions/infrastructure/transactions.controller.ts` (`BulkCreateTransactionsDto`, ligne 160) et `bulk-create-transactions.use-case.ts` ; test `bulk-create-transactions.use-case.spec.ts`
- Vérification réelle : créer `functions/http/import-sans-doublon.http` (aucun fichier d'import existant) ; ligne de mesure SQL dans `specs/import-sans-doublon/`

## Hors périmètre
- Nettoyage des 61 lignes déjà en prod (décision de Lucas : on les laisse).
- Refus ou contrôle côté serveur, clé d'idempotence.
- Doublons entre lignes du même fichier sans équivalent en base (deux cafés dans le relevé, aucun en base : les deux restent cochées).
- Comparaison avec les `pending`, avec d'autres comptes, avec les virements entre comptes.

## Hypothèses
- Libellé comparé = `cleanDescription` + minuscules + sans accents : recommandation, non confirmée par Lucas.
- Écart « proche » = 3 jours au plus (1 à 3) : recommandation. Pas 7 jours (équivalence des récurrentes, `docs/periods.md`) : trop large pour des achats hebdomadaires de même montant, qui seraient tous signalés.
- Les `pending` sont exclues de la base comparée (voir Vocabulaire) : raison de fond, non dite par Lucas.
- Au-delà de 5000 transactions dans la fenêtre du fichier, la lecture est tronquée : on prévient plutôt que de décocher sur une base incomplète (même traitement que CA8).
- Une transaction ajoutée entre l'écran de validation et la confirmation n'est pas vue (accepté, le relevé se relit à l'écran).
- La prédiction de catégorie reste faite pour toutes les lignes valides, décochées comprises (recocher donne une catégorie sans attente).
- « Confirmé par Lucas » : seulement les points 1 et 2 du besoin (décochage des identiques, signalement sans décochage des proches, recochage) et le point 3 (pas de nettoyage).

## Points ouverts
1. **Log des lignes écartées / recochées.** Le back n'a pas de logger dans `transactions` et le front ne peut rien écrire de durable.
   - A (recommandé) : champ optionnel du corps de `bulk` `{ excluded, rechecked, closeFlagged }` (nombres seulement), journalisé en `info` par le back. Petit changement de contrat, une ligne de log mesurable.
   - B : pas de log, seule la requête SQL mesure (les doublons créés baissent, mais on ne voit pas combien l'écran en a évité).
2. Écart « proche » : 3 jours (recommandé) ou 7 ? À confirmer si Lucas préfère signaler plus large.
