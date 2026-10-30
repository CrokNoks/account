# Reporting — chiffres, graphiques, analyses IA et scan de ticket pour comprendre ses comptes

Mise à jour : 2026-10-30 · Commit : 157b272

Code : back `functions/src/reporting/` ; front `frontend/src/features/reporting/` ; fonctions SQL d'évolution dans `supabase/migrations/20260105*`, `20260127*`, `20260307120000_create_budget_stats_func.sql`, `20260308100000_add_sum_transactions_func.sql` (sauf `sum_transactions_before_date`, appelée via le dépôt de transactions pour le solde de départ, les cas d'usage calculent en TypeScript).

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Période | Intervalle de budget (début, fin éventuelle, active ou clôturée). |
| Réel / prévu | Réel = somme des transactions de la période ; prévu = budget alloué à la catégorie pour la période. |
| Solde en banque | Solde de départ + transactions rapprochées (`reconciled`, pointées avec le relevé). |
| Solde à venir | Solde de départ + transactions non « en attente » (`pending`). |
| Solde prévisionnel | Voir règles. |
| Anomalie | Transaction suspecte : doublon ou dépense inhabituelle. |
| Récurrente | Opération répétée chaque mois à un jour fixe. |
| Gemini | Service d'IA de Google, utilisé pour les analyses et le scan. |
| Sankey | Diagramme de flux : revenus → compte → dépenses / épargne / virements. |

Montants en centimes (texte dans les réponses), sauf Sankey (euros, nombre) et scan de ticket (nombre décimal en euros).

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Revenus réels = catégories de type revenu ou virement ; dépenses réelles = toutes les autres (dépenses et épargne). | `application/get-period-stats.use-case.ts:67-79` | ❌ |
| Solde de départ = solde initial du compte + transactions avant le début de la période. | `get-period-stats.use-case.ts:42-47` | ❌ |
| Solde prévisionnel = départ + max(revenus réels, prévus) − max(\|dépenses réelles\|, \|prévues\|). | `get-period-stats.use-case.ts:96-110` | ❌ |
| Stats : erreur si compte ou période introuvable. | `get-period-stats.use-case.ts:36` | ❌ |
| Répartition budget : par catégorie réel, budget, reste (= budget + réel), % consommé ; le % est inversé (rendu positif) pour les dépenses. Classée en revenus / dépenses / épargne / virements. | `get-budget-breakdown.use-case.ts:62-90` | ❌ |
| Comparaison : différence = période B − période A ; % = différence / \|A\| (0 si A vaut 0). Le « `compareWith` » de l'URL joue le rôle de la période 1, la période de l'URL celui de la 2. | `get-period-comparison.use-case.ts:46-76`, `reporting.controller.ts:278-290` | ❌ |
| Évolution : une ligne par période triée par date ; ici le prévisionnel = départ + toutes les transactions de la période (≠ formule des stats). | `get-evolution.use-case.ts:104-106` | ❌ |
| Sankey : une catégorie n'apparaît que si son montant ≠ 0 ; valeurs en valeur absolue, en euros. | `get-sankey-data.use-case.ts:58-117` | ❌ |
| Patrimoine net : somme, sur tous les comptes accessibles à l'utilisateur, du solde initial + toutes les transactions ; l'historique couvre 30 jours mais renvoie la même valeur (solde d'il y a 30 jours) chaque jour (la boucle ne rejoue pas les transactions). | `get-net-worth.use-case.ts:28-99` | ❌ |
| Trésorerie prévue : solde du jour (transactions jusqu'à aujourd'hui inclus) puis, jour par jour sur `days` jours (entier de 1 à 365, 90 par défaut ; hors de ces bornes ou non numérique → 400), ajout de chaque récurrente dont le jour du mois correspond. Même si elle a déjà été payée aujourd'hui, elle est comptée. | `get-cashflow-forecast.use-case.ts:34-75`, `reporting.controller.ts` (`CashflowQueryDto`) | ✅ e2e `front-contract.e2e-spec.ts` (défaut 90, bornes, 400) |
| Calendrier d'un mois : transactions réelles + récurrentes projetées pour aujourd'hui et les jours futurs du mois ; une récurrente est écartée si le même jour existe une transaction au même montant dont la description contient son libellé. Trié par date. | `get-calendar-data.use-case.ts:63-96` | ✅ `get-calendar-data.use-case.spec.ts` (« return actual and projected », « not project already paid ») |
| Résumé par tag : total et nombre de transactions par tag, trié par montant absolu décroissant ; couleur par défaut `#94a3b8`. Détail d'un tag : erreur si le tag est d'un autre compte ; répartition par catégorie en % du total absolu ; 5 dernières transactions. | `get-tags-summary.use-case.ts`, `get-tag-details.use-case.ts:50-135` | ❌ |
| Anomalie « doublon » : plusieurs dépenses le même jour avec le même montant ; ignore revenus et dépenses de moins de 5 € (montant > −500 centimes). | `get-anomalies.use-case.ts:80-88` | ✅ `get-anomalies.use-case.spec.ts` (doublons, petits montants) |
| Anomalie « dépense inhabituelle » : dépense catégorisée plus de 3 fois supérieure à la moyenne des 6 mois précédents de sa catégorie, avec au moins 3 transactions d'historique. | `get-anomalies.use-case.ts:118-141` | ✅ idem (« outlier > 3x ») |
| Période d'analyse des anomalies : la période donnée, sinon le mois en cours ; historique = 6 mois avant le début. | `get-anomalies.use-case.ts:28-47` | ❌ |
| Ignorer une anomalie : ajoute le type dans les métadonnées de chaque transaction listée ; une transaction d'un autre compte ou inconnue est silencieusement sautée. Les anomalies ignorées ne ressortent plus. | `ignore-anomaly.use-case.ts:12-34` | ✅ `ignore-anomaly.use-case.spec.ts` (3 cas) ; « ignorées » ✅ `get-anomalies...spec` |
| Le type « spike » est accepté à l'ignorance mais aucune détection ne le produit. | `reporting.controller.ts:81`, `get-anomalies.use-case.ts:8` | ❌ |
| Analyse IA de période : envoie à Gemini revenus/dépenses réels et prévus, solde prévisionnel, 8 premières dépenses, épargne, description du compte ; réponse ≤ 150 mots en français ou anglais (`locale`, français par défaut). | `get-ai-insights.use-case.ts:17-62` | ❌ |
| Analyse IA d'évolution : 6 dernières périodes clôturées ; si aucune, message « pas assez de données ». | `get-evolution-ai-insights.use-case.ts:15-57` | ❌ |
| Gemini : sans clé `GEMINI_API_KEY`, renvoie un texte d'erreur (pas d'exception) ; réponses gardées 15 min en mémoire par texte de demande ; quota dépassé (429) ou autre erreur renvoient un message en texte normal. Modèle `gemini-flash-latest`. | `gemini.service.ts:22-82` | ❌ |
| Scan de ticket : image + type MIME envoyés à Gemini, qui doit répondre en JSON (date, montant signé, enseigne, DEBIT/CREDIT). Toute erreur ou JSON illisible renvoie quatre champs vides, sans erreur. Un montant 0 devient vide. Sans clé IA, même résultat vide. | `scan-receipt.use-case.ts:21-69` | ❌ |
| Front scan : l'image est réduite à 1024 px max et envoyée en JPEG ; seuls date, montant et description préremplissent le formulaire de transaction (le type DEBIT/CREDIT est ignoré). | `frontend/src/features/transactions/ui/create-transaction-drawer.tsx:41-96` | ❌ |
| Front IA : résultat gardé 30 min (`staleTime`), langue = langue de l'interface. | `frontend/src/features/reporting/api/use-ai-insights.ts:15` | ❌ |

## Ce qu'on stocke
Rien en propre (tables lues : transactions, catégories, budgets, périodes, récurrentes, tags, comptes). Seule écriture : l'ignorance d'anomalie ajoute `ignoredAnomalies` (liste de types) dans les métadonnées d'une transaction. Le cache IA est en mémoire du serveur (perdu au redémarrage, non partagé entre instances).

## Ce qu'on peut faire
Identité : toutes les routes sont sous `SupabaseAuthGuard` (jeton Supabase exigé ; identité `{id,email}` dans le jeton). Pas de middleware. Aucun cas d'usage ne vérifie que `accountId` appartient à l'utilisateur : la protection repose sur la RLS de la base (client créé avec l'en-tête `Authorization` de l'appelant, `functions/src/supabase/supabase.module.ts`).

| Action | Point d'entrée (préfixe `/:accountId`) | Qui | Effet | Source (`reporting.controller.ts`) |
| --- | --- | --- | --- | --- |
| Stats d'une période | `GET /periods/:periodId/reporting/stats` | connecté | 8 soldes | l.240 |
| Répartition du budget | `GET /periods/:periodId/reporting/budget-breakdown` | connecté | par catégorie | l.250 |
| Comparer deux périodes | `GET /periods/:periodId/reporting/comparison?compareWith=` | connecté | écarts | l.278 |
| Sankey | `GET /periods/:periodId/reporting/sankey` | connecté | nœuds + liens | l.292 |
| Analyse IA de période | `GET /periods/:periodId/reporting/ai-insights?locale=` | connecté | texte Markdown | l.301 |
| Évolution | `GET /reporting/evolution` | connecté | une ligne par période | l.262 |
| Analyse IA d'évolution | `GET /reporting/evolution/ai-insights?locale=` | connecté | texte Markdown | l.316 |
| Trésorerie prévue | `GET /reporting/cashflow?days=` | connecté ; `days` entier 1 à 365 facultatif (défaut 90), sinon 400 | solde + événements | l.369 |
| Scan de ticket | `POST /reporting/scan-receipt` (`base64Image`, `mimeType`) | connecté ; aucun contrôle du compte ; corps validé par `ScanReceiptDto` : `base64Image` non vide, `mimeType` parmi `image/jpeg`, `image/png`, `image/webp`, `image/heic`, sinon 400 sans appel à l'IA (le front envoie `image/jpeg`) | champs extraits | l.354 |
| Résumé des tags | `GET /reporting/tags-summary?periodId=` | connecté | liste | l.348 |
| Détail d'un tag | `GET /reporting/tags/:tagId?periodId=` | connecté | détail | l.358 |
| Calendrier | `GET /reporting/calendar?year=&month=` | connecté | événements du mois | l.369 |
| Anomalies | `GET /reporting/anomalies?periodId=` | connecté | liste | l.384 |
| Ignorer des anomalies | `POST /reporting/anomalies/ignore` (`transactionIds`, `type` ∈ duplicate/spike/outlier) | connecté | écrit les métadonnées | l.216 |
| Patrimoine net (tous comptes) | `GET /reporting/net-worth` | connecté ; l'`accountId` de l'URL est ignoré, résultat = tous les comptes accessibles via la RLS | total + 30 jours | l.231 |

Front : un hook par route dans `api/` (clés React Query dédiées) ; écrans `ui/` : cartes de stats (`dashboard-stats.tsx`), répartition (`budget-breakdown.tsx`), évolution (`evolution-chart.tsx`), comparaison, Sankey, calendrier (`financial-calendar.tsx` + `calendar/`), trésorerie (`cashflow-forecast.tsx`), anomalies, patrimoine net, pulse, top dépenses, échéances, cartes IA (`base-ai-insights-card.tsx`, rendu Markdown). Les widgets du tableau de bord sont déclarés dans `features/preferences/config/dashboard-widgets.tsx`. Types : `model/types.ts`.

## Statuts et transitions
Pas de cycle de vie. Une anomalie ignorée le reste (aucune route pour la rétablir).

## Zones d'ombre
- Trésorerie prévue : le front l'appelle en `GET` (`use-cashflow-forecast.ts:10`) et le back l'expose désormais en `GET` ; l'ancienne route `POST` n'existe plus (404). Le défaut de 90 jours et les bornes de `days` sont couverts par les tests e2e.
- Le scan et les analyses IA envoient des données financières / images à Google Gemini ; la clé est passée dans l'URL (`gemini.service.ts`). Aucune limite de taille d'image ni de fréquence dans le code.
- `forecastBalance` a deux définitions différentes (stats vs évolution) ; laquelle fait foi n'est pas dit.
- Le patrimoine net présente un historique plat : intention (prototype, commentaires du code) ou bug, non tranché.
- Revenus réels incluent les virements, dépenses réelles incluent l'épargne : choix métier non expliqué.
- Seuil de 5 € pour les doublons et facteur 3 pour les dépenses inhabituelles : valeurs non justifiées.
- La récurrence du jour 29-31 n'est pas gérée explicitement pour les mois courts (comparaison sur le jour du mois exact).
- Les fonctions SQL d'évolution (balance/evolution) existent en base, mais aucun appel depuis `reporting/` n'a été trouvé ; leur usage éventuel ailleurs n'a pas été vérifié.
