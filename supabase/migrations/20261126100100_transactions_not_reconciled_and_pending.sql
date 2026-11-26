-- Une transaction n'est jamais à la fois pointée et `pending` (spec soldes-et-prevu-justes, CA9).
-- L'API le refuse déjà en 400 (pending-rule.ts) : cette contrainte est le filet côté base.
-- À appliquer APRÈS le déploiement du back qui porte la garde (sinon un ancien client reçoit une erreur base
-- au lieu d'un 400). ADD CONSTRAINT échoue sans rien changer si une ligne existante viole la règle :
-- contrôle préalable en lecture seule, attendu 0 :
--   select count(*) from transactions where reconciled and pending;
-- Retour arrière : ALTER TABLE public.transactions DROP CONSTRAINT transactions_not_reconciled_and_pending;
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_not_reconciled_and_pending
  CHECK (NOT (COALESCE(reconciled, false) AND COALESCE(pending, false)));
