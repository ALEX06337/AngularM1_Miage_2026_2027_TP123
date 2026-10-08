# Mission 7 — Tests automatisés

Résumé de la démarche (d'après `SUJET_ETUDIANT_TP3.md`). Lancer :
`cd frontend-starter && npm test` et `cd backend && npm test`.

## Ce qui était demandé

Au moins 3 tests frontend vérifiant URL, méthode, paramètres, headers,
résultats simulés, **sans backend ni MongoDB**. Extension backend facultative.

## État de départ

- Frontend : seul `auth.interceptor.spec.ts` existait (4 tests, conservés).
- Backend : 2 tests (santé, schémas).
- Outils déjà en place : Vitest via `ng test` (builder `unit-test`).

## Principe : pourquoi pas besoin de MongoDB

`provideHttpClientTesting()` remplace le vrai réseau par un
`HttpTestingController`. Le test : (1) déclenche l'appel, (2) récupère la
requête interceptée avec `expectOne`, (3) **vérifie** URL/méthode/params/
corps, (4) fournit la réponse avec `flush`. `httpMock.verify()` en
`afterEach` échoue si une requête inattendue est restée en attente.

## Tests frontend écrits (13 nouveaux)

| Fichier | Test | Résultat attendu |
|---|---|---|
| `track.service.spec.ts` | `list(2,10)` | GET `/api/tracks`, `page=2`, `limit=10` |
| | `delete('abc123')` | méthode `DELETE`, URL `/api/tracks/abc123` |
| | `upload(file,'Mon riff')` | POST multipart `audio`+`title`, `reportProgress`, événements `UploadProgress` puis `Response` |
| `auth.service.spec.ts` | login OK | POST `/api/auth/login` corps `{email,password}`, token + user stockés |
| | login 401 | token et user restent `null` |
| `auth.guard.spec.ts` | sans token | `UrlTree` vers `/login` |
| | avec token | `true` |
| `tracks-page.spec.ts` | suppression | DELETE puis nouveau GET de la liste, SnackBar de succès |
| | confirmation refusée | aucune requête DELETE |
| | double clic | une seule requête DELETE |
| | 404 | SnackBar « n'existe plus… » + rechargement |
| | upload | 25 % → statut `uploading`, 2ᵉ soumission ignorée, `Response` → `success`/100 % |
| | upload erreur 400 | statut `error`, message du backend |

Le SnackBar est remplacé par un **faux** (`{ open: vi.fn() }`) : on teste que
le composant l'appelle avec le bon message, pas l'animation Material.
`window.confirm` est simulé avec `vi.spyOn`.

## Tests backend ajoutés (4, `backend/test/api.test.js`)

401 sans JWT (GET/POST/DELETE), 401 avec JWT invalide ou mauvais secret,
400 upload sans fichier, 400 type MIME `text/plain`. Ils s'exécutent sans
Mongo car `auth` et Multer rejettent **avant** tout accès base.

**Non faits** : pagination et accès à la piste d'un autre utilisateur — ils
exigent une vraie base (utilisateurs/pistes à créer).

## Problème rencontré et solution

Premier lancement : 4 échecs `Cannot read properties of undefined (reading
'clear')`. Cause : pas de `localStorage` dans l'environnement de test, et
`AuthService` le lit à sa construction (c'est pourquoi le spec de
l'intercepteur avait déjà un stub). Solution : stub partagé
`shared/testing/local-storage-stub.ts` (en mémoire, avec vrai stockage pour
que les assertions sur le token restent utiles), importé par les specs.

## Preuve que les tests vérifient quelque chose

Test de mutation : URL du `DELETE` volontairement cassée
(`/api/track/:id`) → **8 tests échouent**. Code restauré ensuite.

## Résultats observés

| Suite | Résultat |
|---|---|
| Frontend `npm test` | 5 fichiers, **17/17** passés |
| Backend `npm test` | **6/6** passés |
| `npm run build` | OK |

## Unitaire vs intégration (question de l'oral)

- **Unitaire** : une brique isolée, dépendances simulées (ex. `TrackService`
  avec faux HTTP, composant avec faux SnackBar).
- **Intégration** : plusieurs briques réelles ensemble (ex. Express + vraie
  base, ou composant + vrai service + vrai intercepteur).
Nos tests de composant sont à la frontière : composant et service réels,
réseau et SnackBar simulés.

## Ce que vérifient intercepteur et guard (question de l'oral)

- Intercepteur : que `Authorization: Bearer <token>` est ajouté quand un token
  existe (et absent sinon), et qu'un 401 déconnecte.
- Guard : qu'on est redirigé vers `/login` sans token, et autorisé avec.
