-- Conversion de la disposition : stat-bank, stat-upcoming, stat-income passent en largeur 4, rien d'autre ne change.
-- Lancement : psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f supabase/tests/widen_balance_cards_test.sql
DO $$
DECLARE
  old_layout CONSTANT jsonb := '{"widgets": [
    {"id": "stat-start", "width": 2, "desktopVisible": true, "mobileVisible": false},
    {"id": "stat-income", "width": 2, "desktopVisible": true, "mobileVisible": false},
    {"id": "stat-expenses", "width": 2, "desktopVisible": true, "mobileVisible": false},
    {"id": "stat-bank", "width": 2, "desktopVisible": true, "mobileVisible": true},
    {"id": "stat-upcoming", "width": 2, "desktopVisible": true, "mobileVisible": true},
    {"id": "stat-forecast", "width": 2, "desktopVisible": true, "mobileVisible": false},
    {"id": "breakdown", "width": 6, "desktopVisible": true, "mobileVisible": false},
    {"id": "transactions", "width": 6, "desktopVisible": true, "mobileVisible": true},
    {"id": "anomalies", "width": 12, "desktopVisible": true, "mobileVisible": false},
    {"id": "tags", "width": 3, "desktopVisible": false, "mobileVisible": false}
  ]}';
  expected CONSTANT jsonb := '{"widgets": [
    {"id": "stat-start", "width": 2, "desktopVisible": true, "mobileVisible": false},
    {"id": "stat-income", "width": 4, "desktopVisible": true, "mobileVisible": false},
    {"id": "stat-expenses", "width": 2, "desktopVisible": true, "mobileVisible": false},
    {"id": "stat-bank", "width": 4, "desktopVisible": true, "mobileVisible": true},
    {"id": "stat-upcoming", "width": 4, "desktopVisible": true, "mobileVisible": true},
    {"id": "stat-forecast", "width": 2, "desktopVisible": true, "mobileVisible": false},
    {"id": "breakdown", "width": 6, "desktopVisible": true, "mobileVisible": false},
    {"id": "transactions", "width": 6, "desktopVisible": true, "mobileVisible": true},
    {"id": "anomalies", "width": 12, "desktopVisible": true, "mobileVisible": false},
    {"id": "tags", "width": 3, "desktopVisible": false, "mobileVisible": false}
  ]}';
  converted jsonb;
BEGIN
  converted := public.widen_balance_cards(old_layout);
  -- CA4 + CA5 : seules les 3 largeurs changent (ordre, autres widgets, visibilités identiques)
  ASSERT converted = expected, 'conversion de la disposition type';
  ASSERT converted -> 'widgets' -> 0 ->> 'id' = 'stat-start', 'ordre conservé';
  -- CA6 : idempotente
  ASSERT public.widen_balance_cards(converted) = converted, 'rejouée deux fois';
  -- CA6 : un seul des 3 ids présent
  ASSERT public.widen_balance_cards('{"widgets": [{"id": "stat-bank", "width": 2}, {"id": "tags", "width": 3}]}')
    = '{"widgets": [{"id": "stat-bank", "width": 4}, {"id": "tags", "width": 3}]}', 'un seul id';
  -- CA6 : aucun des 3 ids
  ASSERT public.widen_balance_cards('{"widgets": [{"id": "tags", "width": 3}]}')
    = '{"widgets": [{"id": "tags", "width": 3}]}', 'aucun id';
  -- CA6 : disposition vide, sans widgets, nulle
  ASSERT public.widen_balance_cards('{"widgets": []}') = '{"widgets": []}', 'widgets vide';
  ASSERT public.widen_balance_cards('{}') = '{}', 'objet vide';
  ASSERT public.widen_balance_cards(NULL) IS NULL, 'disposition nulle';
  -- format ancien (liste de chaînes) : inchangé
  ASSERT public.widen_balance_cards('{"widgets": ["anomalies", "stats"]}') = '{"widgets": ["anomalies", "stats"]}', 'format chaînes';
  -- champs inconnus conservés
  ASSERT public.widen_balance_cards('{"v": 1, "widgets": [{"id": "stat-income", "width": 2, "x": "y"}]}')
    = '{"v": 1, "widgets": [{"id": "stat-income", "width": 4, "x": "y"}]}', 'champs inconnus conservés';
END $$;
