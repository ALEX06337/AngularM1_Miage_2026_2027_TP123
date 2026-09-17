# Avancement setup MongoDB (TP1)

## Décision

Au lieu de MongoDB Atlas (`ATLAS_SETUP.md`), utilisation d'une instance MongoDB
personnelle déjà en place sur le NAS (conteneur Docker `mongo:latest`,
accessible via Tailscale). Fonctionnellement équivalent pour le backend :
seule la variable `MONGODB_URI` change.

⚠️ À vérifier avec l'enseignant si le TP exige explicitement Atlas (le sujet
et `ATLAS_SETUP.md` le demandent "une fois par binôme").

## Fait

- [x] Fork du repo créé sur GitHub (`ALEX06337/AngularM1_Miage_2026_2027_TP123`), cloné en local, remote `upstream` ajouté vers le repo du prof
- [x] Accès SSH au NAS (`100.109.106.128`) vérifié, fonctionnel
- [x] Conteneur `mongodb` (mongo:latest) confirmé up sur le NAS, port `27017` publié (`0.0.0.0:27017->27017/tcp`)
- [x] Connectivité réseau testée depuis le Mac vers le NAS sur le port 27017 (OK, via Tailscale)
- [x] Identifiants Mongo retrouvés et validés : user `alex`, mot de passe testé avec succès via `mongosh` dans le conteneur (auth sur la base `admin`)
- [x] `backend/.env` créé avec :
  - `MONGODB_URI` pointant vers le Mongo du NAS (mot de passe encodé, `?authSource=admin`)
  - `JWT_SECRET` généré aléatoirement
  - `PORT=3001` (voir note port ci-dessous)
- [x] `.env` bien listé dans `backend/.gitignore` (pas de risque de commit du secret)
- [x] `npm install` (backend et frontend-starter) fait
- [x] Backend lancé (`npm start`), connexion Mongo confirmée, aucune erreur au démarrage
- [x] `GET /api/health` → `{"status":"ok"}` confirmé
- [x] Compte démo (`demo@example.com` / `Demo1234!`) confirmé présent, login testé (JWT reçu)
- [x] `frontend-starter/proxy.conf.json` mis à jour et testé (proxy `/api` → backend OK)
- [x] Frontend Angular lancé sur `http://localhost:4200`

⚠️ **Note port** : le port `3000` était déjà occupé par un autre outil local (une UI Dagster
lancée par VS Code sur cette machine), donc le backend a été basculé sur le port `3001`.
`proxy.conf.json` a été adapté en conséquence. Si tu relances sur une autre machine et que
le port 3000 est libre, tu peux repasser `PORT=3000` dans `backend/.env` et `target` dans
`proxy.conf.json`.

## Reste à faire

- [ ] Vérifier la présence des collections `users` et `tracks` dans la base `guitar-practice-cloud` (via `mongosh` ou Compass, pas testé)
- [ ] Se connecter avec le compte démo **depuis le navigateur** (test fait en ligne de commande via curl, pas encore depuis l'UI Angular)
- [ ] Uploader un `.mp3` de test (`frontend-starter/fichiers-audio-de-test`) depuis l'UI
- [ ] Observer les requêtes dans DevTools > Network (filtre XHR/fetch)

## Mission 0 — Cartographie (pas commencé)

- [ ] Repérer le composant racine
- [ ] Repérer la configuration des routes
- [ ] Repérer où `HttpClient` est enregistré (`provideHttpClient`)
- [ ] Repérer models / services / pages liés à l'utilisateur
- [ ] Repérer le mécanisme qui ajoute le JWT aux requêtes protégées (intercepteur)
- [ ] Produire le schéma annoté du flux de connexion

## Mission 1 — Auth & Profil (pas commencé)

- [ ] Formulaires réactifs inscription / connexion + validations et messages d'erreur
- [ ] Appels `/api/auth/register` et `/api/auth/login` via `AuthService` (jamais `HttpClient` direct dans un composant)
- [ ] Stockage du JWT côté navigateur (jamais loggé)
- [ ] Signal `currentUser` mis à jour après login/register
- [ ] Redirection après connexion/inscription réussie
- [ ] Bouton de déconnexion + nettoyage de l'état local
- [ ] Chargement de `/api/users/me` sur la page profil
- [ ] Modification du nom via `PUT /api/users/me`
- [ ] Gestion du `401` → redirection vers `/login`

## Checkpoint Network (pas commencé)

- [ ] Capture d'une connexion réussie
- [ ] Capture d'une connexion refusée
- [ ] Capture d'un GET/PUT `/api/users/me`
- [ ] Pour chaque requête : méthode, URL, body JSON, statut, réponse, présence de `Authorization` — jamais de mot de passe ou JWT en clair dans les captures

## Livrables TP1 (pas commencé)

- [ ] Code frontend complété
- [ ] Schéma annoté du flux de connexion
- [ ] Capture Network d'une requête d'authentification
- [ ] Explication Signal vs `localStorage`
- [ ] Mise à jour de `RAPPORT_IA_MODELE.md` avec preuves d'usage de l'IA
