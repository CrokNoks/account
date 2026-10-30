---
name: mini-spec
description: Format de la mini-spec d'une fonctionnalité ou d'un correctif (besoin, critères d'acceptation, règle critique, hypothèses). À utiliser par l'agent cadreur.
---

# Mini-spec

Fichier : `specs/{slug}/spec.md`. Une page maximum.

```markdown
# {Titre court}

## Le problème
Une ou deux phrases : qui a quel problème, et ce que ça coûte.

## Critères d'acceptation
- [ ] CA1 — Étant donné …, quand …, alors …
- [ ] CA2 — …
(5 à 8 maximum, chacun testable)

## Règle critique
La règle qui coûterait le plus cher si elle était fausse. Elle sera testée avant le code.

## Mesure d'impact
- Indicateur qui doit bouger : (ventes, conversion, temps gagné par un agent, erreurs évitées…)
- Équipe qui en profite : Croissance (gagner plus) ou Performance (faire gagner du temps aux équipes)
- Comment on le mesure : log, événement ou requête à ajouter

## Exploitation
- Ce qu'on doit pouvoir voir en prod (logs, erreurs)
- Retour arrière : en une ligne (revert, feature flag, données à corriger)
- Feature flag : oui si le changement est risqué ou visible par tous les agents, sinon non

## Parties sensibles
Les parties qui passeront par le point de contrôle (skill `point-de-controle`) : nom + critère (ex. « Calcul du tarif — calcul métier qui touche l'argent »). Ou « Aucune ».

## Ce qui change dans l'existant
Les règles de `docs/{module}.md` modifiées ou contredites par ce besoin (ou « Aucune »).

## Fichiers concernés
Pour ceux qui construisent et vérifient (le canard l'ignore). Chemins exacts, une ligne chacun, avec le rôle du fichier :
- À modifier : `src/listings/listings.service.ts` — ajout de la règle X
- À créer : `src/offers/offers.module.ts` — nouveau module
- Tests : `src/listings/listings.service.spec.ts`
Liste courte et vérifiée (Glob/Grep) : seulement ce que le développeur devra lire ou toucher.

## Hors périmètre
Ce qu'on ne fait pas maintenant.

## Hypothèses
Ce qui n'a pas été confirmé par Lucas.

## Points ouverts
Questions que seul Lucas ou le métier peut trancher.
```

Règles d'écriture : phrases courtes, mots du métier expliqués une fois, aucun « évidemment » ni « comme d'habitude ».

Mode express : seulement « Le problème », 1 critère, « Mesure d'impact » en une ligne, « Exploitation » en une ligne et « Fichiers concernés ».
