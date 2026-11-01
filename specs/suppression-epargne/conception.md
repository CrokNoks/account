# Conception — migration de suppression des objectifs d'épargne

## Ce que ça décide
Une seule migration `supabase/migrations/20261101100100_remove_savings_goals.sql` : redéfinit les 2 fonctions d'écriture sans `savings_goal_id`, puis supprime trigger, colonne, table. Entrée : base avec objectifs et transactions liées. Sortie : mêmes transactions, plus aucune trace de l'épargne, toutes les écritures (CA7) OK.

## Inventaire (lu en base le 2026-11-01, pas seulement dans les fichiers)
- Fonctions dont le corps cite `savings_goal` (`pg_proc.prosrc`) : `insert_transactions`, `upsert_transactions`, `sync_savings_goal_amount`. Aucune autre. `create_transfer`, `create_transactions`, `create_period_with_budgets`, `save_transaction`, `update_transactions` passent par ces deux-là et ne citent pas la colonne.
- Trigger : `trg_sync_savings_goal_on_transaction` (AFTER INSERT/UPDATE/DELETE sur `transactions`, SECURITY DEFINER). Trigger `set_savings_goals_updated_at` sur la table (part avec elle).
- Colonne `transactions.savings_goal_id` : FK `transactions_savings_goal_id_fkey` (ON DELETE SET NULL), index `idx_transactions_savings_goal_id` (partent avec la colonne).
- Politique RLS `Manage savings goals via account access` (part avec la table). Aucune vue, aucune publication realtime sur ces tables. Seule FK entrante vers `savings_goals` : celle de `transactions`.
- Les corps actuels sont ceux de `20261030100000` (insert) et `20261030100400` (upsert). `search_path = public, pg_temp`, invoker. Droits : `REVOKE ALL … FROM PUBLIC; GRANT EXECUTE … TO authenticated`. `CREATE OR REPLACE` avec la même signature `(jsonb)` conserve ces droits : pas de nouveau GRANT, mais le test les revérifie.
- Base locale : 0 objectif, 0 transaction liée, 2182 transactions.

## La migration (SQL prévu, sans BEGIN/COMMIT : le CLI enveloppe déjà)
```sql
-- 1. Fonctions sans savings_goal_id (corps identiques sinon)
CREATE OR REPLACE FUNCTION public.insert_transactions(p_transactions jsonb)
RETURNS void LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF p_transactions IS NULL OR jsonb_typeof(p_transactions) <> 'array' THEN
    RAISE EXCEPTION 'p_transactions must be a JSON array' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.transactions (
    id, account_id, category_id, period_id, date, description, amount,
    reconciled, pending, payment_method, notes, metadata, created_at, updated_at)
  SELECT t.id, t.account_id, t.category_id, t.period_id, t.date, t.description, t.amount,
    t.reconciled, t.pending, t.payment_method, t.notes, COALESCE(t.metadata,'{}'::jsonb),
    t.created_at, t.updated_at
  FROM jsonb_to_recordset(p_transactions) AS t(
    id uuid, account_id uuid, category_id uuid, period_id uuid, date date,
    description text, amount bigint, reconciled boolean, pending boolean,
    payment_method text, notes text, metadata jsonb,
    created_at timestamptz, updated_at timestamptz);
  -- bloc transaction_tags inchangé (copié tel quel)
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_transactions(p_transactions jsonb) ... -- idem :
  -- retire savings_goal_id de la liste INSERT, du SELECT, du recordset et du
  -- "savings_goal_id = EXCLUDED.savings_goal_id" ; DELETE/INSERT transaction_tags inchangés.

-- 2. Trigger puis sa fonction (sans CASCADE)
DROP TRIGGER trg_sync_savings_goal_on_transaction ON public.transactions;
DROP FUNCTION public.sync_savings_goal_amount();

-- 3. Colonne (emporte FK + index ; les lignes gardent tout le reste)
ALTER TABLE public.transactions DROP COLUMN savings_goal_id;

-- 4. Table (emporte politique RLS et trigger updated_at), sans CASCADE
DROP TABLE public.savings_goals;
```
L'implémentation copiera les corps exacts depuis `\sf` (pas de réécriture de mémoire) ; seul le retrait de la colonne diffère.

## Pourquoi cet ordre
1. **Fonctions d'abord** : le corps plpgsql n'est pas suivi par les dépendances. `DROP COLUMN` réussirait même si une fonction cite encore la colonne, et c'est l'écriture suivante qui échouerait (erreur 500 en prod). Redéfinies en premier, aucune écriture ne cite plus la colonne à aucun moment.
2. **Trigger avant colonne** : il lit `OLD/NEW.savings_goal_id` à chaque écriture ; le laisser après le retrait de la colonne casserait toute insertion/mise à jour/suppression.
3. **Colonne avant table** : la FK de `transactions` bloque `DROP TABLE` ; sans `CASCADE`, un oubli fait échouer la migration (donc rollback complet) au lieu de supprimer en silence autre chose.
4. Tout est dans une transaction : au moindre échec, rien n'est appliqué.
- Pendant le déploiement : la nouvelle fonction ignore une clé `savings_goal_id` envoyée par l'ancien API (`jsonb_to_recordset` ne lit que les colonnes déclarées) ; l'ancienne fonction reçoit NULL du nouvel API. D'où « API avant migration » sans fenêtre cassée (sauf lecture de la colonne par l'ancien code après migration, que l'ordre évite).
- `DROP COLUMN` est un changement de catalogue (pas de réécriture de 2182 lignes), verrou exclusif très court.

## Test de CA8 écrit AVANT le code
Fichier `supabase/tests/remove_savings_goals.sql` (nouveau dossier ; hors « Fichiers concernés » de la spec, à confirmer par Lucas, sinon il reste dans le scratchpad), exécuté par `docker exec -i supabase_db_account-v2 psql -U postgres -v ON_ERROR_STOP=1 < fichier`. Il est **rouge sans migration**, vert avec.

Le script :
1. `BEGIN;`
2. Prend un compte, une catégorie et un tag existants ; insère 1 objectif et 3 transactions liées (`savings_goal_id` posé), avec montants, dates, tags et période variés (la période est assignée par le trigger `assign_period_id`).
3. Photographie dans une table temporaire : `to_jsonb(t) - 'savings_goal_id'` pour chaque transaction + `transaction_tags` (toutes les lignes, pas seulement les miennes).
4. `\i supabase/migrations/20261101100100_remove_savings_goals.sql` (le vrai fichier, pas une copie).
5. Vérifie, avec `DO $$ … ASSERT … $$` : table `savings_goals`, colonne, trigger et fonction absents (`to_regclass`, `information_schema`, `pg_trigger`, `pg_proc`) ; aucune fonction ne contient plus `savings_goal` ; nombre de transactions et de `transaction_tags` identique ; `EXCEPT` dans les deux sens entre photo et état actuel = vide ; droits `EXECUTE` de `authenticated` présents sur les deux fonctions.
6. Rejoue CA7 : `create_transfer`, `create_transactions` (lot de 3), `create_period_with_budgets` avec transactions récurrentes, `save_transaction` (création puis modification avec changement de tags), `update_transactions` ; chaque appel doit réussir et le nombre de lignes attendu apparaître. Atomicité : un lot dont la 2e ligne est invalide (montant texte) doit lever une erreur et laisser le compte inchangé (dans un sous-bloc `BEGIN … EXCEPTION`).
7. `ROLLBACK;` en dernière ligne.

**Revenir à l'état initial sans `supabase db reset`** : PostgreSQL a des DDL transactionnels, donc l'étape 1 à 7 (migration comprise) est annulée entièrement par `ROLLBACK`. En cas d'échec, `ON_ERROR_STOP` coupe et la session se ferme : la transaction ouverte est annulée aussi. Les données de Lucas ne sont jamais modifiées par le test.

**Procédure sûre, dans l'ordre** :
1. Sauvegarde : `docker exec supabase_db_account-v2 pg_dump -U postgres -Fc postgres > <scratchpad>/avant-epargne.dump` (même geste que la sauvegarde prod).
2. Rouge : lancer le script avant d'écrire la migration → échec attendu (fichier absent / colonne encore là).
3. Écrire la migration, relancer le script → vert, base inchangée (vérifier : `select count(*) from transactions` = 2182 et `\d savings_goals` existe encore).
4. Seulement ensuite, appliquer pour de vrai, une fois : `supabase migration up` (lancé par Lucas). Contrôle : mêmes 2182 transactions, table et colonne absentes.
5. Les e2e (`functions/test`) et `http/suppression-epargne.http` tournent après l'étape 4 ; avant, ils tournent contre la colonne encore présente, ce qui reste valide (le code n'y touche plus).

## Exploitation
Pas de log (retrait pur). Retour arrière : le code se revert, mais données `savings_goals` et liens perdus : sauvegarde (`pg_dump`) obligatoire avant l'application en prod, par Lucas. Une migration inverse ne restaurerait pas les données, on n'en écrit pas.

## Alternative écartée
Dépréciation en deux temps (migration 1 : redéfinir les fonctions ; plus tard migration 2 : supprimer colonne et table). Plus sûre pour un rollback de la table, mais personne n'utilise la fonctionnalité (0 donnée) et Lucas a décidé une suppression sans condition : une seule migration, l'ordre du déploiement (API puis migration) suffit.

## Cas de test
| Entrées | Résultat attendu | Pourquoi |
| --- | --- | --- |
| Base avec 1 objectif + 3 transactions liées, migration appliquée | Migration sans erreur | CA8 : la FK et le trigger n'empêchent pas la suppression |
| Idem | Table, colonne, trigger, fonction `sync_savings_goal_amount` absents | CA8 |
| Idem | Même nombre de transactions et de tags ; `EXCEPT` des lignes (hors colonne retirée) vide dans les 2 sens | Aucune transaction perdue ni modifiée (montants, dates, catégories, tags, période) |
| Après migration, `pg_proc.prosrc ilike '%savings_goal%'` | 0 ligne | Aucune fonction ne cite l'ancien nom |
| `create_transfer` | 2 transactions créées | CA7 virement via `insert_transactions` |
| `create_transactions` (3 lignes) | 3 créées | CA7 import en lot |
| `create_transactions` dont la 2e ligne est invalide | Erreur, 0 ligne créée | Atomicité conservée |
| `create_period_with_budgets` avec transactions récurrentes | Période, budgets et transactions créés | CA7 période |
| `save_transaction` création puis modification (tags changés) | 1 ligne, tags remplacés | CA7 `upsert_transactions` |
| `update_transactions` | Lignes modifiées | CA7 remplacement |
| Payload contenant encore une clé `savings_goal_id` (ancien API) | Écriture OK, clé ignorée | Fenêtre de déploiement |
| Droits `EXECUTE` sur les 2 fonctions | `authenticated` oui, `PUBLIC` non | `CREATE OR REPLACE` ne doit pas les perdre |
| Script lancé sans la migration | Échec | Le test est bien rouge avant le code |
| Après le script | 2182 transactions, `savings_goals` existe encore | Le dry-run a bien été annulé |

## Risques
- Oublier une référence dans une fonction : couvert par le test `prosrc` et par l'exécution de chaque écriture.
- Divergence entre le corps copié et le corps actuel : copie depuis `\sf` de la base, comparée au diff des anciennes migrations.
- Appliquer la migration avant l'API : l'ancien code lit la colonne et échoue ; ordre imposé par la spec, Lucas lance.
- Perte définitive des objectifs : assumée (0 donnée locale) mais prod non vérifiée : à compter avant (`select count(*) from savings_goals`) pendant la sauvegarde.
- Autre correcteur en parallèle (`20261101100000_smart_rules_read_access.sql`) : la migration prend un numéro supérieur et ne touche pas aux règles ; ordre d'application sans conflit.
