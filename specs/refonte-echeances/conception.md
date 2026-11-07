# Conception — « récurrence déjà payée » partagé et point bas

Spec : `specs/refonte-echeances/spec.md`. Une seule conception, deux fonctions pures. Aucun code de production écrit.

## Ce que ça calcule ou décide
1. `isRecurringAlreadyPaid(recurring, day, transactions)` : vrai si une transaction du même jour, de même montant, dont le libellé contient celui de la récurrence (casse ignorée) existe.
2. `computeLowPoint(startDay, startBalance, events)` : le plus bas des soldes de fin de journée, de aujourd'hui à la fin de l'horizon, et le premier jour où il est atteint.

## Approche la plus simple
- Deux fichiers de domaine sans dépendance Nest ni dépôt, appelés par les deux cas d'usage. Pas de service, pas de classe.
- Le prédicat reprend le calendrier mot pour mot (`get-calendar-data.use-case.ts:69-76`), déplacé tel quel ; le calendrier l'appelle à la place de son code en ligne.
- La trésorerie l'appelle **pour le jour 0 seulement** et ne charge que les transactions d'aujourd'hui (`findAllByAccountUnpaginated(accountId, {startDate: today, endDate: today})`). Un seul appel de lecture en plus.
- Le point bas se calcule sur les événements déjà produits par la boucle (aucune seconde projection).

## La règle exacte (code actuel du calendrier)
```
alreadyPaid(rt, day, txs) = txs.some(t =>
     t.date.getTime() === day.getTime()
  && t.description.toLowerCase().includes(rt.description.toLowerCase())
  && t.amount === rt.amount)            // bigint, centimes
```
Ni statut (`pending`, rapprochée) ni catégorie ne comptent. Signature structurelle : `{date, description, amount}` pour la transaction, `{description, amount}` pour la récurrence.
Une transaction peut écarter plusieurs récurrences identiques (comportement actuel conservé, voir doutes).

## Comportement à aujourd'hui
- Trésorerie, jour 0 : récurrence due aujourd'hui et déjà payée : ni événement ni ajout au solde (déjà dans le solde du jour). Non payée : comptée (événement + solde).
- Trésorerie, jours 1 à `days` : jamais écartée (la transaction future n'est pas dans le solde ; l'écarter ferait disparaître le montant).
- Calendrier : inchangé (aujourd'hui et jours futurs du mois, prédicat identique). Il ajoute seulement `pending` à l'événement réel.
- Compteur pour le journal `cashflow_forecast_built` : nombre de récurrences écartées au jour 0 (ni montant ni libellé dans le journal).

## Point bas
```
balance = startBalance            // solde du jour, centimes (bigint)
best = null
pour chaque jour d = 0..days (dans l'ordre) :
    balance += somme des montants des événements de ce jour   // fin de journée
    si best == null ou balance < best.balance (strict) : best = {date: jour, balance}
renvoie best
```
- Strictement inférieur : en cas d'égalité, le premier jour est conservé.
- Le solde est celui de **fin de journée** : plusieurs événements le même jour sont additionnés avant comparaison, jamais comparés un à un.
- Aujourd'hui est candidat avec ses propres récurrences non payées (jour 0 = solde du jour + elles). Sans événement : `{date: aujourd'hui, balance: solde du jour}`.
- Entrée : `startDay: Date`, `startBalance: bigint`, `events: {date: string, amount: bigint}[]` (triés par jour, comme la boucle). On n'itère que les jours porteurs d'événements plus le jour 0 : un jour sans événement a le solde de la veille et ne peut pas battre un solde déjà vu.
- Sortie dans la réponse : `lowPoint: { date: string /* ISO du jour, comme les événements */, balance: string /* centimes */ }`. Toujours présent (jamais null).
- Aucun flottant : tout est `bigint`, converti en chaîne à la sortie.

## Fichiers occupés
- Créer : `functions/src/reporting/domain/recurring-already-paid.ts` + `.spec.ts`, `cashflow-low-point.ts` + `.spec.ts`.
- Modifier : `get-cashflow-forecast.use-case.ts` + `.spec.ts` (prédicat jour 0, `lowPoint`, journal), `get-calendar-data.use-case.ts` + `.spec.ts` (prédicat partagé, `pending`), `test/front-contract.e2e-spec.ts` (bloc cashflow : `lowPoint`).
- `docs/reporting.md` (règle « Trésorerie prévue ») : mise à jour par le documentaliste, pas dans ce développement.

## Exploitation
Journal `cashflow_forecast_built` : compte, horizon, nombre de récurrences, nombre écartées comme déjà payées. Retour arrière : revert des commits ; aucune donnée ni migration.

## Alternative écartée
Écarter la récurrence payée à tous les jours de la courbe, ou comparer au solde par jour : faux pour un jour futur (la transaction n'est pas dans le solde) et plus de lectures. Autre piste : « déjà payée » par appariement un-pour-un (une transaction ne couvre qu'une récurrence) : plus juste mais change le calendrier, hors spec.

## Cas de test écrits avant le code
Base : aujourd'hui = 2026-04-28, solde du jour 105 000 (100 000 initial + 5 000), `Internet` -3 000 le 28, `Loyer` -85 000 le 1, `Salaire` +250 000 le 30, `Fin de mois longue` -100 le 31.

**`recurring-already-paid.spec.ts`**
| Entrées | Attendu | Pourquoi |
| --- | --- | --- |
| tx même jour, -3000, « Prélèvement Internet » ; récurrence « Internet » -3000 | vrai | déjà payée aujourd'hui |
| libellé tx « INTERNET SFR », récurrence « internet » | vrai | casse |
| tx -2999 (ou +3000) | faux | montant différent |
| tx « Edf », récurrence « Internet » ; tx « Int », récurrence « Internet » | faux | libellé non contenu (le sens compte) |
| tx la veille / le lendemain | faux | autre jour |
| tx `pending` ou rapprochée, autre catégorie | vrai | aucun filtre statut ni catégorie |
| aucune transaction | faux | liste vide |
| deux récurrences identiques, une transaction | vrai pour chacune | comportement actuel conservé |

**`cashflow-low-point.spec.ts`** (départ 28 avril, 100 000)
| Entrées | Attendu | Pourquoi |
| --- | --- | --- |
| aucun événement | 28 avril, 100 000 | aucune récurrence |
| jour 3 : -90 000 puis +100 000 (même jour) | 28 avril, 100 000 | fin de journée (110 000 le jour 3), pas 10 000 intermédiaire |
| 28 avril -3 000 | 28 avril, 97 000 | les événements d'aujourd'hui comptent |
| j2 -50 000, j3 +50 000, j4 -50 000 | j2, 50 000 | égalité : premier jour |
| j2 -0 puis retour à 100 000 plus tard | 28 avril | égalité avec aujourd'hui : aujourd'hui |
| que des entrées | 28 avril, 100 000 | premier jour = aujourd'hui |
| 10 000 ; j3 -30 000 ; j6 -5 000 | j6, -25 000 | solde négatif, chaîne `"-25000"` |

**`get-cashflow-forecast.use-case.spec.ts`**
| Entrées | Attendu | Pourquoi |
| --- | --- | --- |
| tx « Prélèvement internet » -3000 aujourd'hui | pas d'événement Internet le 28 ; solde 105 000 | (a) comptée une fois (dans le solde) |
| aucune tx aujourd'hui | événement Internet le 28, solde projeté 102 000 | (b) non payée comptée |
| tx aujourd'hui -2 999 ; tx « Edf » -3000 | Internet comptée | (c) montant ou libellé différent |
| casse « INTERNET » | écartée | casse |
| 2 récurrences « Internet » -3000, 1 tx -3000 | aucune comptée, journal : 2 écartées | deux identiques, comportement conservé |
| 2 récurrences identiques, aucune tx | 2 événements le 28 | contrôle |
| tx « Salaire » +250 000 datée du 30 (future) | Salaire comptée le 30 ; lecture des transactions limitée à aujourd'hui | (d) jour futur non écarté |
| tx `pending` aujourd'hui qui correspond | écartée | `pending` du jour déjà dans le solde |
| `pending` demain + sa récurrence demain | comptée une fois | pas de tx future lue, récurrence ajoutée |
| aujourd'hui = 30 avril, tx « Fin de mois longue » -100 | écartée | récurrence au 31 en avril (tombe le 30) |
| horizon 5, 31 en avril | « Fin de mois longue » le 30 avril, avec Salaire : 2 événements ce jour | plusieurs événements le même jour |
| récurrences Loyer -85 000 (j1), « Gros » -50 000 (j15), solde 105 000 ; 30 / 60 / 90 j | point bas 15 mai -30 000 / 15 juin -165 000 / 15 juillet -300 000 | horizon change le point bas |
| aucune récurrence | point bas = 28 avril, 105 000 ; `events` vide | aucune récurrence |
| lowPoint de la réponse = `computeLowPoint` sur les événements | égal | pas de recalcul divergent |
| journal | `cashflow_forecast_built` sans montant ni libellé | exploitation |

**`get-calendar-data.use-case.spec.ts`** (non-régression)
| Entrées | Attendu | Pourquoi |
| --- | --- | --- |
| spec existant « not project already paid » | inchangé | (e) |
| spec existant « return actual and projected » | inchangé | (e) |
| `pending` future 20 mars + sa récurrence, même montant et libellé | récurrence écartée, événement réel avec `pending: true` | (e) `pending` future |
| même scénario que la trésorerie (jour 0) dans les deux specs | même décision d'écarter | (g) prédicat partagé |

## Doutes
1. **Deux récurrences identiques, une seule transaction** : les deux sont écartées, donc la courbe sous-compte une récurrence (la transaction n'a payé que l'une des deux). Conservé car la spec le veut ; erreur de -3 000 dans l'exemple.
2. **Point bas et solde du jour** : le point bas peut être plus bas que le solde du jour dès aujourd'hui (récurrences non payées du jour comprises). Le front doit le dire sans le recalculer.
3. **Lecture d'aujourd'hui** : `getTime()` suppose des dates à minuit UTC en sortie du dépôt (le calendrier le suppose déjà). À confirmer par le `.http` en réel sur la trésorerie, car aucun test unitaire ne le prouve.
4. Le solde du jour contient les `pending` (hypothèse de la spec) : le point bas peut donc différer du « solde à venir » d'Aujourd'hui.
