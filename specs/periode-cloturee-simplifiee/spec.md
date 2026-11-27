# Période clôturée simplifiée (écran Aujourd'hui)

## Le problème
Sur Aujourd'hui, une période clôturée (`isActive` faux) affiche « Prévu le {fin} » et la composition du prévu. Une projection de fin de période n'a plus de sens une fois la période finie : le chiffre trompe celui qui relit une période passée.

## Critères d'acceptation
- [ ] CA1 — Étant donné une période clôturée sélectionnée, quand j'ouvre Aujourd'hui (bureau ou mobile), alors le chiffre principal du bloc du haut est « Solde en banque au {date de fin courte} » et vaut le solde en banque (`realBankBalance`) de cette période.
- [ ] CA2 — Étant donné une période clôturée, alors ni « Prévu le … » / « Prévu en fin de période », ni le solde « À venir », ni la composition du prévu (barre, lignes signées, volet « Budget restant par catégorie ») ne s'affichent, bureau et mobile.
- [ ] CA3 — Étant donné une période clôturée, alors le bloc « Budgets variables » (toutes les catégories de dépense : budget, réel, dépassement ou reste) s'affiche, sur bureau comme sur mobile ; sur mobile, il remplace « Budgets à surveiller ».
- [ ] CA4 — Étant donné une période clôturée, alors rythme de dépense, À traiter, Factures (prochaines échéances) et « Budgets à surveiller » ne s'affichent pas ; le sélecteur de période reste présent et change l'affichage dès qu'on choisit une autre période.
- [ ] CA5 — Étant donné une période clôturée sans date de fin (fin estimée absente), alors le libellé est « Solde en banque » sans date.
- [ ] CA6 — Étant donné la période active, alors l'écran est identique à aujourd'hui (prévu, En banque, À venir, composition, rythme, À traiter, Factures, Budgets variables / à surveiller).
- [ ] CA7 — Quand je passe d'une période clôturée à la période active (et inversement), alors l'écran bascule entre les deux affichages sans rechargement.

## Règle critique
Le chiffre principal d'une période clôturée est le `realBankBalance` fourni par les stats, jamais le prévu ni un calcul côté front ; et rien de « prévu » (prévu, À venir, composition) n'est visible sur une période clôturée. Testée avant le code (rendu de `BalanceBar` période clôturée vs active).

Vérifié dans le code : pour une période fermée, le solde en banque = départ pointé + pointées datées jusqu'à la fin, sans revenu tardif (`functions/src/reporting/domain/forecast-composition.ts:92-107`, `docs/reporting.md` règle « En banque »). Donc front uniquement.

## Mesure d'impact
- Indicateur qui doit bouger : chiffres trompeurs vus en relisant une période passée (prévu sans sens) : zéro.
- Équipe qui en profite : Performance (lecture plus claire).
- Comment on le mesure : à l'œil par Lucas (réponse 3 de `besoin.md`), pas d'indicateur chiffré ni de log.

## Exploitation
- Rien de particulier à voir en prod (affichage seul).
- Retour arrière : revert du commit front.
- Feature flag : non.

## Parties sensibles
Aucune (affichage ; aucun calcul d'argent nouveau, le montant vient du back).

## Ce qui change dans l'existant
- Change la règle de `docs/reporting.md` (section Front, écran Aujourd'hui) : « s'affichent que cette période soit active ou clôturée : aucun masquage selon l'état de la période ». Désormais Aujourd'hui masque des blocs sur une période clôturée.
- Change « Aujourd'hui : titre du prévu » (`docs/reporting.md`, tableau « sous-titres ») : « Prévu le {fin} » ne vaut plus que pour la période active.
- Les autres écrans (Opérations, Budgets, Analyses, Échéances) ne bougent pas.

## Fichiers concernés
- À modifier : `frontend/src/features/reporting/ui/dashboard-stats.tsx` — `BalanceBar` : variante période clôturée (titre, chiffre principal = `realBankBalance`, sans À venir ni composition)
- À modifier : `frontend/src/app/[locale]/(dashboard)/page.tsx` — blocs affichés selon `period.isActive` ; `BudgetBreakdown` visible sur mobile si clôturée, `BudgetsToWatch` masqué
- À modifier : `frontend/messages/fr.json`, `frontend/messages/en.json` — nouveau message « Solde en banque au {date} » / sans date (section `Dashboard`)
- Lu, a priori inchangé : `forecast-composition.tsx` (rendu seulement par `BalanceBar`), `budget-breakdown.tsx` (déjà en dépenses seules), `budgets-to-watch.tsx`
- Tests : `frontend/src/features/reporting/ui/dashboard-stats.test.tsx`, `frontend/src/app/[locale]/(dashboard)/page.test.tsx` (existent : y ajouter)
- Doc : `docs/reporting.md` (documentaliste)

## Hors périmètre
- Back, calcul des soldes.
- Autres écrans qui montrent du prévu ou du solde à venir (en-tête d'Opérations, Budgets).
- Rien de nouveau dans « Budgets variables » (contenu inchangé).

## Hypothèses
- **(`besoin.md`, confirmée par Lucas)** « Ne garder que » : sur période clôturée, les autres blocs (rythme, À traiter, Budgets à surveiller, Factures) ne s'affichent pas. Appliquée en CA4.
- Le périmètre est l'écran Aujourd'hui seul (la capture du besoin) ; les autres écrans qui montrent du prévu restent tels quels.
- « Clôturée » = période trouvée dans la liste des périodes avec `isActive` faux ; tant que la période n'est pas chargée, l'affichage reste celui d'aujourd'hui (pas de bascule intermédiaire).
- Sur bureau, la place laissée par les blocs retirés (largeur de « Budgets variables ») est laissée au développeur.
- Le solde en banque d'une période clôturée n'inclut que les opérations pointées (règle existante) : une CB non pointée de la période n'y est pas.

## Décisions
- Visite guidée du tableau de bord (décision Lucas) : elle ne démarre automatiquement que si la période sélectionnée est active (ses cibles `to-handle`, `budget-breakdown`… n'existent pas toutes sur une période clôturée).

## Petits cas (canard)
- Visite guidée sur période clôturée : ne plante pas, ne démarre pas ; test.
- Solde en banque négatif ou nul sur période clôturée : affiché comme tout solde (`presentAmount` `balance`).
- Pas de clignotement : tant que les périodes ne sont pas chargées, affichage actuel.
