# Besoin (tel quel, Lucas, 2026-11-26)

Lot 4a — import CSV en double (n°11 de la relecture du 2026-11-25). Réimporter le même relevé (ou un relevé qui chevauche le précédent) crée toutes les lignes une seconde fois : aucun contrôle de doublon à l'import (frontend transactions/import/page.tsx, handleImport ; back bulk-create-transactions.use-case.ts) ; les doublons ne sont signalés qu'après coup par les anomalies, et seulement pour les dépenses de 5 € ou plus. Comme l'import est aussi le chemin de la bascule de période et du nettoyage des pending récurrentes, un doublon fausse soldes, prévu et périodes. Piste : à l'étape de validation de l'import, signaler et décocher par défaut les lignes déjà présentes en base (même date, même montant, même libellé nettoyé), en comptant les occurrences (deux cafés identiques le même jour dans le relevé ne sont pas un doublon si un seul existe en base). Indicateur : nombre de lignes importées en double (requête lecture seule en prod avant/après), lignes écartées à l'import (log).

## Mesure de départ (orchestrateur, prod, lecture seule, 2026-11-26)
Transactions identiques (même compte, même date, même montant, même libellé aux espaces et à la casse près) : 39 groupes, 61 lignes en trop, sur 3 comptes. Ce chiffre mélange vrais doublons d'import et achats identiques réels (deux cafés le même jour).

## Questions à Lucas (cadrage, 2026-11-26)

Réponse de Lucas, tel quel : « 1 et 2 reco. 3 laisse comme ça ».
1. Une ligne de l'import strictement identique à une transaction déjà en base (même date, même montant, même libellé nettoyé), en comptant les occurrences, est décochée par défaut. Une ligne proche (même montant, quelques jours d'écart, autre libellé : ex. saisie à la main « Boulangerie −8,50 € » le 25, relevé « CB BOULANGERIE PAUL −8,50 € » le 26) est signalée sans être décochée : Lucas tranche à l'écran.
2. Une ligne décochée peut être recochée pour être importée quand même.
3. Les 61 lignes identiques déjà en prod restent telles quelles : aucun nettoyage dans ce cycle, ni liste à fournir.

## Décision 1 (Lucas, 2026-11-26 : « Go »)
1. Ligne « proche » : même montant, écart de 1 à 3 jours (pas 7).
2. Mesure : option A, l'import envoie au back un champ facultatif de comptage (lignes écartées, recochées, signalées proches), nombres seulement, journalisé en `info` sans libellé ni montant, sans effet sur l'écriture.
3. Pas de partie sensible : pas de contrôle de conception ; la règle de comptage est testée en premier.
