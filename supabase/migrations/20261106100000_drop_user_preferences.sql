-- Écran Aujourd'hui fixe : la personnalisation du tableau de bord disparaît.
-- Supprime la table user_preferences et la fonction d'élargissement des cartes qui ne servait qu'à elle.
-- Ordre à la mise en prod : déployer front et back (l'ancien front lit /preferences), puis appliquer.
-- Retour arrière : irréversible sans sauvegarde de la table (layout par utilisateur).
DROP FUNCTION IF EXISTS public.widen_balance_cards(jsonb);
DROP TABLE IF EXISTS public.user_preferences;
