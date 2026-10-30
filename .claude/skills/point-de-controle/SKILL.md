---
name: point-de-controle
description: Repérer les parties sensibles d'un développement (algorithme, calcul métier, concurrence, nouvelle architecture), faire valider leur conception par Lucas avant de coder, puis leur code avant de committer. À utiliser par le cadreur, le développeur et l'orchestrateur de /quickcycle.
---

# Point de contrôle sur les parties sensibles

Lucas ne relit pas tout. Il relit **la conception, puis le code, des seules parties sensibles**. Le reste avance et se committe seul.

## Qu'est-ce qu'une partie sensible ?

Une partie est sensible si au moins un critère est vrai :

| Critère | Exemples |
| --- | --- |
| Calcul métier qui touche l'argent | tarificateur, commission, remise, arrondi, TVA |
| Algorithme | optimisation, tri ou classement non trivial, matching, planification, scoring |
| Règle à plusieurs branches ou paliers | barème, grille, priorités entre règles |
| Concurrence ou cohérence des données | deux écritures simultanées, transaction, idempotence, événement Kafka |
| Nouvelle brique d'architecture | nouveau module, nouvelle table structurante, nouvel événement, nouvelle dépendance |

Ne sont **pas** sensibles : CRUD, DTO, câblage NestJS, affichage, tests, renommages. En cas de doute, demander à Lucas en une ligne plutôt que de bloquer.

Une partie sensible doit rester **petite à relire** : idéalement une fonction pure ou un service, moins de 150 lignes. Si c'est plus gros, la découper.

## Contrôle 1 — la conception, avant le code

Fichier : `specs/{slug}/conception.md`, une page maximum.

```markdown
# Conception — {partie sensible}

## Ce que ça calcule ou décide
Entrées → sortie, en une phrase.

## L'algorithme
Étapes numérotées ou pseudo-code (10 à 20 lignes), dans l'ordre d'exécution.

## Données et structure
Où vit la logique (fonction pure, service), quelles données elle lit, ce qu'elle écrit.

## Arrondis, limites et cas particuliers
Unité (centimes), règle d'arrondi, valeurs bornes, ordre de priorité des règles.

## Exploitation
Ce qu'on loguera pour comprendre une décision en prod, et comment revenir en arrière (feature flag, revert, recalcul).

## Alternative écartée
Une option plus simple ou plus robuste, et pourquoi on ne la prend pas.

## Cas de test qui prouvent que c'est juste
| Entrées | Résultat attendu | Pourquoi ce cas |
| --- | --- | --- |
```

Lucas répond : **go**, **corrige** (avec ses remarques) ou **simplifie**. Rien n'est codé avant le go.

## Contrôle 2 — le code, avant le commit

Une fois le code écrit et les tests verts, **ne pas committer**. Présenter à Lucas uniquement :

1. La liste des fichiers de la partie sensible et le diff limité à ces fichiers (`git diff -- <fichiers>`).
2. Le tableau des cas de test de la conception, avec le résultat obtenu (✅/❌).
3. Les écarts éventuels par rapport à la conception validée, et pourquoi.

Lucas répond : **commit**, **corrige** (avec ses remarques) ou **reprends la conception**. Le commit ne part qu'après son accord.
