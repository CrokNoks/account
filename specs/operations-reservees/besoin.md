# Besoin — operations-reservees

La liste d'Opérations filtrée sur la période active doit montrer les dépenses (montant < 0) datées après la fin de cette période, comme le prévu les compte (`specs/factures-reservees/spec.md`, point ouvert 1 : accord de Lucas le 2026-11-24). Aujourd'hui « À traiter » peut compter une CB que son lien n'affiche pas.

- Même fenêtre que `functions/src/reporting/domain/period-window.ts` : dépenses de la période active sans borne de fin, montants positifs bornés, période fermée bornée.
- Détail d'un tag : hors périmètre. Aucun calcul de solde, de prévu ou de total ne change.
- Pagination, tri, recherche, filtres d'état et comptes par filtre restent cohérents avec la liste.
- Impact : 0 CB comptée dans « À pointer » et absente de la liste ouverte par son lien.
- Lucas a délégué les validations, sauf partie sensible.
