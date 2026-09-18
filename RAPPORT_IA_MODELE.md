# Rapport d'usage de l'IA - TP1

Pour chaque mission, détailler et fournir des explications concernant : objectif; prompt principal; plan proposé par l'agent; vérifications réalisées par le binôme; erreurs ou propositions rejetées; fichiers effectivement modifiés; preuve de fonctionnement; ce que chaque membre sait maintenant expliquer sans l'agent.

Assistant utilisé : Claude Code (modèles Claude Sonnet 5 / Haiku 4.5 selon les sessions).

---

## Préparation base de données (hors Atlas)

**Objectif** : faire fonctionner le backend avec une base MongoDB, en
remplaçant MongoDB Atlas par une instance MongoDB personnelle déjà en place
sur un NAS.

**Prompt principal** : demande de diagnostic ("pourquoi je ne peux pas me
connecter à mon Mongo"), puis "fait le reste à faire de atlas stp".

**Plan proposé par l'agent** : diagnostic réseau (port, SSH, identifiants),
configuration de `backend/.env` avec l'URI du NAS, résolution d'un conflit
de port local, lancement backend + frontend, vérification de bout en bout
(health check, login, upload, collections Mongo).

**Vérifications réalisées par le binôme** : relance manuelle de
`npm start` côté backend pour lire nous-mêmes les logs de connexion Mongo
au démarrage (succès/échec, sans jamais afficher l'URI complète, conforme à
la consigne de ne pas logger de secrets) ; test manuel du flux complet dans
le navigateur (login avec le compte démo, upload d'un fichier) en plus des
vérifications faites avec l'agent ; relecture de `backend/.env` pour
confirmer que seule la variable `MONGODB_URI` avait changé et qu'aucun
autre paramètre (`JWT_SECRET`, port) n'avait été touché par erreur.

**Erreurs ou propositions rejetées** : première tentative de connexion
Mongo sans authentification a échoué (le conteneur a `--auth` activé) ;
identifiants retrouvés et validés manuellement avec l'utilisateur.

**Fichiers effectivement modifiés** : `backend/.env` (non versionné),
`frontend-starter/proxy.conf.json` (port 3000 → 3001, conflit avec un autre
outil local).

**Preuve de fonctionnement** : `GET /api/health` → `200 {"status":"ok"}`,
login avec le compte démo → JWT reçu, collections `users`/`tracks`
confirmées dans Mongo via `mongosh`.

**Ce que chaque membre sait maintenant expliquer sans l'agent** : la
différence entre une variable d'environnement lue par `node --env-file=.env`
et une valeur codée en dur ; pourquoi `.env` est gitignoré alors que
`.env.example` est versionné ; comment lire un message d'erreur de
connexion Mongoose (`MongoServerError: Authentication failed`) pour
comprendre qu'il s'agit d'un problème d'identifiants et non de réseau.

---

## Mission 0 — Cartographie

**Objectif** : repérer les responsabilités de l'application Angular
(composant racine, routes, HttpClient, services/models/pages, mécanisme
JWT) et produire un schéma annoté du flux de connexion, sans modifier le
code.

**Prompt principal** : "on fait la mission 0 stp explique moi bien avec de
la doc dans un dossier maintenant stp", puis demandes d'explications
pédagogiques point par point (composant racine, séparation service/composant,
intercepteur vs guard).

**Plan proposé par l'agent** : lecture des fichiers sources réels
(`app.ts`, `routes.ts`, `main.ts`, `auth.service.ts`, `auth.interceptor.ts`,
`auth.guard.ts`, `app.js` backend), rédaction d'une documentation avec
extraits de code réels, vérification croisée avec `API_CONTRACT.md` pour
les routes publiques/protégées, puis production d'un diagramme Excalidraw
du flux de login.

**Vérifications réalisées par le binôme** : relecture de
`CARTOGRAPHIE.md` fichier par fichier en rouvrant chaque source cité
(`app.ts`, `routes.ts`, `auth.service.ts`, `auth.interceptor.ts`,
`auth.guard.ts`) dans l'éditeur pour confirmer que les extraits collés
dans la doc correspondaient exactement au code réel ; relecture du
diagramme `flux-login.png` étape par étape en le comparant au code pour
vérifier qu'aucune étape (ex : l'ajout du header `Authorization` par
l'intercepteur) n'avait été omise ou inventée.

**Erreurs ou propositions rejetées** : premier diagramme fait en Mermaid,
remplacé par un vrai fichier Excalidraw à la demande explicite (l'utilisateur
avait l'extension VS Code Excalidraw) ; le rendu de validation automatique
du diagramme a échoué une première fois à cause d'un bug du CDN `esm.sh`,
contourné avec `jsdelivr`.

**Fichiers effectivement modifiés** : création de `tp1/mission_0/CARTOGRAPHIE.md`,
`tp1/mission_0/flux-login.md`, `tp1/mission_0/flux-login.excalidraw`,
`tp1/mission_0/flux-login.png`. Aucun fichier de code touché (mission de
lecture uniquement, conforme à la consigne).

**Preuve de fonctionnement** : diagramme rendu et vérifié visuellement
(voir `tp1/mission_0/flux-login.png`) ; réponses aux questions du sujet
(routes utilisées, emplacement de la mise à jour du profil) vérifiées
contre le code source et `API_CONTRACT.md`.

**Ce que chaque membre sait maintenant expliquer sans l'agent** : le rôle
du `selector` dans `@Component` (l'ancrage HTML du composant, `app-root`
dans `index.html`) ; la différence entre `authInterceptor` (branché sur
*toutes* les requêtes HTTP sortantes, ajoute le header `Authorization` et
réagit aux erreurs 401) et `authGuard` (branché sur la navigation, bloque
l'accès à une route avant même qu'un appel HTTP soit fait) ; pourquoi le
token est stocké à la fois en Signal (`auth.token()`, réactif pour l'UI) et
en `localStorage` (seul moyen de survivre à un F5, puisqu'un Signal est
réinitialisé à chaque rechargement de page) ; le flux complet
composant → service (`AuthService`/`TrackService`) → `HttpClient` → route
Express → middleware `auth` → Mongoose, et pourquoi Angular ne doit jamais
appeler MongoDB directement.

---

## Mission 1 — Auth & Profil

**Objectif** : compléter la partie utilisateur du frontend (formulaires,
service, gestion de session), en particulier le bouton de déconnexion et la
gestion d'un token expiré/invalide (401).

**Constat de départ** : `frontend-starter` n'était pas un starter vide —
login, register, profil et upload étaient déjà largement implémentés. Deux
manques identifiés en Mission 0 restaient à combler : pas de bouton logout
dans le header, pas de redirection automatique vers `/login` en cas de 401.

**Prompt principal** : "Ok pour mission 0 c'est fini on peut passer a la
mission 1".

**Plan proposé par l'agent** : ajout d'un bouton de déconnexion dans
`app.html`/`app.ts` (affiché selon la présence du token, pas seulement du
profil chargé, pour rester correct après un F5) ; extension de
`auth.interceptor.ts` pour intercepter les réponses 401 **uniquement**
quand une requête portait déjà un token (pour ne pas interférer avec un
login qui échoue volontairement), déclenchant `logout()` + redirection.

**Vérifications réalisées par le binôme** : lecture ligne à ligne du diff
sur `app.html`/`app.ts` et `auth.interceptor.ts` avant acceptation ;
vérification dans le navigateur que le bouton "Déconnexion" est bien
conditionné à `auth.token()` (présent dès la connexion, encore présent
après un F5) et non à `auth.currentUser()` (qui se recharge de façon
asynchrone) ; test manuel de déconnexion volontaire (clic sur le bouton →
retour à `/login`, token supprimé de `localStorage`) ; test manuel du cas
401 en modifiant à la main la valeur du token dans `localStorage` via les
DevTools puis en rechargeant une page protégée (`/profile` ou `/tracks`) :
redirection automatique vers `/login` observée ; vérification qu'un
mauvais mot de passe sur l'écran de login (401 **sans** token envoyé)
n'entraîne pas cette redirection et affiche bien le message d'erreur du
formulaire ; relecture et exécution du fichier de tests ajouté
`auth.interceptor.spec.ts` (`npm test`, 4 tests, tous verts) pour
confirmer que ce comportement est aussi couvert automatiquement, pas
seulement observé une fois à la main.

**Erreurs ou propositions rejetées** : première version du header basée sur
`auth.currentUser()` seul — rejetée en interne par l'agent avant même de
la proposer au binôme, car `currentUser` n'est pas réhydraté après un
rechargement de page (seul `token` l'est depuis `localStorage`), ce qui
aurait fait disparaître le bouton logout après un F5 alors que
l'utilisateur reste connecté.

**Fichiers effectivement modifiés** : `frontend-starter/src/app/components/app/app.ts`,
`frontend-starter/src/app/components/app/app.html`,
`frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`.

**Preuve de fonctionnement** : `npm test` dans `frontend-starter` →
`Test Files 1 passed (1)`, `Tests 4 passed (4)` sur
`auth.interceptor.spec.ts` (en-tête `Authorization` ajouté quand un token
existe, absent sinon, déconnexion + redirection `/login` sur 401 avec
token, pas de redirection sur 401 sans token) ; observation manuelle dans
l'onglet Network des DevTools du header `Authorization: Bearer <token>`
sur les requêtes vers `/api/users/me` une fois connecté, puis de la requête
qui échoue en 401 et de la navigation vers `/login` juste après lorsqu'on
force un token invalide. Captures d'écran à déposer dans
`tp1/mission_1/` en complément (voir README de ce dossier).

**Ce que chaque membre sait maintenant expliquer sans l'agent** :
pourquoi conditionner l'affichage du bouton logout sur `auth.token()`
plutôt que sur `auth.currentUser()` (seul `token` est réhydraté depuis
`localStorage` au démarrage de l'app ; `currentUser` dépend d'un appel
HTTP à `/api/users/me` qui met un instant à répondre, donc s'y fier
ferait clignoter/disparaître le bouton après un F5) ; pourquoi
l'intercepteur ne déclenche la déconnexion que si **la requête sortante
portait déjà un token** (`if (token && error.status === 401)`) — un 401
sur `/api/auth/login` avec un mauvais mot de passe ne doit pas être traité
comme une session expirée, sinon on écraserait le message d'erreur du
formulaire de login par une redirection intempestive ; la différence entre
un test qui vérifie le comportement HTTP simulé (`HttpTestingController`,
`auth.interceptor.spec.ts`) et un test manuel dans le vrai navigateur — les
deux sont complémentaires, l'un est rejouable en CI, l'autre confirme le
rendu réel.

---

## Fonctionnalité additionnelle — disponibilité des fichiers audio

**Objectif** : éviter qu'un binôme utilisant chacun son propre backend
local (mais une base Mongo partagée) ne tombe sur des pistes dont le
fichier physique n'existe que sur la machine de l'autre.

**Prompt principal** : "il faut pouvoir faire un vérif si le fichier n'est
pas dispo il est grisé [...] si le fichier n'est pas dispo sur la machine
utilisateur on coupe".

**Plan proposé par l'agent** : ajout d'une méthode `isAvailable()` dans
`TrackService` (requête `HEAD` sur la route existante, sans toucher au
backend), vérification de chaque piste au chargement de la liste, grisage
visuel + désactivation du bouton de lecture.

**Vérifications réalisées par le binôme** : test en conditions réelles —
insertion directe d'un faux document dans Mongo (métadonnée présente,
fichier absent du disque), confirmation visuelle dans le navigateur que la
piste apparaît grisée avec le bouton désactivé.

**Fichiers effectivement modifiés** :
`frontend-starter/src/app/shared/services/track.service.ts`,
`frontend-starter/src/app/components/tracks-page/tracks-page.ts`,
`frontend-starter/src/app/components/tracks-page/tracks-page.html`,
`frontend-starter/src/app/components/tracks-page/tracks-page.css`.

**Preuve de fonctionnement** : testé et confirmé par le binôme ("ok top ça
marche c'est nikel").
