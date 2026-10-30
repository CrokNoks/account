---
name: review-diff
description: Checklist de relecture des commits d'un cycle contre la mini-spec (code et historique), avec classement des remarques par gravité. À utiliser par l'agent garde-fou.
---

# Relecture du diff

Périmètre : le code, les tests, la spec et la conception. `docs/` est hors périmètre (tenu par le documentaliste, qui passe après).

## Ordre de vérification

1. **Conformité** : chaque critère d'acceptation est-il implémenté et testé ? Y a-t-il du code hors périmètre ?
2. **Règle critique** : un test la couvre-t-il, et échouerait-il si la règle était cassée ?
3. **Données et argent** : transactions, montants en centimes, concurrence (deux écritures simultanées), idempotence.
4. **Sécurité** : validation des entrées (DTO), droits (guards), injection SQL, secrets, Server Actions exposées.
5. **Robustesse** : cas vides, valeurs absentes, erreurs non gérées, `await` manquants.
6. **Simplicité** : abstraction ou dépendance inutile ; code mort.
7. **Mesure et exploitation** : ce que demandent les rubriques « Mesure d'impact » et « Exploitation » de la spec est-il présent (log ou événement de mesure, logs des parties sensibles, feature flag) ? Aucune donnée personnelle dans les logs.
8. **Historique des commits** (skill `commit`) : chaque commit porte une seule intention, contient le test de ce qu'il ajoute et a un message clair ; aucun commit trivial (`;`, typo) ni test rouge seul ; rien de généré ni de secret committé. Signale les commits à fusionner (`--fixup`) ou à découper.

## Format de sortie

```
**Review — {slug}**

🔴 BLOQUANT — {problème} ({fichier:ligne})
   → Pourquoi : … → Correction proposée : …
🟠 À DISCUTER — …
🟢 OK — {ce qui est bien couvert, une ligne}

Critères : CA1 ✅ CA2 ✅ CA3 ⚠️ …
Commits : {n} — ✅ propres | ⚠️ {sha} à fusionner avec {sha} …
```

Maximum 6 remarques. La décision finale appartient à Lucas.
