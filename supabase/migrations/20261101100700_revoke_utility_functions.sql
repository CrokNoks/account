-- Fonctions utilitaires (réparation de libellés, élargissement des cartes) : usage SQL uniquement.
-- Elles sont dans le schéma public donc exposées en RPC par PostgREST : on retire l'EXECUTE à l'API.
REVOKE EXECUTE ON FUNCTION public.widen_balance_cards(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_mojibake(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.repair_lost_accents(text) FROM PUBLIC, anon, authenticated;
