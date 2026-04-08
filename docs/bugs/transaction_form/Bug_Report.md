# Bug Report — Formulaire de création de transaction : raccourcis clavier et réinitialisation

## Résumé
Le formulaire de création de transaction présente deux bugs : la touche `Enter` ferme le drawer au lieu de sauvegarder et rester ouvert, et le formulaire ne se réinitialise pas après une saisie enchaînée.

## Environnement
- Stack : TypeScript, Next.js 16, React 19, shadcn/ui
- Environnement : dev et production
- Date de détection : 2026-04-08

## Bug 1 — La touche `Enter` ferme le drawer au lieu de sauvegarder et continuer

### Étapes pour reproduire
1. Ouvrir le drawer de création de transaction
2. Remplir les champs requis (date, description, montant)
3. Appuyer sur `Enter`

### Comportement observé
Le drawer se ferme (comportement identique à `Shift+Enter` ou au bouton "Enregistrer").

### Comportement attendu
`Enter` devrait déclencher "Enregistrer et saisir une autre" (bouton `onAddAnother`) — le drawer reste ouvert et le formulaire se réinitialise.
`Shift+Enter` devrait déclencher "Enregistrer" et fermer le drawer.

### Cause technique identifiée
Dans `transaction-form.tsx`, le bouton "Enregistrer et saisir une autre" est de `type="button"` (donc non lié à la soumission du formulaire), tandis que le bouton "Enregistrer" est de `type="submit"`. Appuyer sur `Enter` dans un `<form>` déclenche nativement le premier bouton `type="submit"`, soit "Enregistrer et fermer". Le badge `Enter` affiché sur le bouton "Enregistrer et saisir une autre" est trompeur — aucun handler clavier n'intercepte réellement la touche `Enter` pour router vers `onAddAnother`.

---

## Bug 2 — Le formulaire ne se réinitialise pas après "Enregistrer et saisir une autre"

### Étapes pour reproduire
1. Ouvrir le drawer de création de transaction
2. Remplir et soumettre via le bouton "Enregistrer et saisir une autre"
3. Observer le formulaire après la soumission réussie

### Comportement observé
Les champs du formulaire conservent les valeurs de la saisie précédente (description, montant, catégorie, tags, etc.).

### Comportement attendu
Le formulaire doit être entièrement réinitialisé avec les valeurs par défaut après chaque saisie enchaînée.

### Cause technique identifiée
Dans `create-transaction-drawer.tsx`, lors du succès avec `addAnother = true`, le code fait `setInitialValues({})`. La `key` du `<TransactionForm>` est `${mode}-${JSON.stringify(initialValues)}`. Si `initialValues` était déjà `{}` avant la soumission, la key ne change pas → React ne re-monte pas le composant → les états internes du formulaire (`useState`) ne sont pas réinitialisés.

---

## Impact
- **Sévérité** : Majeur
- **Utilisateurs impactés** : Tous les utilisateurs utilisant les raccourcis clavier ou la saisie en série
- **Contournement disponible** : Oui — utiliser le bouton "Enregistrer et saisir une autre" à la souris, puis fermer/rouvrir le drawer manuellement pour réinitialiser

## Composant probable
- `frontend/src/features/transactions/ui/transaction-form.tsx` — gestion des événements clavier
- `frontend/src/features/transactions/ui/create-transaction-drawer.tsx` — logique de reset du formulaire après soumission

## Contexte additionnel
Le badge `Enter` et `⇧ Enter` sont affichés sur les boutons comme indicateurs visuels, mais ne correspondent pas à un handler `onKeyDown` réel dans le composant.
