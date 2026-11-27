-- Supprime trois fonctions mortes de public : get_balance_history(uuid, date), get_evolution_data(uuid)
-- et get_evolution_data(uuid, text). Elles lisent la table « expenses », qui n'existe plus : tout appel
-- échoue. Aucun objet n'en dépend (pg_depend) et aucun appel dans functions/src ni frontend/src.
-- Retour arrière : recréer depuis 20260105120000 (get_balance_history), 20260105130000 / 20260127145215 /
-- 20260127152953 (get_evolution_data), mais elles échoueraient de toute façon tant que « expenses » n'existe pas.
-- get_category_historical_stats(uuid) est conservée (utilisée par le module budgets).

DROP FUNCTION IF EXISTS public.get_balance_history(uuid, date);
DROP FUNCTION IF EXISTS public.get_evolution_data(uuid);
DROP FUNCTION IF EXISTS public.get_evolution_data(uuid, text);
