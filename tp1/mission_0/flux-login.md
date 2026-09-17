# Schéma annoté — flux "clic sur Se connecter"

**Diagramme Excalidraw** : `flux-login.excalidraw` (source éditable) et
`flux-login.png` (export, aperçu rapide) dans ce dossier.

Pour l'éditer dans VS Code : ouvre `flux-login.excalidraw`, l'extension
Excalidraw l'affiche directement dans l'éditeur.

Le diagramme montre, avec les vrais noms de fichiers/fonctions du projet :
- Le flux complet en 3 zones : **Frontend Angular** (LoginPageComponent →
  AuthService → authInterceptor) → **Backend Express** (`app.js:195` →
  `User.findOne` → `bcrypt.compare`) → **Database MongoDB**
- La décision "mot de passe correct ?" et ses deux issues : **succès (vert)**
  — `jwt.sign()`, réponse `200 {token, user}`, stockage et redirection — et
  **échec (rouge)** — réponse `401`, erreur affichée dans le composant
- Les vrais formats de données échangés (JSON de la requête, de la réponse
  succès, de la réponse d'erreur, forme du document Mongo)

## Points clés à expliquer à l'oral

1. **Le composant ne parle jamais à `HttpClient` directement.** `LoginPageComponent`
   appelle `AuthService.login()`, qui seul connaît l'URL `/api/auth/login`.
   Séparation des responsabilités : le composant gère l'UI et la navigation,
   le service gère l'accès réseau et l'état (Signals).

2. **L'intercepteur ne fait rien ici.** Au moment du login, il n'y a pas
   encore de token (`AuthService.token()` vaut `null`), donc la requête part
   sans en-tête `Authorization`. L'intercepteur ne devient actif qu'*après*,
   pour les appels suivants (`/api/users/me`, `/api/tracks`, ...).

3. **Où vit le JWT après le login ?** Dans deux endroits en parallèle :
   `localStorage` (persiste après fermeture du navigateur) et le Signal
   `AuthService.token` (état réactif consulté par l'intercepteur et le
   guard). Voir aussi la question du TP "différence Signal vs localStorage"
   dans les livrables.

4. **La redirection n'est pas automatique.** C'est `LoginPageComponent` qui
   décide, dans le callback `next` du `subscribe()`, d'appeler
   `router.navigateByUrl('/tracks')`. Si demain on retire cette ligne,
   l'utilisateur resterait sur `/login` même après un login réussi.

5. **Le guard revérifie tout à la navigation suivante.** `authGuard` ne
   "sait" pas qu'on vient de se connecter : il relit simplement
   `auth.token()` au moment où Angular tente d'activer la route `/tracks`.
   C'est pour ça que l'ordre — stocker le token *avant* de naviguer — est
   important dans `storeAuthentication()`.
