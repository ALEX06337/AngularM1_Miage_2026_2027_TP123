# Avancement TP2

Suivi global du TP2 (`SUJET_ETUDIANT_TP2.md`), sur la branche `tp2`. Même
principe que `tp1/avancement_tp1.md` : chaque étape est documentée au fur et
à mesure, cochée quand elle est vraiment vérifiée (pas juste codée).

## Prérequis (TP1 doit être fonctionnel) — à vérifier en début de séance

- [ ] Backend lancé (`cd backend && npm start`), `GET /api/health` OK
- [ ] Frontend lancé (`cd frontend-starter && npm start`), proxy `/api` → bon port
- [ ] Connexion avec le compte démo (`demo@example.com` / `Demo1234!`) OK
- [ ] Fichiers audio de test repérés dans `frontend-starter/fichiers-audio-de-test/`

Rappel port (voir `tp1/avancement_tp1.md`) : le backend de ce projet tourne
sur `PORT=3001` (`backend/.env`), pas 3000, et `proxy.conf.json` cible déjà
`http://localhost:3001` — pas de changement à faire ici a priori.

## Constat initial du code (avant modifications TP2)

État du `frontend-starter` relevé avant toute intervention TP2, pour savoir
précisément ce qui reste à faire par rapport à `SUJET_ETUDIANT_TP2.md` :

- `shared/services/track.service.ts` : `list(page, limit)` déjà présent et
  transmet bien `page`/`limit` en query params ; `upload(file, title)` et
  `audio(id)` (en `blob`) déjà présents ; une méthode `isAvailable()` en plus
  (HEAD sur `/api/tracks/:id/audio`, hors contrat de base, utilisée pour
  griser les pistes dont le fichier n'existe pas sur ce backend)
- `tracks-page.ts` : Signals `tracks`, `page`, `pages`, `loading`,
  `audioUrl`, `unavailable` déjà en place ; **pas de Signal d'erreur dédié à
  l'affichage** (erreurs seulement en `console.error`)
- `tracks-page.html` : `@for`/`@empty`/`@if` déjà utilisés, pagination
  Préc./Suiv. avec désactivation aux bornes déjà présente, chaque
  changement de page redéclenche bien une requête HTTP (`go()` → `load()`,
  pas de slicing local)
- Upload : pas d'état de chargement dédié pendant l'envoi, pas de
  désactivation anti double-soumission, **pas de validation fichier côté
  frontend** (taille/format), pas de message de succès, pas de message
  d'erreur affiché à l'utilisateur (uniquement en console)
- Lecture : l'`ObjectURL` précédente est bien révoquée à chaque nouvelle
  lecture (`play()`), mais **pas de révocation à la destruction du
  composant** (pas de `ngOnDestroy`)
- Présentation : cards très basiques (titre, nom original, taille), pas
  encore de format ni de date d'ajout affichés, pas de style "responsive"
  dédié

## Mission 2 — Bibliothèque paginée — en cours

- [ ] Vérifier en Network que `TrackService.list` transmet bien `page`/`limit`
- [ ] Ajouter le Signal d'erreur manquant (`error`) et l'afficher dans le template
- [ ] Confirmer qu'aucun slicing local n'est fait (déjà conforme a priori)
- [ ] Capture Network de la pagination (changement de page → nouvelle requête)
- [ ] (Avancé, optionnel) Paginator Angular Material
- [ ] (Avancé, optionnel) Pagination Mongoose via `aggregate-paginate-v2` + MAJ `API_CONTRACT.md`

## Mission 3 — Upload et lecture audio — à faire

- [ ] Documenter le flux composant → service → `HttpClient` → API (upload)
      et API → `Blob` → `ObjectURL` → `<audio>` (lecture)
- [ ] Repérer l'intercepteur JWT sur la requête audio (`auth.interceptor.ts`)
      et expliquer pourquoi un `src` direct ne reçoit pas le header
- [ ] Ajouter la validation frontend (taille ≤ 25 Mo, format audio) avant
      l'appel HTTP, avec message d'erreur clair
- [ ] État de chargement + désactivation du bouton pendant l'envoi
      (anti double-soumission)
- [ ] Afficher les erreurs serveur (400, etc.) dans l'UI, pas juste en console
- [ ] Message de succès après upload
- [ ] Vérifier que le formulaire est vidé et la page 1 rechargée après succès
      (partiellement fait : reset `title`/`file`/`page`, à confirmer)
- [ ] Cards responsives/accessibles (titre, nom original, format, taille,
      date d'ajout, action de lecture)
- [ ] Révocation de l'`ObjectURL` à la destruction du composant (`ngOnDestroy`)
- [ ] Répondre aux questions mémoire/buffering/streaming du sujet

## Checkpoint Network — à faire

- [ ] Chaque changement de page modifie bien le paramètre `page`
- [ ] L'upload est bien multipart et contient exactement `audio` et `title`
- [ ] La réponse de lecture est bien un flux audio
- [ ] Une erreur 400 est affichée pour un fichier invalide
- [ ] Une piste ne peut être lue que par son propriétaire (tester avec 2 comptes)

## Livrables TP2 — à faire

- [ ] Code frontend complété
- [ ] Cards de bibliothèque lisibles
- [ ] Capture Network pagination et/ou upload
- [ ] Capture/démo lecture audio authentifiée
- [ ] Explication écrite du choix `Blob`/`ObjectURL`
- [ ] Réponses aux questions mémoire/buffering/streaming
