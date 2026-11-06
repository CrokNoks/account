# Navigation — la coque de l'application : menu, barre du bas, titre, palette, thème (front uniquement)

Mise à jour : 2026-11-06 · Commit : voir historique git

Code : `frontend/src/shared/ui/layout/` (`sidebar.tsx`, `bottom-nav.tsx`, `header.tsx`, `header-title.ts`, `command-menu.tsx`, `theme-toggle.tsx`), assemblage dans `frontend/src/app/[locale]/(dashboard)/layout.tsx`, thème dans `frontend/src/app/[locale]/globals.css`, textes `frontend/messages/{fr,en}.json` (espace `Navigation`). Aucun code back ni base.

## Vocabulaire
| Mot | Ce que ça veut dire ici |
| --- | --- |
| Coque | Ce qui entoure toutes les pages connectées : menu à gauche, barre du haut, barre du bas sur mobile. |
| Sidebar | Le menu à gauche (grand écran). |
| Bottom-nav | La barre du bas (mobile). |
| Palette de commandes | Fenêtre de recherche ouverte par Ctrl/Cmd + K, pour aller à une page ou lancer une action. |
| Jeton visuel | Une variable de couleur ou de forme (ex. `--primary`, `--radius`) définie une fois dans `globals.css` et réutilisée partout. |
| oklch | Façon d'écrire une couleur (clarté, intensité, teinte) utilisée par tous les jetons. |

## Aujourd'hui : il n'y a PAS de coque à 5 entrées
Le code actuel ne contient ni « Aujourd'hui », ni « Opérations », ni « Analyses », ni « Échéances », ni « Réglages » (aucune clé dans `Navigation`, aucune route). Le menu a 13 entrées (voir ci-dessous).

## Règles métier
| Règle | Source | Testée |
| --- | --- | --- |
| Sidebar : 13 entrées dans cet ordre : Tableau de bord `/`, Calendrier `/calendar`, Évolution `/evolution`, Dépassements `/depassements`, Flux `/flux`, Prévisions `/cashflow`, (séparateur), Comptes `/accounts`, Catégories `/categories`, Tags `/tags`, Règles `/smart-rules`, Récurrences `/recurring`, Budgets `/budgets`, Transactions `/transactions`. Puis un bouton « Déconnexion » en bas (déconnecte, va sur `/login`). Largeur fixe 16 rem (`w-64`). | `sidebar.tsx:26-41,76-80,83,131-139` | ❌ |
| Visible seulement à partir du seuil `lg` : la sidebar est cachée en dessous (`hidden lg:flex`), la bottom-nav est cachée au-dessus (`lg:hidden`). Le seuil `lg` est abaissé à 60 rem (960 px) pour que le « site pour ordinateur » des navigateurs mobiles (~980 px) affiche le menu à gauche. | `(dashboard)/layout.tsx:19`, `bottom-nav.tsx:41`, `globals.css:9-10` | ✅ `bottom-nav.test.tsx` (seuil ≤ 980 px) |
| Raccourcis clavier F2 à F6 (écoutés sur la fenêtre, dans la sidebar) : F2 Tableau de bord, F3 Calendrier, F4 Évolution, F5 Flux, F6 Prévisions. Dépassements et toutes les entrées du second groupe n'ont pas de raccourci. Ignorés si le focus est dans un champ texte, une zone de texte ou un élément éditable. Le navigateur est empêché de réagir à F2-F6 (`preventDefault`). Le raccourci est affiché en pastille à droite de l'entrée. Comme les raccourcis vivent dans la sidebar, ils fonctionnent aussi en mobile (la sidebar est cachée mais montée ; à confirmer en réel). | `sidebar.tsx:27-32,49-74,114-123` | ❌ |
| Entrée active : le chemin se termine par la route de l'entrée ; pour `/`, par `/fr` ou `/en` (langues en dur). Une sous-page (ex. `/transactions/import`) n'active donc PAS « Transactions ». Même logique dans la bottom-nav. | `sidebar.tsx:96-97`, `bottom-nav.tsx:44-45` | ❌ |
| Cibles de la visite guidée posées sur la sidebar : `nav-categories` (Catégories), `nav-recurring` (Récurrences), `nav-budgets` (Budgets). Les renommer ou les retirer saute les étapes 4-6 de la visite « compte » (étape sautée si cible introuvable). | `sidebar.tsx:104`, `features/tour/config/account-tour.ts:23,28,33` | ✅ `tour-ui.test.ts` (la cible existe dans le code) |
| Bottom-nav (mobile) : 3 entrées (Tableau de bord, Transactions, Évolution) et un bouton rond « + » inséré au milieu (en 3e position sur 4 éléments) qui ouvre le tiroir de création de transaction. Hauteur mini 4 rem, marge de sécurité iPhone. Les autres pages ne sont donc pas accessibles par la barre du bas (seulement par l'adresse ou la palette Ctrl/Cmd + K, qui n'a pas de raccourci tactile). | `bottom-nav.tsx:16-20,29-38,41-49` | ✅ `bottom-nav.test.tsx` (4 éléments, « + » au milieu, ouvre le tiroir) |
| Le contenu laisse 5,5 rem + zone de sécurité en bas pour ne pas passer sous la barre ; plus de bouton flottant. | `(dashboard)/layout.tsx:23` | ✅ `bottom-nav.test.tsx` (pas de `fixed bottom-` dans le layout) |
| Header : titre de la page (clé `Navigation` trouvée par `headerTitleKey`), puis à droite : bascule de thème, sélecteur de langue (fr/en, `router.replace` avec la nouvelle langue), séparateur (grand écran), sélecteur de compte. Collant en haut (`sticky`). | `header.tsx:24-53` | ❌ (le titre : voir ligne suivante) |
| Titre de page : on retire le préfixe `/fr` ou `/en` et le `/` final, puis on prend la route connue la plus longue qui correspond (`/transactions/import` → « Import de transactions »). Route inconnue → « Tableau de bord ». 14 routes connues. Chaque page cache son propre `h2` sous `lg` car le titre est déjà dans le header. | `header-title.ts:2-30` | ✅ `header-title.test.ts`, `bottom-nav.test.tsx` (h2 cachés, 12 pages) |
| Palette de commandes : Ctrl/Cmd + K l'ouvre/ferme (même dans un champ). Groupe Navigation : Tableau de bord, Transactions, Budgets, Évolution, Dépassements, Calendrier, Catégories, Tags. Groupe Actions : Ajouter une transaction, Importer un CSV. Groupe Paramètres : Gérer les comptes. Absents de la palette : Flux, Prévisions, Récurrences, Règles. Elle n'utilise pas le `Link` de langue mais `useRouter` de `next/navigation`. | `command-menu.tsx:38-48,60-111` | ❌ |
| Thème clair/sombre : classe `.dark` sur la page, choix par défaut = celui du système, bascule par le bouton du header (clair ↔ sombre). | `app/[locale]/layout.tsx:45-48`, `theme-toggle.tsx`, `globals.css:6,88` | ❌ |
| Jetons visuels actuels : couleurs en oklch, toutes **sans teinte** (gris pur) sauf `--destructive` (rouge) et `--chart-1..5` (bleus). Clair : fond blanc, `--primary` gris très foncé. Sombre : `--primary` gris clair `oklch(0.87 0 0)`. `--radius` 0.625 rem, déclinés de `sm` à `4xl`. Jeux séparés `--sidebar-*` (fond, texte, accent, bordure, anneau). Police : `--font-sans` ; mono : Geist Mono. Aucun jeton pour succès/alerte, aucune couleur de « maquette » n'y figure. | `globals.css:8-51,53-86,88-120` | ❌ |
| Le texte d'interface n'est jamais en dur : tout vient de `Navigation.*` (fr et en). | `sidebar.tsx:113`, `header.tsx:24` | ❌ |

## Routes du dossier `(dashboard)` (toutes derrière la coque)
`/` (tableau de bord), `/calendar`, `/flux`, `/cashflow`, `/evolution`, `/depassements`, `/smart-rules`, `/tags`, `/transactions`, `/transactions/import`, `/accounts`, `/categories`, `/recurring`, `/budgets`, `/budgets/fixed`. Aucune redirection (`redirect(`) dans ce dossier. Pas de route « Réglages » ni « Échéances » ni « Analyses » ni « Opérations ». `/budgets/fixed` n'est pas dans le titre du header (retombe sur « Budgets » car préfixe `/budgets/`) ni dans la sidebar. Source : arborescence `app/[locale]/(dashboard)/**/page.tsx`.

## Qui est authentifié
Le middleware s'applique à toutes les routes sauf `api`, fichiers statiques et fichiers avec extension : il gère la langue (next-intl) puis la session Supabase ; sans utilisateur connecté il redirige vers `/login`, avec utilisateur connecté `/login` renvoie vers `/`. Donc toutes les routes de la coque exigent une connexion. Source : `src/middleware.ts:8-28`, `shared/lib/supabase/middleware.ts:41-62`. Le layout enveloppe tout dans `BackendHealthGuard` (garde de disponibilité du back, non détaillé ici). Pas testé.

## Ce qu'on stocke
Rien de propre à la coque. Le thème est gardé par `next-themes` dans le navigateur (clé par défaut ; non vérifiée dans le code). Les visites guidées : voir `docs/tour.md`.

## Tests (ce qui est garanti)
`bottom-nav.test.tsx` (« + » au milieu, pas de bouton flottant, h2 cachés en mobile, seuil `lg`), `header-title.test.ts` (titres, clés présentes en fr et en). Sidebar, raccourcis F2-F6, palette, thème et jetons : aucun test.

## Zones d'ombre
- Les 5 entrées cibles (Aujourd'hui, Opérations, Analyses, Budgets, Échéances) et « Réglages » : le code ne dit pas à quelles routes actuelles elles correspondent, ni ce que deviennent les pages sans entrée (Comptes, Catégories, Tags, Règles, Récurrences, Calendrier, Flux, Dépassements, Prévisions).
- Le code ne dit pas si F2-F6 doivent rester, ni sur quelles entrées.
- La maquette (jetons visuels cibles) se trouve dans `specs/refonte-interface/maquette/` (fichiers `.dc.html`) : non analysée ici, hors de l'existant ; ses valeurs sont à relever par le cadreur.
- Raccourcis F2-F6 actifs en mobile : déduit du code (sidebar montée, cachée en CSS), jamais vu en réel.
- Pourquoi la bottom-nav ne propose que 3 pages : le code ne le dit pas.
