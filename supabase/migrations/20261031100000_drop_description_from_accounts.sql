-- Le champ « Objectif / Pitch » ne servait qu'à l'analyse IA supprimée.
-- À appliquer APRÈS le déploiement du back qui n'écrit plus accounts.description.
ALTER TABLE public.accounts DROP COLUMN IF EXISTS description;
