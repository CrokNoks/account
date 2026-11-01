# Besoin — dette de tests (SQL et prévisionnel)

Dette de tests relevée le 2026-11-01 :

8. Les tests SQL de `supabase/tests/*.sql` (repair_mojibake, repair_lost_accents, widen_balance_cards, utility_functions_privileges) ne se lancent qu'à la main avec psql ; ils doivent tourner avec la suite automatique du projet (au moins en local, idéalement dans la vérification complète).
9. Deux cas du solde prévisionnel ne sont pas figés par un test (`functions/src/reporting/application/get-period-stats.use-case.spec.ts`) : une transaction sans catégorie quand le budget (prévu) dépasse le réel, et un virement entre comptes sans catégorie dans les deux sens (sortie sur un compte, entrée sur l'autre).

Bonus relevé au passage : 6 erreurs prettier préexistantes dans `functions/test/validation.e2e-spec.ts` (lignes ~797-805).

## Réponses de Lucas (cadrage)
- Les tests SQL tournent en local seulement, dans la vérification complète, avec une seule commande qui lance les 4 tests (Supabase local démarré). Pas de CI.
- Impact : aucune régression SQL ni de calcul du prévisionnel ne part en prod sans être détectée ; mesuré par les tests qui tournent dans la vérification complète.
- Le bonus prettier (6 erreurs dans `functions/test/validation.e2e-spec.ts`) est inclus.
- Mode : complet.
