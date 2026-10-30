# Contexte — Lucas, product engineer

Je suis un product engineer : je pars d'un problème métier, pas d'un ticket, et je l'amène jusqu'en prod en restant responsable de ce que je livre.
Stack : NestJS + TypeScript (back), Next.js App Router (front), PostgreSQL, Kafka, Elasticsearch, Docker.

## Règles pour Claude

- Les agents sont des outils de vérification, pas une équipe. Je tranche toujours.
- Pas de formalisme inutile : spec courte dans `specs/{slug}/spec.md`, pas de PR GitHub, pas d'autre doc que `docs/{module}.md` (l'existant, tenu par le documentaliste).
- Livrer pour un impact mesurable : chaque besoin dit quel indicateur doit bouger et comment on le mesure.
- Pas de QA ni de relecture humaine : la sécurité vient de la façon de livrer (tests, logs, retour arrière, feature flag si risqué).
- Faire simple : la solution la plus simple qui répond au besoin réel. Pas de microservices, CQRS ou event sourcing sans besoin démontré.
- Les règles métier critiques sont couvertes par un test écrit AVANT le code.
- Montants en centimes entiers, jamais de flottants pour l'argent.
- Parties sensibles (algorithme, calcul qui touche l'argent, concurrence, nouvelle brique d'architecture) : je valide la conception avant le code, puis le code avant le commit (skill `point-de-controle`). Le reste avance sans moi.
- Commits significatifs et testables (skill `commit`) : 2 à 3 commits de code par cycle, une intention chacun, avec son test ; vérification rapide (types + tests liés) à chaque commit, vérification complète une seule fois avant le garde-fou ; jamais de commit pour un `;` ou une typo (`--fixup`). Jamais de `git push` sans mon accord.
- Les vérifications en conditions réelles s'écrivent en fichiers `.http` (httpYac) et se committent avec la fonctionnalité si le projet l'autorise.
- Un critère n'est « livré ✅ » que s'il a été vu fonctionner en réel (application lancée) quand le projet peut démarrer ; sinon on le dit.
- Toujours lire un fichier avant de le modifier ; respecter les conventions déjà en place.
- Réponses courtes. Signaler clairement une hypothèse ou un doute plutôt que de l'inventer.

## Agents (.claude/agents)

| Agent | Rôle |
| --- | --- |
| documentaliste | Documente l'existant (docs/{module}.md) si la doc est absente ou en retard sur le code |
| cadreur | Mini-spec : met au propre le besoin cadré par Lucas en critères vérifiables |
| canard | Challenge la mini-spec sans connaître ni la tech ni le métier |
| challenger | Challenge les choix techniques (max 3 points) |
| developpeur | Implémente en TDD par incréments, un commit vert par incrément |
| garde-fou | Outil de vérification des commits du cycle : conformité à la spec, sécurité, mesure, historique |

## Skills (.claude/skills)

nestjs, nextjs, kafka, elasticsearch (conventions de stack) · doc-existant · mini-spec · point-de-controle · review-diff · commit

## Workflows

- `/quickcycle "besoin"` : cycle court (~25 min). Mode express (spec courte, code, commit) pour un petit besoin sans partie sensible ; mode complet sinon.
- `/quickfix "bug"` : bug remonté par le support — test qui reproduit, correction, un commit `fix`, message pour la personne qui l'a remonté.
