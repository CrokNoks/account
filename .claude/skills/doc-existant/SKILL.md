---
name: doc-existant
description: Format de la documentation d'un module existant (docs/{module}.md) — vocabulaire, règles métier sourcées, entités, points d'entrée, zones d'ombre. À utiliser par l'agent documentaliste.
---

# Documentation d'un module existant

Fichier : `docs/{module}.md`. Une page maximum. Elle décrit l'existant, pas ce qu'on va construire.

```markdown
# {Module} — {une phrase : à quoi il sert pour l'utilisateur}

Mise à jour : {AAAA-MM-JJ} · Commit : {sha court}

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| annonce | … |

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Un véhicule de plus de 13 ans est refusé | `src/listings/eligibility.ts:12` | ✅ `eligibility.spec.ts` |

## Ce qu'on stocke
{Entité} : champ — sens (unité, valeurs possibles). Montants en centimes.

## Ce qu'on peut faire
| Action | Point d'entrée | Qui | Effet | Source |
| --- | --- | --- | --- | --- |
| Créer une annonce | `POST /listings` | agent connecté | annonce en brouillon | `src/listings/listings.controller.ts:24` |

## Statuts et transitions
{si le module a un cycle de vie : quels statuts, quelles transitions sont permises, lesquelles sont interdites}

## Zones d'ombre
- Ce que le code ne dit pas (le pourquoi d'une règle, une limite sans explication, un cas non géré).
```

## Règles d'écriture

- Une règle = une phrase qu'un non-développeur comprend, avec sa source.
- « Testée » : ✅ avec le nom du test, ou ❌ si aucun test ne la couvre.
- « Qui » dit précisément ce que le code vérifie : connecté (token exigé), identité lue si présente, propriétaire contrôlé ou non, personne. Il se lit dans le branchement du module et les décorateurs, pas seulement dans le contrôleur.
- Les décorateurs d'identité (`@User`…) se lisent jusqu'au bout : disent-ils la même chose avec et sans middleware ?
- Ne jamais combler une zone d'ombre par une supposition.
- Mise à jour : on complète et on corrige, on ne réécrit pas tout ; on met à jour la date et le commit en tête.
