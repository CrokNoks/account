---
description: Cycle court product engineering (~25 min) — besoin → doc de l'existant → mini-spec → canard → TDD → garde-fou → livraison mesurable, avec Lucas aux décisions
argument-hint: "le besoin"
---

Besoin : $ARGUMENTS

Tu orchestres un cycle court. Les agents sont des outils : Lucas tranche à chaque décision. Annonce chaque étape en une ligne, sans bavarder. Pour un bug remonté par le support, utilise plutôt `/quickfix`.

## 0. Cadrage (Lucas, ~3 min)
- Vérifie que l'arbre Git est propre (`git status`). Sinon, montre-le à Lucas et attends.
- Note le commit de départ : `base = git rev-parse --short HEAD`.
- Vérifie que `.git/info/exclude` (local, jamais committé) contient `.claude` et `.canard-memoire.md` ; sinon ajoute-les. La mémoire du canard est un fichier de travail du cycle : elle ne doit ni être committée ni salir l'arbre.
- Déduis un `slug` court du besoin (kebab-case) et écris le besoin tel quel dans `specs/{slug}/besoin.md`.
- **Vérifie que ce que le besoin suppose existe** (Grep rapide sur les entités et modules cités, `src/`). Si l'un est introuvable, dis-le à Lucas en une ligne **avant toute question** (« `article` n'existe pas ; modules présents : auth, user. On le crée, ou le périmètre est autre ? ») et attends sa réponse.
- Repère les modules concernés et vérifie `docs/{module}.md` : absent, plus ancien que le dernier commit du module, ou sans les mots du besoin ?

**⇉ En parallèle, dans le même message :**
- si la doc est à mettre à jour, lance l'agent `documentaliste` **en arrière-plan** avec le slug **et le texte du besoin** (étape 0 bis) : il documente ce que le besoin touche — les modules qui portent l'entité et les règles en jeu, pas les modules voisins sans lien ;
- propose à Lucas au maximum 3 questions métier — **comportement et impact uniquement, jamais de choix technique** (route, champ, format, code HTTP : c'est le travail du développeur) —, dont une sur l'impact attendu (« qu'est-ce qui doit bouger : ventes, temps gagné par les agents… ? »).

Ajoute les réponses de Lucas à `besoin.md`. **Attends la fin du documentaliste** avant de choisir le mode : si la doc a changé, committe-la (`docs(domaine): {module}`) et montre à Lucas les zones d'ombre qui touchent le besoin (ses réponses vont dans `besoin.md`).

### Mode express ou complet ?
**Avant de proposer un mode, lis l'existant** (~30 s) : dans `docs/{module}.md` des modules concernés, les rubriques « Règles métier » et « Statuts et transitions ». Si la doc n'existe toujours pas, c'est le mode complet.

Le mode **express** n'est possible que si **toutes** ces conditions sont vraies :
1. un seul critère d'acceptation ;
2. ni argent, ni données d'un autre utilisateur ;
3. aucune partie sensible (skill `point-de-controle`) ;
4. **aucune règle existante modifiée, contournée ou contredite** : statut déclaré final ou irréversible, transition interdite, limite ou calcul déjà en place. Ajouter une possibilité que l'existant n'interdit pas est compatible ; autoriser ce que l'existant interdit ne l'est pas.

Propose le mode à Lucas en une ligne, **en citant la règle existante concernée** s'il y en a une (ex. « Complet : `archived` est irréversible dans `docs/listings.md`, le besoin le remet en cause »). Lucas confirme.
- **Express** : saute le canard (2). La doc de l'existant a déjà été mise à jour pendant le cadrage si elle en avait besoin.
- **Complet** sinon.

## 0 bis. Doc de l'existant (agent `documentaliste`, ~2 min, en arrière-plan pendant le cadrage)
Lancé à l'étape 0, en parallèle des questions à Lucas, seulement si la doc est absente ou en retard. Sinon : « Doc à jour ».
En cas de « BASCULE MODE COMPLET » du cadreur, relance-le ici si la doc ne couvre pas la règle en cause.

## 1. Mini-spec (agent `cadreur`, ~3 min)
Lance l'agent `cadreur` avec le slug (et le mode). Affiche la spec dans le chat.
S'il rend « BASCULE MODE COMPLET », annonce-le à Lucas avec la règle citée, puis reprends à l'étape 0 bis.
S'il rend « PÉRIMÈTRE INCERTAIN », montre-le tel quel à Lucas et attends sa réponse avant de continuer.
**Compte les critères de la spec.** Si le mode annoncé est express et que la spec en contient plus d'un, passe en complet toi-même (et lance le canard) en le disant à Lucas : la règle de l'étape 0 s'applique aussi après le cadreur.

## 2. Canard (agent `canard`, ~2 min, mode complet)
Lance l'agent `canard` avec le slug.
- `QUESTIONS` → relance `cadreur` en lui demandant de **répondre lui-même (code à l'appui, `fichier:ligne`) aux questions que le code tranche**, et de ne te remonter que celles qui demandent une décision de Lucas ; puis relance le canard. **Une seule boucle par défaut** ; s'il reste des questions, montre-les à Lucas.
- `FEU VERT` → étape suivante. Les « petits cas » éventuels vont au développeur, pas au cadreur.

Option : si Lucas tape `challenge`, lance aussi l'agent `challenger`.

## ✋ Décision 1 — Lucas valide la spec
Attends « go » (ou ses corrections), puis committe la spec : `docs(spec): {slug}` (fichiers `besoin.md`, `spec.md`, et `conception.md` s'il existe ; jamais `.canard-memoire.md`).

## 3 a. Conception des parties sensibles (agent `developpeur`, mode `conception`, ~3 min) — seulement si la spec en liste
Affiche `specs/{slug}/conception.md`. S'il n'y a pas de partie sensible, passe directement à l'étape 3.

## ✋ Contrôle 1 — Lucas valide la conception ⇉ le développeur avance sur le reste
**Dans le même message :**
- montre la conception à Lucas et attends « go », « corrige » ou « simplifie » ;
- lance l'agent `developpeur` **en arrière-plan** en mode `standard` : il implémente et committe les incréments **non sensibles** (CRUD, DTO, routes, câblage, mesure, exploitation), sans toucher aux fichiers de la partie sensible listés dans `conception.md`.

Rien de la partie sensible n'est codé avant le go. Si Lucas demande une correction, relance le mode `conception` ; le développeur en mode `standard` continue. **Attends la fin du mode `standard`** avant l'étape 3 (un seul développeur à la fois sur la partie sensible et l'historique Git). Pendant ce temps, Lucas ne modifie pas le code.

## 3. Implémentation (agent `developpeur`, mode `implementation`, ~10 min, ~5 min si le mode `standard` a tourné)
Lance l'agent `developpeur` avec le chemin de la spec, `base`, les « petits cas » du canard et la liste des incréments déjà committés par le mode `standard` (ne pas les refaire). Il avance par incréments testés et committés (skill `commit`), et ajoute ce qu'il faut pour mesurer l'impact et exploiter la fonctionnalité (rubriques « Mesure d'impact » et « Exploitation » de la spec).
Affiche : `git log --oneline {base}..HEAD`, tests ajoutés, résultat des tests.

## ✋ Contrôle 2 — Lucas valide le code de la partie sensible (seulement s'il y en a une)
Montre uniquement : les fichiers concernés, `git diff -- <ces fichiers>`, le tableau des cas de test avec leur résultat, les écarts avec la conception.
« commit », « corrige » ou « reprends la conception », puis relance le développeur en mode `finalisation` (ou `conception`).

**Tu n'écris pas le code toi-même** : si le développeur bloque, échoue ou est interrompu, dis-le à Lucas en une ligne et propose de le relancer avec une consigne précise (ou de livrer « tests seulement »). Reprendre son travail en silence brouille l'historique et ôte au garde-fou un regard indépendant.

**Chronomètre la vérification réelle : 5 minutes au total.** Si une assertion httpYac résiste après deux corrections, commente-la avec la raison, note-la dans « Écarts à la spec » (« ordre vérifié à l'œil » ou « tests seulement ») et passe au garde-fou ; ne crée pas de fichiers d'essai à côté.

Avant le garde-fou, vérifie que le développeur a rapporté une **vérification complète verte** (build + toute la suite) **et une vérification réelle** (application lancée, scénarios httpYac `http/{slug}.http` exécutés) ou la raison écrite de son impossibilité. Sinon, relance-le pour la faire.

## 4. Garde-fou (agent `garde-fou`, ~4 min)
Lance l'agent `garde-fou` sur `{base}..HEAD` (et sur ce qui ne serait pas committé), **hors `docs/`** : la doc de l'existant est mise à jour après lui par le documentaliste (étape 5).

## ✋ Décision 2 — Lucas trie les remarques
Pour chaque remarque : corriger, ignorer (avec sa raison) ou plus tard. Applique uniquement ce qu'il a choisi, puis relance les tests.
- Correction significative → nouveau commit `fix(...)` avec son test.
- Correction mineure → `git commit --fixup` sur le commit concerné.

## 5. Livraison (~2 min)
1. Range les fixup : `GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash {base}`.
2. **Optionnel** (proposer, ne pas lancer d'office en entretien) : vérifier que chaque commit est vert avec `git rebase --exec "<vérification complète du projet>" {base}`.
3. **Mise à jour de la doc, obligatoire.** Si le code committé rend une phrase de `docs/{module}.md` fausse ou incomplète (règle ajoutée ou changée, champ, statut, route, qui est authentifié), relance l'agent `documentaliste`, puis committe `docs(domaine): {module}`. N'annonce pas « Livré » avant. Si le temps manque, dis-le en toutes lettres dans la ligne « Doc » ci-dessous : une doc fausse induit en erreur le cycle suivant.
4. Toute requête ou commande donnée dans le message final (mesure d'impact, retour arrière) a été **exécutée pour de vrai** pendant la vérification réelle ; sinon dis-le. Vérifie aussi `git status` : l'arbre était propre à l'étape 0, donc **tout fichier non suivi ou modifié qui apparaît maintenant vient de ce cycle**, jamais « préexistant » (fichiers d'essai, artefacts de build). Supprime-le ou restaure-le, ou demande à Lucas de le faire si ton shell ne peut pas, avant d'annoncer « Livré ».
5. Affiche :
```
Livré — {slug}
Commits : git log --oneline {base}..HEAD
Critères couverts : CA1 ✅ vérifié en réel · CA2 ◻️ tests seulement (raison) …  (ne coche ✅ que ce qui a été vu en réel)
Impact attendu : {indicateur} — équipe {Croissance | Performance} — mesuré par {log / événement / requête}
Exploitation : {logs ajoutés} · Retour arrière : {en une ligne} · Feature flag : {oui/non}
Vérification réelle : http/{slug}.http — {n} scénarios, tous verts · commité | non commité ({raison})
Doc : mise à jour (docs/{module}.md) | PAS à jour — {raison}
Écarts à la spec : {recopiés du développeur et du garde-fou : comportement différent d'un critère, fichier hors liste, risque restant — ou « aucun »}
Reste ouvert : … (y compris les défauts préexistants rencontrés en route, même hors périmètre)
Message aux agents :
  {2 ou 3 phrases simples, sans jargon : ce qui change pour eux et comment s'en servir}
```

Jamais de `git push` sans demande explicite de Lucas.
