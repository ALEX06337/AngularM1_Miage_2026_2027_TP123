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

**Vérifications réalisées par le binôme** :
_à compléter : qu'avez-vous vérifié vous-même, sans redemander à l'agent ?_

**Erreurs ou propositions rejetées** : première tentative de connexion
Mongo sans authentification a échoué (le conteneur a `--auth` activé) ;
identifiants retrouvés et validés manuellement avec l'utilisateur.

**Fichiers effectivement modifiés** : `backend/.env` (non versionné),
`frontend-starter/proxy.conf.json` (port 3000 → 3001, conflit avec un autre
outil local).

**Preuve de fonctionnement** : `GET /api/health` → `200 {"status":"ok"}`,
login avec le compte démo → JWT reçu, collections `users`/`tracks`
confirmées dans Mongo via `mongosh`.

**Ce que chaque membre sait maintenant expliquer sans l'agent** :
_à compléter par chaque membre du binôme._

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

**Vérifications réalisées par le binôme** :
_à compléter : avez-vous relu `CARTOGRAPHIE.md` et retrouvé les fichiers
cités par vous-mêmes dans le projet ?_

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

**Ce que chaque membre sait maintenant expliquer sans l'agent** :
_à compléter par chaque membre du binôme — par exemple : le rôle du
`selector` dans `@Component`, la différence entre `authInterceptor` et
`authGuard`, pourquoi le token est stocké à la fois en Signal et en
`localStorage`._

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

**Vérifications réalisées par le binôme** :
_à compléter une fois les tests manuels faits : bouton logout visible et
fonctionnel, redirection automatique testée en falsifiant le token dans
localStorage._

**Erreurs ou propositions rejetées** : première version du header basée sur
`auth.currentUser()` seul — rejetée en interne par l'agent avant même de
la proposer au binôme, car `currentUser` n'est pas réhydraté après un
rechargement de page (seul `token` l'est depuis `localStorage`), ce qui
aurait fait disparaître le bouton logout après un F5 alors que
l'utilisateur reste connecté.

**Fichiers effectivement modifiés** : `frontend-starter/src/app/components/app/app.ts`,
`frontend-starter/src/app/components/app/app.html`,
`frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`.

**Preuve de fonctionnement** :
_à compléter avec le résultat des tests manuels dans le navigateur (voir
`tp1/mission_1/`)._

**Ce que chaque membre sait maintenant expliquer sans l'agent** :
_à compléter par chaque membre du binôme._

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
