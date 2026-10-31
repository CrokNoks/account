# Besoin (Lucas, tel quel)

Fiabiliser la détermination automatique de la catégorie d'une transaction : aujourd'hui elle est inconsistante. Causes constatées : accents cassés par le découpage des mots (« Électricité » devient « lectricit »), découpage et racines pensés pour l'anglais, bruit des libellés bancaires (« Paiement par carte », « Prélèvement », numéros de carte X2909, dates, références SEPA) qui pousse vers les catégories fréquentes, aucun seuil de confiance. Fichier réel de Lucas pour tester en conditions d'import (données personnelles, à ne jamais committer) : /Users/lucas/.claude/uploads/0083c15a-88e9-425b-8444-bd0bf699c180/6f07deb2-CA20261029_120356.csv (export Crédit Agricole, Windows-1252, en-tête ligne 11, libellés sur plusieurs lignes, colonnes Débit/Crédit). Constaté aussi : l'import lit le fichier en UTF-8, donc les accents sont abîmés avant même la prédiction.

## Réponses de Lucas (cadrage)

1. En cas de doute, l'application propose quand même **sa meilleure idée** (pas de seuil qui la fait taire). Le correctif précédent reste : aucun mot connu de l'historique → rien (`docs/transactions.md:34`, commit ae672e0).
2. La lecture des accents à l'import (fichier Windows-1252 lu en UTF-8) **fait partie du cycle**.
3. Impact attendu : **moins de corrections à faire** sur la catégorie proposée, à l'import et à l'ajout d'une transaction. La correspondance commerçant → catégorie attendue pour mesurer sur le fichier réel n'a pas été donnée : elle sera déduite et soumise à Lucas avec la spec.

## Contexte (orchestrateur)

- Prédiction : `functions/src/transactions/application/predict-category.use-case.ts` (règles intelligentes d'abord, puis Bayes de `natural` réentraîné à chaque appel sur toutes les transactions catégorisées du compte).
- Vérifié avec `natural` : `PorterStemmer.tokenizeAndStem("Électricité facture été")` → `['lectricit', 'factur']`.
- Import : `frontend/src/app/[locale]/(dashboard)/transactions/import/page.tsx:61` (`Papa.parse(file, …)` sans encodage) ; prédiction ligne par ligne via `GET /:accountId/transactions/predict-category`.
- Formulaire : `transaction-form.tsx`, prédiction après 3 caractères si aucune catégorie choisie.
- Fichier réel : libellés sur plusieurs lignes avec type d'opération (« Paiement par carte », « Prélèvement », « Virement en votre faveur »), numéro de carte (`X2909`), date (`24/10`), références SEPA ; le nom utile (« E.Leclerc », « Orange », « EDF ») est souvent après « - ». Ne jamais committer ce fichier ni ses libellés bruts (nom, n° de compte, n° de client) : tests avec libellés anonymisés.
