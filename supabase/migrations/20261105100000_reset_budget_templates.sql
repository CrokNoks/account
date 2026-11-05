-- Mise en service des budgets fixes : budget_templates ne contient que des restes jamais utilisés par le code
-- (vérifié en production : 38 lignes, dernière mise à jour 2026-03-08). On la vide, sans copie de sauvegarde,
-- avant la reprise (20261105100100) qui la remplit depuis la période la plus récente de chaque compte.
-- À ne jamais rejouer après la mise en service : elle supprimerait les montants configurés.
DELETE FROM public.budget_templates;
