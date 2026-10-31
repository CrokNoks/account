# Conception — traitement des mots de la prédiction de catégorie

## Ce que ça décide
Libellé saisi + historique catégorisé du compte → une catégorie (ou `null`). Seule la façon de transformer un libellé en mots change ; les règles intelligentes restent en premier.

## Le traitement des mots (fonction pure `extractWords(description): string[]`)
Nouveau fichier `functions/src/transactions/application/description-words.ts`.

1. **Découper en lignes** (`\n`). Un libellé bancaire est multi-lignes ; le bruit est retiré ligne par ligne.
2. **Normaliser** chaque ligne : minuscules, accents retirés (NFD, suppression `̀-ͯ`), apostrophes et ponctuation → espace. Les accents sont retirés AVANT la racine, sinon « électricité » et « electricite » donnent deux racines différentes (mesuré : `électr` vs `electricit`).
3. **Retirer le bruit** (regex sur la ligne normalisée, dans cet ordre) :
   - ligne entière = type d'opération : `paiement par carte`, `prelevement`, `virement emis`, `virement en votre faveur`, `virement recu`, `retrait`, `cotisation`, `frais`, `echeance`, `remise`, `cheque` ;
   - n° de carte : `\bx\d{3,}\b` ;
   - dates : `\b\d{1,2}/\d{1,2}(/\d{2,4})?\b` ;
   - identifiant SEPA : `\b[a-z]{2}\d{2}zzz\w*` (ex. FR..ZZZ...) ;
   - références / codes : tout mot contenant un chiffre (`\w*\d\w*`, ce qui couvre aussi les nombres seuls) ; simple et prévisible, pas d'heuristique sur les mots longs sans chiffre ;
   - mots de bruit : `sepa prlv cb carte paiement prelevement virement emis recu faveur echeance ref mdt ou mme m mlle`.
4. **Découper en mots** (`[a-z0-9]+`), garder ceux de 2 lettres ou plus (« E.Leclerc » → `leclerc`).
5. **Retirer les mots vides français** : liste de `natural` via `PorterStemmerFr.tokenizeAndStem(text, false)` (de, la, le, et, du, pour, par…).
6. **Racine** : `natural.PorterStemmerFr.stem(mot)` — existe et est utilisable (aucune dépendance ajoutée). Exemples mesurés (après retrait des accents) : abonnements / abonnement → `abon` ; électricité / ELECTRICITE → `electricit` ; mobile → `mobil` ; restaurant / restauration → `restaur` ; pharmacie → `pharmac` ; leclerc → `leclerc`. Défaut connu : racines parfois trop courtes (`pai`), sans conséquence ici, la même racine sortant des deux côtés.
7. Résultat : liste de racines (doublons conservés, utile à Bayes).

Hypothèse : les prénoms/noms du titulaire dans les libellés de virement ne sont pas listés (donnée personnelle) ; ils pèsent peu et restent identiques d'un libellé à l'autre.

## Partage entre « mot connu » et Bayes
- `knownWords` = ensemble des racines de `extractWords` sur tout l'historique ; `hasKnownWord = extractWords(saisie).some(w => knownWords.has(w))`. Le correctif ae672e0 est conservé : aucun mot utile connu → `categoryId: null`. Comme le bruit est retiré, un libellé « Paiement par carte X1234 12/10 » donne `[]` → `null` (CA4).
- Bayes : `classifier.addDocument(extractWords(t.description), t.categoryId)` et `classifier.getClassifications(extractWords(saisie))`. `natural` accepte des tableaux de mots (vérifié dans `classifier.js` : il ne tokenise que si c'est une chaîne). Pas de tokenizer personnalisé : un seul point de traitement, donc impossible que les deux contrôles divergent.
- Un document d'historique dont `extractWords` est vide est ignoré à l'apprentissage.

## Décision
Ordre inchangé : saisie < 3 caractères → `null` ; règles intelligentes ; pas d'historique → `null` ; aucun mot utile connu → `null` ; sinon la meilleure classification, toujours, sans seuil (CA5).

## Alternative écartée
Tokenizer personnalisé branché dans `BayesClassifier` : plus couplé à `natural`, et le contrôle « mot connu » aurait eu son propre chemin. Seuil de confiance : hors périmètre.

## Cas de test (CA1 à CA6, spec du use case)
| CA | Historique | Saisie | Attendu |
| --- | --- | --- | --- |
| 1 | « Électricité de France » → Énergie (+ une autre catégorie) | `electricite edf` | Énergie |
| 1 | idem | `ÉLECTRICITÉ` | Énergie |
| 2 | « abonnement mobile » → Télécom | `abonnements` | Télécom |
| 3 | « Paiement par carte\nX2909 E.Leclerc 24/10 - E.Leclerc » → Courses ; autres achats d'une catégorie plus fréquente | `Paiement par carte\nX0053 E.Leclerc 03/11 - E.Leclerc` | Courses |
| 3 | idem, avec réf. `FR12ZZZ123456` et `D12-3456789` dans l'historique | libellé avec d'autres réf. | Courses |
| 4 | historique avec « Paiement par carte X2909 … » | `Paiement par carte X1234 12/10` | `null` |
| 4 | historique quelconque | `zzzz qqqq` | `null` (existant) |
| 5 | un mot utile connu (« leclerc » 1 fois contre une autre catégorie 5 fois) + mots inconnus | libellé avec « leclerc » | meilleure candidate, jamais `null` |
| 6 | règle intelligente qui correspond + historique contraire | libellé de la règle | résultat de la règle, repository d'historique non appelé |
| unitaires `extractWords` | — | multi-lignes avec type d'opération, carte, date, SEPA, réf. | uniquement les racines du commerçant |

Le test « compares words after stemming » (anglais, `subscription`) est remplacé par le cas CA2.

## Test CA8 (mesure hors ligne)
Fichier de test avec un jeu **anonymisé** : ~25 libellés d'historique et ~15 à prédire (noms de commerçants uniquement ; cartes, dates et références inventées), catégorie attendue pour chacun. Le test reconstitue l'ancienne logique (`PorterStemmer` anglais, `toLowerCase`) dans le test, calcule les deux taux, les affiche (`console.log`) et vérifie `après > avant`. Aucun contenu du fichier réel n'est copié.

## Lecture du CSV (CA7, non sensible, mode standard)
Dans `import/page.tsx` : lire le fichier en `ArrayBuffer`, essayer `new TextDecoder('utf-8', { fatal: true })` (le BOM est retiré par défaut) ; si ça lève une erreur, décoder en `windows-1252` ; puis `Papa.parse(texte, …)`.

## Fichiers
- Partie sensible (contrôle 2 avant commit) : `functions/src/transactions/application/description-words.ts` (+ son test, jeu CA8), `predict-category.use-case.ts` et `predict-category.use-case.spec.ts`.
- Mode standard, sans toucher à ce qui précède : CA7 (`frontend/.../import/page.tsx` + `page.test.tsx`), `http/prediction-libelle-bancaire.http`. La vérification réelle de CA1 à CA6 se fait en `implementation`.

## Exploitation
Pas de log (décision de Lucas). Retour arrière : revert des commits.

## Décisions de Lucas (contrôle 1, go)

- Mots avec chiffres : un mot n'est retiré que s'il contient **au moins autant de chiffres que de lettres** (« q731bz5520 », « 9876501234 » retirés ; « 1password », « bebe9 » gardés). Remplace la règle « tout mot contenant un chiffre ».
- Nom du titulaire dans les virements : laissé tel quel (pas de donnée personnelle dans le code).
- Ajouté au cycle (non sensible) : à l'import, la détection automatique des colonnes Débit / Crédit ignore les accents (« Débit », « Crédit » reconnus).
