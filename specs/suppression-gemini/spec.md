# Suppression de Gemini (analyses IA et scan de ticket)

## Le problème
Gemini (service d'IA de Google) est payant et sert à trois fonctionnalités : analyse IA de période (widget `insights` du tableau de bord), analyse IA d'évolution (carte de la page Évolution) et scan de ticket (bouton « Scanner » du tiroir de création de transaction). Lucas ne veut plus payer : Gemini et ces trois fonctionnalités sont retirés du front et du back, sans remplacement.

## Critères d'acceptation
- [ ] CA1 — Étant donné le tableau de bord, quand on l'ouvre, alors aucun widget « IA Insights / AI Insights » n'est affiché et aucun appel à une route `ai-insights` n'est émis.
- [ ] CA2 — Étant donné un utilisateur dont la disposition enregistrée contient `insights`, quand il ouvre le tableau de bord ou passe en édition, alors `insights` n'apparaît ni dans les widgets actifs ni dans les widgets ajoutables, et les autres widgets gardent leur ordre, leur largeur et leur visibilité.
- [ ] CA3 — Étant donné la page Évolution, quand on l'ouvre, alors le graphique et le reste de la page s'affichent sans carte d'analyse IA et sans appel `evolution/ai-insights`.
- [ ] CA4 — Étant donné le tiroir de création de transaction (transaction ou virement), quand on l'ouvre, alors il n'y a plus de bouton « Scanner » et la saisie manuelle fonctionne comme avant.
- [ ] CA5 — Étant donné l'API, quand on appelle `GET /:accountId/periods/:periodId/reporting/ai-insights`, `GET /:accountId/reporting/evolution/ai-insights` ou `POST /:accountId/reporting/scan-receipt`, alors la réponse est une 404 (route inexistante).
- [ ] CA6 — Étant donné le code, la CI et les fichiers d'exemple d'environnement, quand on cherche `gemini` / `GEMINI_API_KEY` (hors `docs/` et `specs/`), alors il n'y a plus aucune occurrence, et le back démarre sans cette variable.
- [ ] CA7 — Étant donné les autres routes de reporting (stats, répartition, comparaison, Sankey, évolution, trésorerie, tags, calendrier, anomalies, patrimoine net), quand on les appelle, alors leur comportement et leurs tests sont inchangés.

## Règle critique
Une disposition de tableau de bord déjà enregistrée contenant `insights` ne doit jamais casser le tableau de bord : le widget disparaît sans erreur ni libellé brut, les autres widgets restent en place (CA2). Test écrit avant le code. Aujourd'hui, un id inconnu est ignoré à l'affichage (`frontend/src/app/[locale]/(dashboard)/page.tsx:247`) mais, en mode édition, il serait listé avec son id brut (`page.tsx:70`) : c'est ce cas qu'il faut couvrir.

## Mesure d'impact
- Indicateur qui doit bouger : coût de l'API Gemini ramené à 0 €.
- Équipe qui en profite : Performance (coût d'exploitation réduit).
- Comment on le mesure : plus aucune occurrence de `gemini` / `GEMINI_API_KEY` dans le code et la CI (grep, CA6) ; consommation à 0 dans la facture Google AI Studio après déploiement.

## Exploitation
- À voir en prod : des 404 sur les 3 routes supprimées (anciens fronts en cache) sont attendues et acceptées par Lucas ; aucune autre erreur nouvelle.
- Retour arrière : `git revert` des commits de suppression (la clé et le secret CI devront alors être recréés si déjà supprimés).
- Feature flag : non (suppression pure).

## Parties sensibles
Aucune (suppression pure, pas d'argent, d'algorithme, de concurrence ni de nouvelle brique).

## Ce qui change dans l'existant
- `docs/reporting.md` : retire les règles l.43-48 (analyse IA de période, analyse IA d'évolution, Gemini, scan de ticket, front scan, front IA), les routes l.62, 64, 66, la ligne de vocabulaire « Gemini » (l.17), la zone d'ombre l.82, les cartes IA de la description du front (l.74) et la mention « analyse IA » du titre, de la formule « stats (cartes, analyse IA) » (l.14) et du cache IA en mémoire (l.51). À faire par le documentaliste.
- `docs/preferences.md` : le catalogue passe de 16 à 15 widgets (`insights` retiré, l.39).
- Chemins d'exposition de la règle « widget `insights` » : tableau de bord (CA1), édition de la disposition (CA2), disposition enregistrée en base (CA2). Chemins d'exposition des routes IA : les 3 routes (CA5), cartes front (CA1, CA3), bouton (CA4). Aucun autre chemin (liste, fil, export) ne les consomme.

## Fichiers concernés
Vérifiés par grep ; `transaction-list.tsx`, `tag-detail-drawer.tsx`, `bottom-nav.tsx`, `command-menu.tsx`, `sidebar.tsx` ne contiennent ni Gemini, ni insight, ni scan : hors périmètre. La migration `supabase/migrations/20260316000000_create_user_preferences.sql` (défaut historique contenant `insights`) est déjà remplacée par les migrations `…01` et `…03` (voir `docs/preferences.md` l.22) : à ne pas toucher.

Back (le schéma est géré par `supabase/migrations/` ; aucune migration nécessaire) :
- Supprimer : `functions/src/reporting/application/gemini.service.ts` (+ `gemini.service.spec.ts`)
- Supprimer : `functions/src/reporting/application/get-ai-insights.use-case.ts`
- Supprimer : `functions/src/reporting/application/get-evolution-ai-insights.use-case.ts`
- Supprimer : `functions/src/reporting/application/ai-insights.use-cases.spec.ts` (couvre les deux cas d'usage ci-dessus)
- Supprimer : `functions/src/reporting/application/scan-receipt.use-case.ts` (+ `scan-receipt.use-case.spec.ts`)
- Modifier : `functions/src/reporting/infrastructure/reporting.controller.ts` — 3 routes, `ScanReceiptDto`, injections et imports (l.40-41, 69-71, 126, 258-259, 267, 355-397)
- Modifier : `functions/src/reporting/reporting.module.ts` — providers (l.14-15, 23-24, 44-45, 53-54)
- Modifier : `functions/package.json` — `axios` n'est utilisé que par `gemini.service*` côté back (à retirer, avec le lockfile)
- Modifier : `.github/workflows/deploy-functions.yml` — ligne `GEMINI_API_KEY` (l.54)
- Modifier : `functions/.env` et `.env` (racine), non versionnés (`.gitignore`) — ligne `GEMINI_API_KEY` (l.5)
- Tests e2e à modifier : `functions/test/e2e-env.ts` (l.6), `functions/test/e2e-app.ts` (import l.16, mock l.65), `functions/test/front-contract.e2e-spec.ts` (bloc « receipt scan » l.176-206), `functions/test/auth.e2e-spec.ts` (l.42), `functions/test/validation.e2e-spec.ts` (l.64), `functions/test/account-ownership.e2e-spec.ts` (l.350)

Front :
- Supprimer : `frontend/src/features/reporting/api/use-ai-insights.ts`, `use-evolution-ai-insights.ts`, `use-scan-receipt.ts`
- Supprimer : `frontend/src/features/reporting/ui/ai-insights-card.tsx`, `evolution-ai-insights-card.tsx`, `base-ai-insights-card.tsx` (+ `base-ai-insights-card.test.tsx`)
- Modifier : `frontend/src/features/reporting/model/types.ts` — type `ScanReceiptResponse` (l.116)
- Modifier : `frontend/src/app/[locale]/(dashboard)/evolution/page.tsx` — carte (l.4, 22)
- Modifier : `frontend/src/features/preferences/config/dashboard-widgets.tsx` — import l.20, entrées `insights` l.36 et l.63
- Modifier : `frontend/src/app/[locale]/(dashboard)/page.tsx` — ignorer `insights` dans la disposition enregistrée (CA2, l.62-85)
- Modifier : `frontend/src/features/transactions/ui/create-transaction-drawer.tsx` — bouton, upload, redimensionnement, notifications de scan (l.16, 33-96, ~160-175)
- Modifier : `frontend/messages/en.json` et `fr.json` — `Dashboard.widgets.insights` (l.65), `Reporting.ai` (en l.206-213), `scan` du tiroir (l.302-306)
- Modifier : `frontend/package.json` — `react-markdown` n'est utilisé que par `base-ai-insights-card.tsx` (à retirer, avec le lockfile)
- Tests : `frontend/src/features/transactions/ui/create-transaction-drawer.test.tsx` (ne garder que ce qui ne concerne pas le scan : le fichier ne teste aujourd'hui que l'erreur de scan, donc le supprimer s'il ne reste rien) ; nouveau test de la règle critique près de `page.tsx` ou de `dashboard-widgets.tsx`.

Docs : `docs/reporting.md`, `docs/preferences.md` (voir plus haut).

## Hors périmètre
- Remplacement par un autre fournisseur d'IA ou saisie assistée alternative (« aucun remplacement »).
- Nettoyage en base des dispositions enregistrées contenant `insights` (le front les ignore) ; pas de migration de données.
- Redirection ou message pour les anciens fronts : une 404 suffit (Lucas).

## Hypothèses
- Supprimer les dépendances `axios` (back) et `react-markdown` (front) : usages vérifiés par grep, à reconfirmer à la compilation.
- Le widget `insights` retiré de la disposition en mémoire sera aussi absent de la disposition réenregistrée au prochain enregistrement (le remplacement est complet, `docs/preferences.md` l.20).
- Le secret GitHub `GEMINI_API_KEY` et les clés sur les postes sont supprimés par Lucas, hors code.

## Points ouverts
- Les clés Gemini sont en clair dans `functions/.env` et `.env` (non versionnés). Faut-il les révoquer dans Google AI Studio ? Révoquer est le seul moyen d'être sûr que le coût reste à 0 € (Lucas à trancher, hors code).
