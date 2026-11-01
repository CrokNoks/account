# Suppression de trois éléments inutilisés

## Le problème
Trois éléments existent dans l'API et la base sans servir à rien : le plafond de catégorie (`categories.budget`, affiché dans l'écran de modification mais jamais envoyé ni lu ; le suivi de budget utilise les budgets de période), le moyen de paiement des transactions (`payment_method`, jamais saisi ni affiché) et le type d'anomalie `spike` (accepté à l'ignorance, jamais détecté). Du code à maintenir et un champ trompeur à l'écran.

## Critères d'acceptation
- [ ] CA1 — Étant donné l'écran de modification d'une catégorie, quand je l'ouvre, alors il n'y a plus de champ « Budget » (nom, type, couleur seulement).
- [ ] CA2 — Étant donné la création, la modification ou la liste des catégories, quand l'API répond, alors aucune catégorie ne contient `budget` ; un `budget` envoyé est refusé (400, champ inconnu) sans écriture.
- [ ] CA3 — Étant donné la création (simple, en lot) ou la modification d'une transaction, quand `paymentMethod` est envoyé, alors 400 (champ inconnu) sans écriture ; aucune transaction renvoyée ne contient `paymentMethod`.
- [ ] CA4 — Étant donné « ignorer une anomalie », quand le type est `spike`, alors 400 ; `duplicate` et `outlier` restent acceptés.
- [ ] CA5 — Étant donné la base après migration, alors les colonnes `categories.budget` et `transactions.payment_method` (et sa contrainte CHECK) n'existent plus ; `insert_transactions` et `upsert_transactions` fonctionnent sans elle ; seed et migrations rejouées de zéro passent.
- [ ] CA6 — Étant donné le code, quand on cherche ces trois éléments (back, front, traductions, tests, `.http`), alors il n'en reste aucune occurrence (hors migrations passées).

## Règle critique
Aucune règle métier critique : suppression de champs non utilisés. Les tests de refus (CA2, CA3, CA4) sont écrits avant le code.

## Mesure d'impact
- Indicateur : occurrences dans le code et colonnes en base (de « 3 éléments, 2 colonnes » à 0).
- Mesure : `grep` (CA6) et `information_schema.columns` après migration.

## Exploitation
- Ordre de déploiement : release (back qui n'écrit plus `budget` ni `payment_method`) AVANT la migration ; sinon l'ancien back écrit dans une colonne absente (500 à l'enregistrement d'une catégorie). Les fonctions SQL redéfinies ignorent une clé `payment_method` en trop : sans risque dans l'autre sens.
- Retour arrière : revert du code ; les colonnes ne reviennent qu'à vide (données perdues, acceptées par Lucas).
- Feature flag : non.

## Parties sensibles
Aucune.

## Hors périmètre
Les points 4 à 8 de l'analyse (soldes, tableau de bord, visite guidée, en attente/rapprochée, classifieur) : mis de côté par Lucas. Les types `unexpected_amount`, `missing_recurring`, `unusual_category` du front (types.ts) : non demandés.
