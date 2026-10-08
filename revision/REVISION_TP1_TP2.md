# Fiche de révision — TP1 et TP2 (Guitar Practice Cloud)

Fiche personnelle pour préparer l'oral. Elle s'appuie sur le code réel du dépôt
(`backend/src/app.js`, `frontend-starter/src/app/...`) et sur les sujets
`SUJET_ETUDIANT_TP1.md` et `SUJET_ETUDIANT_TP2.md`.

## Sommaire

1. [Vue d'ensemble](#1-vue-densemble)
2. [TP1 — Authentification et profil](#2-tp1--authentification-et-profil)
3. [TP2 — Bibliothèque, upload et lecture audio](#3-tp2--bibliothèque-upload-et-lecture-audio)
4. [Notions clés : Blob, buffering, streaming](#4-notions-clés--blob-buffering-streaming)
5. [Questions du sujet et réponses](#5-questions-du-sujet-et-réponses)
6. [État d'avancement : ce qui est fait et ce qui ne l'est pas](#6-état-davancement)

---

## 1. Vue d'ensemble

Deux projets npm séparés :

- **Backend** `backend/` : Express, Mongoose, MongoDB Atlas.
- **Frontend** `frontend-starter/` : Angular standalone.

Chemin d'une requête :

```text
Composant → Service → HttpClient → [intercepteur : ajoute le JWT]
  → route Express → middleware auth → handler → Mongoose → MongoDB
```

Angular ne parle jamais directement à MongoDB. Le contrat entre les deux parties
est `API_CONTRACT.md`.

| Méthode | Route | Auth | Rôle |
|---|---|---|---|
| GET | `/api/health` | publique | vérifier que l'API répond |
| POST | `/api/auth/register` | publique | inscription, `201 {token,user}` |
| POST | `/api/auth/login` | publique | connexion, `200 {token,user}` |
| GET | `/api/users/me` | JWT | lire le profil |
| PUT | `/api/users/me` | JWT | modifier le nom |
| GET | `/api/tracks?page&limit` | JWT | liste paginée, `Page<Track>` |
| POST | `/api/tracks` | JWT | upload multipart (`audio`, `title`) |
| GET | `/api/tracks/:id/audio` | JWT | flux audio |
| DELETE | `/api/tracks/:id` | JWT | bonus (non utilisé par le front) |

Codes d'erreur : `400` validation, `401` authentification, `404` ressource,
`409` email déjà utilisé.

---

## 2. TP1 — Authentification et profil

**Objectif :** savoir expliquer le trajet d'une connexion et afficher un profil réactif.

### Mission 0 — Cartographie

- Composant racine : `components/app/app.ts` (`AppComponent`).
- Routes : `routes.ts`. `/profile` et `/tracks` sont protégées par `authGuard` ;
  `/login` et `/register` sont publiques.
- `HttpClient` est enregistré dans `main.ts` :
  `provideHttpClient(withInterceptors([authInterceptor]))`.
- Le JWT est ajouté par `shared/interceptors/auth.interceptor.ts`.
- Seuls `AuthService` et `TrackService` appellent `HttpClient`.

### Mission 1 — Inscription, connexion, profil

**Flux de connexion :**

1. `LoginPageComponent.submit()` appelle `auth.login(email, password)`.
2. `AuthService` fait `POST /api/auth/login`.
3. Le backend lit `req.body` (grâce à `express.json()`), puis
   `User.findOne({email}).select("+passwordHash")`. Le hash n'est pas sélectionné
   par défaut.
4. `verifyPassword` : si faux, `401`.
5. Sinon le backend signe un JWT `{sub: user.id, email}` avec `JWT_SECRET`
   (valable 2 h) et renvoie `{token, user}`.
6. Dans `AuthService`, `tap(storeAuthentication)` :
   - écrit le token dans `localStorage` (clé `gpc_token`) ;
   - met à jour le Signal `token` ;
   - met à jour le Signal `currentUser`.
7. Le composant redirige vers `/tracks`.

**Profil :** `GET /api/users/me` charge le profil, `PUT /api/users/me` modifie le nom.
Le middleware `auth` vérifie le JWT avec `jwt.verify` et place le payload dans
`req.auth`. `req.auth.sub` est l'identité de confiance.

**Déconnexion :** `logout()` supprime le token de `localStorage`, passe `token` et
`currentUser` à `null`, puis redirection vers `/login`.

**Gestion du 401 (intercepteur) :** si la requête portait un token et que le serveur
répond `401`, l'intercepteur appelle `logout()` et redirige vers `/login`. Un `401`
sans token (mauvais mot de passe au login) n'est pas traité par l'intercepteur :
le composant affiche le message d'erreur.

**Guard :** `authGuard` renvoie `true` si `auth.token()` existe, sinon un `UrlTree`
vers `/login`.

### Sécurité à savoir défendre

- Le mot de passe est haché par un hook `pre('validate')`. Il n'est jamais renvoyé.
- Le secret JWT reste côté serveur ; le token ne contient jamais le mot de passe.
- On ne logue jamais mot de passe, token ni URI Mongo.
- `backend/.env` est gitignoré.

### Checkpoint Network (3 requêtes à relever)

Pour chacune : méthode, URL, corps, statut, réponse, présence d'`Authorization`.

1. Connexion réussie : `200`.
2. Connexion refusée : `401`.
3. `GET` ou `PUT /users/me` : header `Authorization: Bearer …`.

---

## 3. TP2 — Bibliothèque, upload et lecture audio

### Mission 2 — Pagination serveur

**Backend** (`GET /api/tracks`) :

- `page` vaut au minimum 1 ; `limit` est borné entre 1 et 20 (5 par défaut).
- Filtre `ownerId: req.auth.sub` : chaque utilisateur ne voit que ses pistes.
- `find().sort({createdAt:-1}).skip((page-1)*limit).limit(limit)`.
- `Promise.all` lance en parallèle le `find` et le `countDocuments`.
- `.select("-storedName")` cache le nom de fichier interne.
- Réponse : `{items, page, limit, total, pages}`.

**Frontend :**

- `TrackService.list(page, limit)` envoie `params: {page, limit}`.
- Signals dans `tracks-page.ts` : `tracks`, `page`, `pages`, `loading`, `error`.
- Template : `@for`, `@empty`, `@if` ; boutons Précédent et Suivant désactivés aux bornes.
- `go(page)` fait `page.set(...)` puis `load()` : une nouvelle requête HTTP à chaque
  changement de page. Découper localement est interdit par le sujet.

### Mission 3 — Upload et lecture

**Upload :**

1. `choose()` valide le fichier (MIME et taille) avant tout appel HTTP.
2. `upload()` appelle `TrackService.upload(file, title)`.
3. Le service construit un `FormData` avec exactement `audio` et `title`, puis
   `POST /api/tracks`.
4. Backend : `auth` (JWT), puis Multer :
   - `diskStorage` : écriture directe sur disque, nom `UUID + extension` ;
   - `fileFilter` : liste de MIME autorisés (mp3, wav, ogg, m4a) ;
   - `limits.fileSize` : 25 Mo.
5. Le handler vérifie `req.file` (sinon `400`), puis `Track.create` : métadonnées
   seulement, pas les octets.
6. Si MongoDB échoue après l'écriture sur disque, le fichier orphelin est supprimé (`unlink`).
7. Le middleware d'erreurs central transforme `MulterError` et format refusé en `400`,
   `ValidationError` en `400`, `CastError` en `404`.

**Ajouts côté front :**

- Validation avant l'appel HTTP avec message clair (`uploadError`).
- Signal `uploading` : bouton désactivé et garde anti double-soumission
  (`if (!this.file || this.uploading()) return`).
- Signals `uploadError` et `uploadSuccess`.
- Après succès : formulaire vidé, retour à la page 1, `load()`.
- Cards : titre, nom d'origine, format, taille (`formatSize`), date (`formatDate`).
- Bug corrigé : `size` est en octets, le template affichait « Ko » sans conversion.

**Lecture audio authentifiée :**

```text
play(track) → TrackService.audio(id)
  → GET /api/tracks/:id/audio (responseType:'blob', + JWT via intercepteur)
  → Blob → URL.createObjectURL(blob) → Signal audioUrl → <audio [src]>
```

- Un `<audio src="/api/...">` direct ne peut pas envoyer `Authorization` : ce serait un `401`.
- Solution : télécharger via `HttpClient` (donc avec JWT), puis créer une URL locale
  `blob:` que `<audio>` lit sans requête réseau.
- Révocation de l'ObjectURL : dans `play()` (avant d'en créer une nouvelle) et dans
  `DestroyRef.onDestroy()`.
- Signals `playingTrack` (morceau en cours) et `audioError`.
- Côté serveur : `Track.findOne({_id, ownerId})`, sinon `404`.

### Checkpoint Network TP2

- Le paramètre `page` change à chaque page (captures `page=1` puis `page=2`).
- L'upload est en `multipart/form-data` avec `audio` et `title`.
- La réponse audio a `Content-Type: audio/mpeg`, `Content-Length`, `Accept-Ranges: bytes`.
- Le header `Authorization` est présent sur la requête audio.
- Propriétaire : un 2ᵉ compte (`test_profil`) voit une liste vide.
- Non testé : l'erreur `400` sur fichier invalide (`accept="audio/*"` filtre déjà la
  boîte de dialogue ; le code de validation est présent).

---

## 4. Notions clés : Blob, buffering, streaming

### Qu'est-ce qu'un Blob ?

**Blob** = *Binary Large OBject* : un objet JavaScript qui contient des octets bruts
avec un type MIME (par exemple `audio/mpeg`). C'est un « fichier en mémoire » : il vit
dans la RAM de l'onglet, pas sur le disque.

- `responseType: 'blob'` dit à Angular : « la réponse est du binaire, ne l'interprète
  pas comme du JSON ».
- `<audio>` ne sait pas lire un Blob directement : il lui faut une URL. D'où
  `URL.createObjectURL(blob)`, qui crée une URL locale `blob:http://localhost:4200/...`.

```text
Backend (fichier sur disque)
  → réseau (octets, avec JWT)
  → Angular reçoit un Blob (en RAM)
  → createObjectURL → URL "blob:..."
  → <audio [src]> lit
  → revokeObjectURL pour libérer la RAM
```

### Trois notions à distinguer

| Notion | Où | Ce qui se passe | Dans le code |
|---|---|---|---|
| **Streaming serveur** | Backend | Le fichier est lu depuis le disque et envoyé par morceaux, jamais entier en RAM. | `res.sendFile(audioPath)` |
| **Téléchargement complet du Blob** | Angular (`HttpClient`) | Le composant ne reçoit rien tant que tout n'est pas arrivé. | `responseType:'blob'` puis `next(blob)` |
| **Buffering navigateur** | Balise `<audio>` | Le navigateur précharge juste ce qu'il faut pour lire sans saccade. | `<audio [src]="audioUrl()">` |

Analogie : le streaming, c'est un ami qui te passe un film par petits morceaux ; le
buffering, c'est garder quelques secondes d'avance pour ne pas saccader ; le Blob
complet, c'est attendre que le film soit copié en entier avant d'appuyer sur play.

### Pourquoi streamer côté serveur si le client a tout en RAM ?

Ce sont deux machines avec des contraintes différentes.

| | Navigateur | Serveur |
|---|---|---|
| Nombre de fichiers | 1 à la fois | celui de tous les utilisateurs en même temps |
| Coût en RAM | 1 fichier (≤ 25 Mo) | N fichiers si on charge tout en mémoire |

- **Sans streaming :** chaque requête lirait jusqu'à 25 Mo en RAM avant d'envoyer.
  Avec 100 utilisateurs simultanés, cela ferait environ 2,5 Go.
- **Avec streaming :** le serveur lit un petit morceau, l'envoie, passe au suivant.
  La RAM par requête reste petite et constante, quelle que soit la taille du fichier.
- Autres avantages : les premiers octets partent immédiatement, le serveur s'adapte à la
  vitesse d'un client lent, et les requêtes `Range` sont supportées.

Le fichier est sur le **disque du serveur** (`backend/data/uploads/`), pas dans le
`localStorage`, qui ne contient que le token JWT.

Le code du TP ne profite pas du streaming côté client : `responseType:'blob'` attend la
fin du téléchargement. C'est un compromis assumé : on perd le démarrage progressif, on
garde l'authentification JWT.

### Signal vs `localStorage` (livrable TP1)

- **Signal :** variable réactive en mémoire. L'écran se met à jour tout seul, mais la
  valeur est perdue au F5.
- **`localStorage` :** mémoire persistante du navigateur. Elle survit au F5, mais ne
  déclenche aucune mise à jour d'écran.
- Le projet utilise les deux : `token = signal(localStorage.getItem('gpc_token'))`,
  et les deux sont toujours mis à jour ensemble.
- Le Signal gère le présent (la réactivité), `localStorage` gère la mémoire (le F5).
  L'intercepteur les resynchronise avec le serveur quand le token expire.
- Le bouton logout dépend de `auth.token()` et non de `currentUser()` : après un F5,
  `currentUser` est vide tant qu'aucun appel réseau ne l'a rempli.

---

## 5. Questions du sujet et réponses

### TP1

**Q1. « Où se trouvent les traces du backend et comment les voir ? »**

- Dans le terminal où tourne `npm start` du backend : `console.log`, `console.warn`,
  `console.error`, avec des préfixes `[auth]`, `[tracks]`, `[http]`.
- Un middleware logue chaque requête : `[http] POST /api/auth/login -> 200 (12 ms)`.
- Côté frontend : console des DevTools. Les échanges HTTP : onglet Network.
- Aucun mot de passe, token ni URI n'est logué.

**Q2. « Quel modèle utilisez-vous dans votre assistant IA ? Comment savoir combien vous avez consommé de tokens ? Qui peut vous conseiller quel est le meilleur modèle pour une tâche donnée ? »**

- Réponse personnelle : reprendre celle de `RAPPORT_IA_MODELE.md`.
- En général : le modèle s'affiche dans l'interface de l'outil ; les tokens se consultent
  dans l'outil (dans Claude Code : `/cost`, `/context`) ou sur le tableau de bord du
  fournisseur ; pour choisir un modèle, on se fie à la documentation et aux benchmarks
  du fournisseur, ou à l'enseignant. Un gros modèle est plus précis mais plus lent et
  plus cher ; pour une tâche simple, un petit modèle suffit.

**Q3. « Quelles sont les différentes routes du backend qui sont utilisées ? »**

- TP1 : `POST /auth/register`, `POST /auth/login`, `GET /users/me`, `PUT /users/me`.
- TP2 : `GET /tracks?page&limit`, `POST /tracks`, `GET /tracks/:id/audio`, et
  `HEAD /tracks/:id/audio` (`isAvailable`, ajout hors contrat).
- `GET /health` sert à vérifier l'API. `DELETE /tracks/:id` existe mais n'est pas utilisée par le front.

**Q4. « Où s'effectue la tâche "mise à jour du profil utilisateur", dans quels fichiers côté back et côté front ? »**

- **Front :** `profile-page.html` (formulaire), `profile-page.ts` (`save()`),
  `auth.service.ts` (`update(name)` : `PUT /api/users/me` puis `tap` qui met à jour
  `currentUser`), `auth.interceptor.ts` (ajoute le JWT).
- **Back :** `app.js`, route `PUT /api/users/me` : middleware `auth`, puis
  `User.findByIdAndUpdate(req.auth.sub, {$set:{name}}, {new:true, runValidators:true})` ;
  `models/User.js` pour le schéma et `toPublic()`.
- L'`id` utilisé vient du token (`req.auth.sub`), jamais du client.

**Q5 (livrable). « Courte explication de la différence entre Signal et `localStorage` »**

Voir la section 4.

### TP2

**Q6. « Expliquez le flux composant → service → HttpClient → API, puis API → Blob → ObjectURL → lecteur audio. »**

- **Upload :** `choose()` valide le fichier ; `upload()` appelle `TrackService.upload()` ;
  le service construit un `FormData` (`audio`, `title`) ; `HttpClient.post('/api/tracks')`
  avec JWT ajouté par l'intercepteur ; côté back `auth`, Multer, `Track.create`.
- **Lecture :** `play()` appelle `TrackService.audio(id)` (`GET`, `responseType:'blob'`,
  JWT) ; le back vérifie le propriétaire et fait `res.sendFile` ; le front reçoit un
  Blob ; `URL.createObjectURL(blob)` crée une URL `blob:...` ; le Signal `audioUrl`
  alimente `<audio [src]>` ; l'ancienne URL est révoquée.

**Q7. « Expliquez pourquoi une URL directement placée dans `src` ne reçoit pas automatiquement ce header. »**

- Le navigateur charge lui-même un `src` avec une requête simple, sans code JavaScript :
  il ne peut pas y ajouter `Authorization`.
- Les intercepteurs Angular ne voient que les requêtes passées par `HttpClient`.
- Une requête directe sur la route protégée donnerait `401`. D'où le contournement
  Blob et ObjectURL.

**Q8. « Expliquez pourquoi la validation frontend améliore l'expérience mais ne remplace jamais la validation backend. »**

- Le front donne un retour immédiat et évite un aller-retour réseau.
- Il ne protège rien : n'importe qui peut envoyer une requête avec `curl` ou Postman.
- Le back est la seule source de vérité : `fileFilter` (MIME), `limits.fileSize`
  (25 Mo), `if (!req.file)`, `ownerId`.

**Q9. « Distinguez le téléchargement complet d'un Blob, le buffering du navigateur et le streaming côté serveur. »**

Voir le tableau de la section 4. En une phrase : dans ce projet, le serveur fait du
streaming mais Angular le neutralise (Blob complet), c'est le prix de l'authentification JWT.

**Q10. « Le backend envoie-t-il le fichier entier en mémoire ou peut-il l'envoyer progressivement depuis le disque ? »**

Progressivement depuis le disque. `res.sendFile` lit en flux et supporte `Range`.
Multer en `diskStorage` écrit aussi directement sur disque.

**Q11. « Avec `HttpClient` et `responseType: "blob"`, à quel moment le composant reçoit-il généralement le fichier ? »**

Une fois le téléchargement entièrement terminé : `next(blob)` n'est appelé qu'à la fin.
Il faudrait `observe:'events'` et `reportProgress:true` pour suivre la progression.

**Q12. « Si la bibliothèque contient 100 morceaux, les 100 fichiers audio sont-ils chargés en mémoire dès l'affichage de la liste ? Justifier la réponse à partir du code. »**

Non. `load()` appelle seulement `TrackService.list()`, qui ne renvoie que des
métadonnées. `TrackService.audio()` n'est appelé que dans `play()`, au clic. Un seul
Blob est gardé à la fois, car l'ancien est révoqué avant le suivant.

**Q13. « Quelle différence y aurait-il avec 100 éléments `<audio>` utilisant directement une URL HTTP ? »**

- Ici, cela ne marcherait pas : `401`, faute de header.
- Si la route était publique : jusqu'à 100 requêtes pour lire les métadonnées (contre
  zéro avant le clic), mais le navigateur gérerait le buffering et le seek par `Range`
  sans Blob complet en mémoire JavaScript.

**Q14. « Pourquoi l'URL créée par `URL.createObjectURL` doit-elle être révoquée ? »**

Le navigateur garde une référence forte vers le Blob tant que l'URL n'est pas révoquée,
et le ramasse-miettes ne la libère pas. Sans `revokeObjectURL`, chaque piste écoutée
reste en mémoire : fuite mémoire. Le code révoque dans `play()` et dans
`DestroyRef.onDestroy()`.

**Q15 (avancé, facultatif). « Cherchez ce que proposent les tags ID3 et quels web services publics peuvent être utilisés pour effectuer cette tâche. »**

- **ID3 :** bloc de métadonnées dans un mp3 (titre, artiste, album, année, pochette
  intégrée). ID3v1 est à la fin du fichier, ID3v2 au début.
- **Lecture des tags :** `music-metadata` (Node), `jsmediatags` (navigateur).
- **Services publics :** MusicBrainz et Cover Art Archive, iTunes Search API, Deezer API.
- **À respecter :** sécurité (valider type et taille de l'image), accessibilité (`alt`),
  droits d'utilisation des images.
- Données à modifier pour l'implémenter : champs `coverUrl`, `artist`, `album` dans
  `Track.js`, upload multipart avec un champ image, mise à jour de `API_CONTRACT.md`.

---

## 6. État d'avancement

| Élément | État |
|---|---|
| TP1 — Missions 0 et 1 (auth, profil, logout, 401) | fait |
| TP2 — Mission 2 (pagination serveur, Signal `error`) | fait |
| TP2 — Mission 3 (validation, upload, cards, lecture, révocation) | fait |
| Réponses aux questions mémoire, buffering, streaming | fait (`tp2/mission_3/BLOB_OBJECTURL_STREAMING.md`) |
| Avancé : Paginator Angular Material | non fait (optionnel) |
| Avancé : pagination `aggregate-paginate-v2` | non fait (optionnel) |
| Avancé : image de couverture / tags ID3 | **non fait** (optionnel, aucune trace dans le code ni la doc) |
| Test du `400` sur fichier invalide | non testé en navigateur (`accept="audio/*"` filtre en amont) |

### Pièges à connaître

- Le `CLAUDE.md` signale un décalage de port possible (3000 / 3001). Dans ce projet, le
  backend tourne sur `PORT=3001` (`backend/.env`) et `proxy.conf.json` cible 3001 : c'est cohérent.
- `isAvailable()` (`HEAD`) est un ajout hors contrat : il grise les pistes dont le fichier
  n'existe pas sur le backend local quand la base Mongo est partagée.
- Pour l'ID3, dire honnêtement que ce n'est pas implémenté, mais expliquer le principe.
