# Avancement TP1

Suivi global du TP1 (`SUJET_ETUDIANT_TP1.md`). La partie "base de données"
(anciennement suivie dans `avancement_atlas_setup.md`) est close, voir
ci-dessous ; ce fichier suit maintenant tout le TP1.

## Décision Atlas — clos

Choix assumé : au lieu de MongoDB Atlas (`ATLAS_SETUP.md`), utilisation d'une
instance MongoDB personnelle déjà en place sur le NAS (conteneur Docker
`mongo:latest`, accessible via Tailscale). Fonctionnellement équivalent pour
le backend : seule la variable `MONGODB_URI` change. Ce point est considéré
terminé, on ne revient pas dessus sauf si l'enseignant l'exige explicitement.

## Setup base de données, backend, frontend — terminé

- [x] Fork du repo créé sur GitHub (`ALEX06337/AngularM1_Miage_2026_2027_TP123`), cloné en local, remote `upstream` ajouté vers le repo du prof
- [x] Accès SSH au NAS (`100.109.106.128`) vérifié, fonctionnel
- [x] Conteneur `mongodb` (mongo:latest) confirmé up sur le NAS, port `27017` publié (`0.0.0.0:27017->27017/tcp`)
- [x] Connectivité réseau testée depuis le Mac vers le NAS sur le port 27017 (OK, via Tailscale)
- [x] Identifiants Mongo retrouvés et validés : user `alex`, mot de passe testé avec succès via `mongosh` dans le conteneur (auth sur la base `admin`)
- [x] `backend/.env` créé avec `MONGODB_URI` (NAS, `?authSource=admin`), `JWT_SECRET` généré aléatoirement, `PORT=3001`
- [x] `.env` bien listé dans `backend/.gitignore` (pas de risque de commit du secret)
- [x] `npm install` (backend et frontend-starter) fait
- [x] Backend lancé, connexion Mongo confirmée, aucune erreur au démarrage
- [x] `GET /api/health` → `{"status":"ok"}` confirmé
- [x] Compte démo (`demo@example.com` / `Demo1234!`) confirmé présent, login testé (JWT reçu)
- [x] `frontend-starter/proxy.conf.json` mis à jour et testé (proxy `/api` → backend OK)
- [x] Frontend Angular lancé sur `http://localhost:4200`
- [x] Collections `users` et `tracks` vérifiées dans `guitar-practice-cloud` (via `mongosh`)
- [x] Login réussi + login refusé (401) + upload `.mp3` + lecture, tous testés et capturés depuis le vrai navigateur

⚠️ **Note port** : le port `3000` était déjà occupé par un autre outil local (une UI Dagster
lancée par VS Code sur cette machine), donc le backend tourne sur le port `3001` et
`proxy.conf.json` a été adapté en conséquence.

## Mission 0 — Cartographie — terminé

- [x] Composant racine repéré (`app.ts` / `app.html`)
- [x] Configuration des routes repérée (`routes.ts`, guards `authGuard` sur `/profile` et `/tracks`)
- [x] Enregistrement de `HttpClient` repéré (`main.ts`, `provideHttpClient(withInterceptors(...))`)
- [x] Models / services / pages liés à l'utilisateur repérés (`shared/models`, `shared/services/auth.service.ts`, `components/*-page`)
- [x] Mécanisme JWT repéré (`auth.interceptor.ts` + `auth.guard.ts`)
- [x] Schéma annoté du flux de connexion produit

Documentation complète : voir `mission_0/CARTOGRAPHIE.md` et
`mission_0/flux-login.md` (+ `mission_0/flux-login.excalidraw` / `.png`).

**Constat important** : `frontend-starter` n'est pas un starter vide — login,
register, profil et upload sont déjà largement implémentés. Ce qui reste
manquant a été identifié précisément dans Mission 1 ci-dessous.

## Mission 1 — Auth & Profil — à faire

- [x] Formulaires réactifs inscription / connexion + validations et messages d'erreur (déjà présents dans le starter)
- [x] Appels `/api/auth/register` et `/api/auth/login` via `AuthService` (déjà en place)
- [x] Stockage du JWT côté navigateur, jamais loggé (déjà en place, `localStorage` + Signal `token`)
- [x] Signal `currentUser` mis à jour après login/register (déjà en place)
- [x] Redirection après connexion/inscription réussie (déjà en place, `router.navigateByUrl('/tracks')`)
- [x] **Bouton de déconnexion + nettoyage de l'état local** — ajouté dans `app.html`/`app.ts` : affiché selon `auth.token()` (pas `currentUser()` seul, pour rester correct après un F5 où `currentUser` n'est pas réhydraté), appelle `auth.logout()` puis redirige vers `/login`
- [x] Chargement de `/api/users/me` sur la page profil (déjà en place)
- [x] Modification du nom via `PUT /api/users/me` (déjà en place)
- [x] **Gestion du `401` → redirection vers `/login`** — `auth.interceptor.ts` intercepte maintenant les erreurs de la requête : si un token avait été envoyé et que la réponse est `401` (token invalide/expiré), on appelle `auth.logout()` + `router.navigateByUrl('/login')`. Un `401` **sans** token (ex : mauvais mot de passe sur `/auth/login`) n'est pas concerné, il reste géré par le composant (message d'erreur du formulaire)

**Tests automatisés** : `auth.interceptor.spec.ts` créé (4 tests, tous verts) :
header ajouté si token présent / absent, redirection + logout sur 401 avec
token, pas de redirection sur 401 sans token. Lancer avec `npm test` dans
`frontend-starter/`.

⚠️ Pour faire tourner `npm test`, il a fallu : ajouter `jsdom` en devDependency,
et ajouter une configuration `development` (vide) au target `build` dans
`angular.json` — absente à l'origine, ce qui faisait échouer le nouveau
test-runner Angular (`@angular/build:unit-test`) même sans aucun test écrit.

**Validé manuellement dans le navigateur** :
- [x] Bouton logout visible + fonctionnel après login (confirmé)
- [x] Redirection automatique vers `/login` en falsifiant `gpc_token` dans
  localStorage puis F5 (confirmé — attention : un simple clic sur le bouton
  "Actualiser" de l'appli ne suffit pas, il faut un vrai rechargement complet
  de la page pour que le Signal `token` relise localStorage)

**Mission 1 : terminée.** puis en rechargeant/naviguant

## Fonctionnalité ajoutée — hors périmètre TP1 (fait)

Problème identifié : en binôme, chaque membre a son propre backend local
(donc son propre dossier `backend/data/uploads/`) mais partage la même base
Mongo (NAS). Résultat : la métadonnée d'une piste uploadée par l'un apparaît
chez l'autre, mais le fichier audio physique n'existe que sur la machine de
celui qui l'a uploadée → erreur si l'autre clique dessus.

- [x] `TrackService.isAvailable(id)` — requête `HEAD /api/tracks/:id/audio`,
  retourne `true`/`false` (aucune modification du backend, la route existante
  renvoie déjà 404 si le fichier est absent du disque)
- [x] `TracksPageComponent` vérifie chaque piste au chargement de la liste
  (`forkJoin` sur tous les checks de la page) et stocke les IDs indisponibles
- [x] UI : piste grisée (`opacity: 0.45`), bouton lecture désactivé, message
  "Fichier indisponible sur ce backend" affiché
- [x] Testé en conditions réelles : faux document inséré directement dans
  Mongo (métadonnée présente, fichier absent du disque) → confirmé grisé
  dans le navigateur

⚠️ Donnée de test conservée volontairement dans la base (`title: "Test fichier
manquant"`, `_id: 6aabe49817de645caf9dc29d`) pour garder une démonstration
visuelle du grisage. À supprimer avant le rendu final si ce n'est pas voulu
dans la démo.

## Checkpoint Network — terminé

- [x] Capture d'une connexion réussie (`login` → 200)
- [x] Capture d'une connexion refusée (`login` → 401)
- [x] Capture d'un GET `/api/users/me` (→ 200)
- [ ] PUT `/api/users/me` (modification du nom) pas encore capturé séparément — à faire si besoin pour les livrables
- [ ] Vérifier pour chaque requête retenue comme livrable : méthode, URL, body JSON, statut, réponse, présence de `Authorization` — jamais de mot de passe ou JWT en clair (à faire au moment de préparer le rendu)

## Livrables TP1 — à faire

- [ ] Code frontend complété (logout + gestion 401, voir Mission 1)
- [x] Schéma annoté du flux de connexion (`mission_0/flux-login.excalidraw` / `mission_0/flux-login.png`)
- [x] Capture Network d'une requête d'authentification (login 200 + 401 obtenus)
- [ ] Explication écrite Signal vs `localStorage`
- [ ] Mise à jour de `RAPPORT_IA_MODELE.md` avec preuves d'usage de l'IA (captures d'écran à ajouter au projet)
