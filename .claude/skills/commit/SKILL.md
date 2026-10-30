---
name: commit
description: Règles pour décider quand committer et comment écrire le commit (significatif, testable, message clair). À utiliser par l'agent developpeur et pendant /quickcycle à chaque fois qu'on envisage un commit.
---

# Commits significatifs et testables

## Quand committer

Un commit = **une intention complète** qu'on pourrait expliquer en une phrase et annuler seule.
On committe quand ces trois conditions sont réunies :

1. **Significatif** : le changement apporte quelque chose de vérifiable (une règle métier, un critère d'acceptation, un endpoint, une refacto qui prépare la suite).
2. **Testable** : le code ajouté vient avec son test dans le même commit, et le comportement est couvert.
3. **Vert** : la vérification rapide passe sur ce commit (vérification des types + tests liés aux fichiers modifiés). La vérification complète (build + toute la suite de tests) est faite une seule fois en fin d'implémentation, avant le garde-fou.

## Quand ne PAS committer

- Une correction triviale (un `;`, une faute de frappe, un import oublié, un renommage local) : elle rejoint le commit auquel elle appartient (`git commit --fixup <sha>`, puis autosquash en fin de cycle).
- Un test rouge seul (étape « rouge » du TDD) : le test et le code qui le fait passer partent ensemble.
- Du code en cours, commenté ou mort.
- Des fichiers générés (`dist/`, `coverage/`), des secrets ou un `.env`.

## Découpage type dans /quickcycle

| Commit | Contenu |
| --- | --- |
| `docs(spec): {slug}` | La mini-spec validée (`specs/{slug}/`) |
| `feat({scope}): {règle critique}` | La règle critique et son test |
| `feat({scope}): {groupe de critères}` | Plusieurs critères d'acceptation liés (même endpoint, même règle) et leurs tests |

**Viser 2 à 3 commits de code par cycle**, pas un par critère : chaque commit doit rester une intention qu'on explique en une phrase, mais on regroupe ce qui va ensemble.
| `fix({scope}): …` / `refactor({scope}): …` | Une correction issue de la review, seulement si elle est significative ; sinon `--fixup` |

## Message

Format Conventional Commits, description en français, à l'impératif, sans point final :

```
feat(listings): dupliquer une annonce sans copier la plaque

Couvre CA1 et CA3 de specs/duplicate-listing/spec.md.
La plaque, les photos et le statut ne sont pas copiés.
```

- Types : `feat`, `fix`, `test`, `refactor`, `docs`, `chore`.
- Le corps cite les critères couverts et explique le **pourquoi** si ce n'est pas évident.
- Jamais de `WIP`, `fix`, `update` seuls.

## Avant chaque commit

1. Vérification rapide avec les commandes **du projet** (scripts de `package.json`, `Makefile`, README — ne pas supposer un gestionnaire de paquets ni un outil de test) : vérification des types, puis uniquement les tests liés aux fichiers modifiés si l'outil de test le permet.
2. `git add -p` pour vérifier ce qu'on ajoute, puis `git diff --cached --stat`.

## Vérifier l'historique en fin de cycle

```bash
GIT_SEQUENCE_EDITOR=: git rebase -i --autosquash {base}  # range les fixup sans ouvrir d'éditeur
git rebase --exec "<vérification complète du projet>" {base}   # optionnel : chaque commit doit être vert
git log --oneline {base}..HEAD
```

Jamais de `git push` ni de réécriture d'un historique déjà poussé sans accord explicite de Lucas.
