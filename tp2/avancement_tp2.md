# Avancement TP2

Suivi global du TP2 (`SUJET_ETUDIANT_TP2.md`), sur la branche `tp2`. Même
principe que `tp1/avancement_tp1.md` : chaque étape est documentée au fur et
à mesure, cochée quand elle est vraiment vérifiée (pas juste codée).

**Documentation détaillée par mission** (même format que `tp1/mission_0/`
et `tp1/mission_1/`) :
- [`mission_2/README.md`](mission_2/README.md) et [`mission_2/MISSION_2.md`](mission_2/MISSION_2.md)
- [`mission_3/README.md`](mission_3/README.md), [`mission_3/MISSION_3.md`](mission_3/MISSION_3.md),
  [`mission_3/FLUX_UPLOAD_LECTURE.md`](mission_3/FLUX_UPLOAD_LECTURE.md) (flux détaillé + intercepteur JWT),
  [`mission_3/BLOB_OBJECTURL_STREAMING.md`](mission_3/BLOB_OBJECTURL_STREAMING.md) (Blob/ObjectURL + 5 questions du sujet)

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

## Mission 2 — Bibliothèque paginée — code fait, vérification Network à faire

- [x] `TrackService.list` transmet bien `page`/`limit` (déjà conforme au départ)
- [x] Signal `error` ajouté dans `tracks-page.ts` (mis à `''` au début de `load()`,
      rempli sur `error:` de la subscription) et affiché dans `tracks-page.html`
      (`@if (error()) { <p class="error" role="alert"> }`), style `.error` ajouté
      dans `tracks-page.css`
- [x] Aucun slicing local confirmé : chaque `go()` appelle `load()` qui refait
      un `GET /api/tracks?page=...` (pas de découpage côté Angular)
- [x] Build vérifié (`npx tsc --noEmit`), aucune erreur de compilation
- [ ] **À faire par toi** : lancer backend + frontend, se connecter, ouvrir
      l'onglet Network, changer de page et vérifier que le paramètre `page`
      change bien à chaque clic → capture d'écran pour les livrables
- [ ] (Avancé, optionnel) Paginator Angular Material
- [ ] (Avancé, optionnel) Pagination Mongoose via `aggregate-paginate-v2` + MAJ `API_CONTRACT.md`

## Mission 3 — Upload et lecture audio — code fait, vérif navigateur + questions à faire

- [x] Validation frontend ajoutée dans `choose()` (`validate()` privée) :
      types MIME alignés sur `backend/src/app.js` (mp3/wav/ogg/m4a) et
      taille max 25 Mo, message d'erreur clair affiché (`uploadError`),
      fichier rejeté remis à `undefined` et `<input type="file">` réinitialisé
- [x] État `uploading()` : bouton "Envoyer" → "Envoi en cours…", désactivé
      pendant l'envoi et anti double-soumission (`if (!this.file || this.uploading()) return`),
      champs titre/fichier désactivés pendant l'envoi
- [x] Erreurs serveur affichées (`uploadError`, lit `error?.error?.message`
      renvoyé par le backend) au lieu d'un simple `console.error`
- [x] Message de succès (`uploadSuccess`) affiché après un upload réussi
- [x] Formulaire vidé (titre, fichier, `<input>` natif remis à vide) et page 1
      rechargée après succès (déjà le cas, confirmé)
- [x] Cards enrichies : titre, nom original, format (déduit du `mimeType`),
      taille formatée (o/Ko/Mo via `formatSize`, corrige un bug d'affichage :
      `track.size` est en octets côté backend, le template affichait
      `{{ track.size }} Ko` sans conversion), date d'ajout formatée
      (`formatDate`, `toLocaleDateString('fr-FR', ...)`)
- [x] `DestroyRef.onDestroy()` révoque l'`ObjectURL` de lecture en cours à la
      destruction du composant (fuite mémoire potentielle sinon)
- [x] Signal `audioError` séparé pour les erreurs de lecture (affiché sous le lecteur)
- [x] `npx tsc --noEmit` et `npx ng build` passent sans erreur (le build
      vérifie aussi les templates, contrairement à `tsc` seul)
- [ ] **À faire par toi** : test en navigateur réel (upload valide, upload
      fichier trop gros/mauvais format, lecture, vérifier que l'erreur 400
      backend s'affiche bien, vérifier Network que le multipart contient
      bien `audio` + `title`) — je n'ai pas d'outil pour piloter un
      navigateur ici, donc ceci n'est pas vérifié de mon côté
- [x] Flux composant → service → `HttpClient` → API (upload) et
      API → `Blob` → `ObjectURL` → `<audio>` (lecture) documenté en détail
      dans [`mission_3/FLUX_UPLOAD_LECTURE.md`](mission_3/FLUX_UPLOAD_LECTURE.md)
- [x] Intercepteur JWT sur la requête audio et raison pour laquelle un `src`
      direct ne reçoit pas le header : expliqué dans le même document
- [x] Réponses aux questions mémoire/buffering/streaming rédigées dans
      [`mission_3/BLOB_OBJECTURL_STREAMING.md`](mission_3/BLOB_OBJECTURL_STREAMING.md)

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
