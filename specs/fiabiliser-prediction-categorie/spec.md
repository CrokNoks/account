# Fiabiliser la catégorie proposée à l'import et à l'ajout

## Le problème
La catégorie proposée automatiquement pour une transaction est inconsistante : les accents sont cassés (« Électricité » devient « lectricit »), le découpage est pensé pour l'anglais, et le bruit des libellés bancaires (« Paiement par carte », n° de carte, dates, références SEPA) tire vers les catégories fréquentes. À l'import, un CSV Windows-1252 est en plus lu en UTF-8 : les accents sont abîmés avant la prédiction. Lucas corrige trop souvent la catégorie proposée.

## Critères d'acceptation
- [ ] CA1 — Étant donné un historique « Électricité de France » en Énergie, quand je saisis « electricite edf » ou « ÉLECTRICITÉ », alors Énergie est proposée (accents et casse sans effet).
- [ ] CA2 — Étant donné un historique « abonnement mobile » en Télécom, quand le libellé contient « abonnements », alors Télécom est proposée (formes françaises proches = même mot).
- [ ] CA3 — Étant donné des achats passés « Paiement par carte X2909 … 24/10 - E.Leclerc » en Courses, quand arrive « Paiement par carte X0053 … 03/11 - E.Leclerc » (autre carte, autre date), alors Courses est proposée ; type d'opération, n° de carte, dates et références n'influencent pas le choix.
- [ ] CA4 — Étant donné un libellé dont seuls les mots de bruit sont connus (ex. « Paiement par carte X1234 12/10 ») , quand je demande la catégorie, alors aucune n'est proposée.
- [ ] CA5 — Étant donné au moins un mot utile connu de l'historique, quand je demande la catégorie, alors la meilleure candidate est toujours proposée (pas de seuil de confiance qui la retire).
- [ ] CA6 — Étant donné une règle intelligente qui correspond, quand je demande la catégorie, alors son résultat est renvoyé comme aujourd'hui, avant tout calcul sur l'historique.
- [ ] CA7 — Étant donné un CSV Windows-1252 (export Crédit Agricole), quand je l'importe, alors « Libellé », « Débit », « Prélèvement » s'affichent avec leurs accents ; un CSV UTF-8 (avec ou sans BOM) reste affiché correctement.
- [ ] CA8 — Étant donné le jeu de libellés anonymisés (voir Mesure), quand le test tourne, alors la part de catégories correctes après la modification est supérieure à celle d'avant, et les deux sont affichées.

Chemins d'exposition de la prédiction (même route `GET /:accountId/transactions/predict-category`) : formulaire d'ajout (`transaction-form.tsx`) et import (`import/page.tsx`) sont couverts par CA1 à CA6. L'application des règles intelligentes à l'import en lot sans catégorie (`bulk-create-transactions.use-case.ts:27-39`) n'utilise pas la prédiction : inchangée.

## Règle critique
Pour un même commerçant, accents, casse, type d'opération, n° de carte, dates et références ne changent pas la catégorie proposée ; et si aucun mot utile du libellé n'est connu de l'historique, rien n'est proposé (conserve `docs/transactions.md:34`). Testée avant le code.

## Mesure d'impact
- Indicateur qui doit bouger : part des catégories proposées que l'utilisateur corrige (à l'import et à l'ajout), en baisse.
- Équipe qui en profite : Performance (temps gagné à l'import).
- Comment on le mesure (pas de log en prod, décision de Lucas) :
  1. Sur les vraies données, hors repo : export de prod fourni par Lucas (date, libellé, catégorie des transactions catégorisées). Apprentissage sur les mois anciens, prédiction du dernier mois, taux de bonnes catégories avant/après. Script temporaire hors repo, résultat rapporté dans le chat, rien de committé.
  2. Hors ligne, avant/après : test sur un jeu de libellés ANONYMISÉS inspirés du fichier réel (historique d'apprentissage + libellés à prédire + catégorie attendue). Il affiche le taux de bonnes catégories de l'ancienne et de la nouvelle logique (CA8). Le fichier réel n'est jamais copié dans le repo ni cité en clair ; le jeu ne contient que des noms de commerçants, sans nom, n° de compte, n° de client ni n° de carte réel.

## Exploitation
- À voir en prod : rien de nouveau (pas de log, décision de Lucas).
- Retour arrière : revert des commits (rien n'est migré, l'historique n'est pas modifié).
- Feature flag : non (changement de proposition seulement, l'utilisateur confirme ou corrige).

## Parties sensibles
- Algorithme de prédiction de catégorie (traitement des mots, découpage/racines, bruit, choix de la meilleure candidate) — algorithme, `functions/src/transactions/application/predict-category.use-case.ts`.

## Ce qui change dans l'existant
- Précise la règle « Prédiction de catégorie » de `docs/transactions.md:34` : « découpage et racinisation, comme le classifieur » devient le nouveau traitement des mots (accents, français, bruit). « Aucun mot connu → `categoryId: null` » et « règles intelligentes d'abord » sont conservés.
- `docs/smart-rules.md` : aucune règle modifiée.

## Fichiers concernés
- À modifier : `functions/src/transactions/application/predict-category.use-case.ts` — traitement des mots partagé entre mots connus et classifieur.
- À modifier : `functions/src/transactions/application/predict-category.use-case.spec.ts` — CA1 à CA6 ; le test « compares words after stemming » (anglais, `subscription`) est à adapter.
- À créer : un fichier de traitement des mots à côté du cas d'usage (nom au choix du développeur) et son test, avec le jeu anonymisé de CA8.
- À modifier : `frontend/src/app/[locale]/(dashboard)/transactions/import/page.tsx` — lecture de l'encodage (ligne 61 `Papa.parse(file, …)`).
- Tests : `frontend/src/app/[locale]/(dashboard)/transactions/import/page.test.tsx` (CA7, existe).
- À modifier : `http/prediction-mot-inconnu.http` ou à créer `http/prediction-libelle-bancaire.http` — vérification en réel.
- À mettre à jour ensuite : `docs/transactions.md` (documentaliste).

## Hors périmètre
- Seuil de confiance, apprentissage persistant ou index (réentraînement à chaque appel conservé).
- Règles intelligentes (inchangées), rejeu sur les transactions existantes.
- Mesure en prod des corrections à l'ajout depuis le formulaire (seule la mesure hors ligne les couvre).

## Hypothèses
- Correspondance commerçant → catégorie : remplacée par l'export de prod (catégories réelles de Lucas) pour la mesure sur vraies données. La liste ci-dessous ne sert qu'à construire le jeu anonymisé de CA8 :
  - Courses : E.Leclerc / Yvetodis, U Express, Action (ou Maison)
  - Restauration / boulangerie : Mj Restauration, McDonald's, O Fournil des Amis, Giband, L'épi d'or
  - Santé : Pharmacie Delamare, SG Santé
  - Abonnements / loisirs : Spotify, Canal+, Amazon Prime, 1Password
  - Télécom / factures : Orange (mobile, fibre)
  - Énergie : EDF, Primagaz
  - Assurance : MMA, EPS (surveillance)
  - Impôts / taxes : Direction Générale des Finances Publiques, Cc Yvetot Normandie (REOM)
  - Transport : Bip&Go
  - Animaux : Selarl Vétérinaire Caux Seine
  - Non déduits (à trancher) : Coccinelle Express, Fm Service, Aide et Intervention à Domicile, virements entrants/sortants
- Le nom utile est souvent après « - » dans le libellé ; on ne s'y limite pas (certains libellés n'en ont pas).
- Détection d'encodage : Windows-1252 ou UTF-8 (BOM ou non) suffisent ; pas d'autres encodages.

## Points ouverts
- Export de prod à fournir par Lucas (chemin hors repo).
