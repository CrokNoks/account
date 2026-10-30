---
description: Correction rapide d'un bug remonté par le support ou un agent — reproduire par un test, corriger, vérifier en réel, mettre la doc à jour, committer, prévenir. Sans cadreur ni canard. Confié à l'agent correcteur.
argument-hint: "le bug tel qu'il a été remonté"
---

Bug : $ARGUMENTS

Cycle très court. Les devs font le support : on corrige vite, proprement, et on prévient la personne qui a remonté le problème. **Tu orchestres, tu n'écris pas le code** : le travail est confié à l'agent `correcteur`. Annonce chaque étape en une ligne.

## 1. Cadrage (~1 min)
- Vérifie que l'arbre Git est propre (`git status`). Sinon, montre-le à Lucas et attends.
- Note `base = git rev-parse --short HEAD`.
- Vérifie que `.git/info/exclude` contient `.claude` ; sinon ajoute-le.
- S'il manque une information essentielle pour reproduire le bug, pose UNE question à Lucas.

## 2. Diagnostic et correction (agent `correcteur`, mode `diagnostic-et-correction`, ~5 min)
Lance l'agent `correcteur` avec le texte du bug et `base`. Affiche son rapport.
- « NON REPRODUIT » : arrête-toi et dis-le à Lucas.
- Une question de l'agent : transmets-la à Lucas, puis relance.

## ✋ Contrôle — Lucas valide
- Montre le rapport (cause, test qui a échoué, diff, comportements qui changent).
- **Partie sensible : oui** (argent, données d'un autre utilisateur, concurrence) : le diff est validé par Lucas avant le commit (skill `point-de-controle`, contrôle 2 seulement). Attends « go » ou ses corrections.
- **« Même défaut ailleurs »** : demande à Lucas si on l'inclut dans le même correctif.
- Sinon, montre le rapport et passe à la suite sauf objection.

## 3. Finalisation (agent `correcteur`, mode `finalisation`, ~5 min)
Relance l'agent `correcteur` avec les décisions de Lucas. Il fait la vérification réelle (httpYac, 5 minutes au maximum), la doc, le commit unique, et rend le résumé. Affiche-le tel quel.

Toute requête ou commande donnée dans le résumé a été exécutée pour de vrai, sinon le résumé le dit.

**Tu n'écris pas le code toi-même** : si l'agent bloque, échoue ou est interrompu, dis-le à Lucas en une ligne et propose de le relancer avec une consigne précise (ou de livrer « tests seulement »).

Jamais de `git push` sans demande explicite de Lucas.
