# Mission 1 — Auth & Profil

Résumé de ce qui a été fait, pourquoi, et ce qui était attendu au départ
(d'après `SUJET_ETUDIANT_TP1.md`). Le code lui-même vit dans
`frontend-starter/` — ce document explique la démarche, pas le code en
détail (voir directement les fichiers cités).

## Ce qui était demandé par le sujet

Compléter ou réécrire la partie utilisateur du frontend :

- formulaires réactifs pour l'inscription et la connexion, avec validations
  et messages d'erreur ;
- appels de `/api/auth/register` et `/api/auth/login` ;
- sauvegarde du JWT côté navigateur (sans jamais l'afficher dans les logs) ;
- mise à jour du Signal `currentUser` ;
- redirection après une connexion ou une inscription réussie ;
- **bouton de déconnexion avec nettoyage de l'état local** ;
- chargement de `/api/users/me` lorsque le profil est demandé ;
- modification du nom avec `PUT /api/users/me` ;
- **gestion d'un `401`, avec retour vers `/login` si le token est invalide
  ou expiré**.

Contrainte architecturale : le composant ne doit jamais appeler
`HttpClient` directement, il doit toujours passer par `AuthService`.

## État de départ (constaté en Mission 0)

Le `frontend-starter` fourni n'était pas un starter vide. En le
cartographiant (voir `../mission_0/CARTOGRAPHIE.md`), on avait déjà
constaté que la quasi-totalité de la liste ci-dessus existait :
formulaires, appels API, stockage du JWT, Signal `currentUser`,
redirection, chargement et modification du profil. Il ne manquait
précisément que **deux points**, les deux marqués en gras ci-dessus :

1. Pas de bouton de déconnexion (le header `app.html` n'affichait que des
   liens de navigation, aucune condition sur l'état connecté).
2. Pas de gestion du `401` : l'intercepteur (`auth.interceptor.ts`)
   ajoutait bien le token aux requêtes, mais ne faisait rien si le serveur
   répondait que ce token n'était plus valide. Le guard (`auth.guard.ts`)
   ne vérifiait que la présence locale du token, jamais sa validité côté
   serveur.

## Étape 1 — Bouton de déconnexion

**Fichiers modifiés** : `frontend-starter/src/app/components/app/app.ts`,
`frontend-starter/src/app/components/app/app.html`.

**Démarche** : injecter `AuthService` et `Router` dans `AppComponent`,
ajouter une méthode `logout()` qui appelle `auth.logout()` (nettoie
`localStorage` + les Signals `token`/`currentUser`) puis redirige vers
`/login`. Côté template, afficher le bouton uniquement quand l'utilisateur
est connecté.

**Décision technique importante** : la condition d'affichage est basée sur
`auth.token()`, **pas** sur `auth.currentUser()`. Pourquoi : `currentUser`
n'est mis à jour qu'après un appel explicite à `login()`, `register()` ou
`profile()` — mais il n'est jamais réhydraté automatiquement après un
rechargement de page (F5). `token`, lui, est initialisé directement depuis
`localStorage` au démarrage de l'application. Si on avait basé la
condition sur `currentUser`, un utilisateur connecté qui rafraîchit la
page aurait vu le bouton de déconnexion disparaître (et le lien
"Connexion" réapparaître) alors qu'il est toujours authentifié — un bug
silencieux qu'on a évité en le repérant avant de coder, pas après.

## Étape 2 — Gestion du 401

**Fichier modifié** : `frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`.

**Démarche** : l'intercepteur observe maintenant la réponse de chaque
requête (`catchError`). Si la réponse est un `401` **et** que la requête
avait été envoyée avec un token, on considère que le token est invalide ou
expiré : on appelle `auth.logout()` puis on redirige vers `/login`.

**Décision technique importante** : la redirection ne se déclenche que si
un token était présent au moment de la requête. Sans cette condition,
un `401` sur `/api/auth/login` lors d'un simple mauvais mot de passe
aurait aussi déclenché une redirection vers `/login` — inoffensif dans ce
cas précis puisqu'on y est déjà, mais ça aurait pu perturber l'affichage
du message d'erreur du formulaire (`LoginPageComponent` gère déjà ce cas
lui-même). La distinction "401 avec token" (session expirée) vs "401 sans
token" (mauvais identifiants au login) est ce qui rend le comportement
correct dans les deux situations.

## Étape 3 — Tests automatisés

**Fichier créé** : `frontend-starter/src/app/shared/interceptors/auth.interceptor.spec.ts`
(4 tests, tous verts) :

1. le header `Authorization` est ajouté quand un token existe ;
2. il n'est pas ajouté quand il n'y en a pas ;
3. un `401` avec token déclenche `logout()` + redirection vers `/login` ;
4. un `401` sans token ne déclenche ni l'un ni l'autre.

Lancer avec `npm test` dans `frontend-starter/`.

**Problème d'outillage rencontré (sans rapport avec le code de la
mission)** : `npm test` ne fonctionnait pas du tout au départ dans ce
projet — il manquait la dépendance `jsdom` et une configuration
`development` sur le target `build` dans `angular.json` (le nouveau
test-runner Angular en a besoin même sans écrire le moindre test). Une
fois ces deux points corrigés, un souci persistant est apparu : le service
`AuthService` lit `localStorage` dès sa construction, mais l'environnement
DOM (jsdom) n'était pas correctement chargé par l'outil de test dans ce
projet — on ne sait pas pourquoi. Solution retenue : fournir un stub
minimal de `localStorage` directement dans le fichier de test, ce qui a
aussi l'avantage de garder le test isolé (il ne dépend pas d'un vrai
navigateur simulé pour tester une pure logique d'intercepteur).

## Étape 4 — Validation manuelle dans le navigateur

Deux vérifications qu'un test unitaire ne peut pas remplacer (elles
touchent au vrai rendu et au vrai cycle de vie de l'application) :

1. **Bouton logout** : connexion avec le compte démo, bouton visible,
   clic → retour à `/login`, header revenu à l'état déconnecté. **Validé.**
2. **Session expirée** : connexion, modification manuelle de `gpc_token`
   dans `localStorage` (DevTools), puis rechargement complet de la page
   (F5 — un simple clic sur le bouton "Actualiser" de l'application ne
   suffit pas, car il ne recrée pas `AuthService` et donc ne relit pas
   `localStorage`), puis navigation vers une route protégée → redirection
   automatique vers `/login`. **Validé.**

## Ce qu'il faut savoir expliquer à l'oral

- Pourquoi le bouton logout est conditionné par `token()` et pas
  `currentUser()`.
- Pourquoi l'intercepteur ne redirige que sur un 401 *avec* token, pas sur
  n'importe quel 401.
- La différence entre ce que vérifie `authGuard` (présence locale du
  token, avant même de faire une requête) et ce que vérifie
  l'intercepteur (validité du token, après une requête réelle au
  serveur) — deux mécanismes complémentaires, pas redondants.
- Pourquoi un simple clic sur "Actualiser" dans l'appli ne suffisait pas
  pour tester un token expiré, mais un F5 si (durée de vie d'un service
  Angular singleton vs relecture de `localStorage`).
