# Flux détaillé — upload et lecture audio

Équivalent, pour la Mission 3, de `tp1/mission_0/flux-login.md` : ce
document répond au premier point du sujet (« identifiez dans quels
fichiers et quelles méthodes se trouvent... ») avec les noms exacts, et au
point sur l'intercepteur JWT.

## Flux 1 — Upload (`composant → service → HttpClient → API`)

| Étape | Où | Quoi |
|---|---|---|
| 1. Choix du fichier | `tracks-page.html` L12-20, `tracks-page.ts` `choose()` | `(change)` sur `<input type="file">` → `event.target.files[0]` |
| 2. Validation locale | `tracks-page.ts` `validate()` (privée) | Type MIME + taille, appelée depuis `choose()` avant d'accepter le fichier |
| 3. Construction du `FormData` | `track.service.ts` `upload(file, title)` | `body.append('audio', file); body.append('title', title)` |
| 4. Appel HTTP | `track.service.ts` `upload()` | `this.http.post<Track>('/api/tracks', body)` |
| 5. Passage par l'intercepteur | `auth.interceptor.ts` | Ajoute `Authorization: Bearer <token>` (voir section dédiée plus bas) |
| 6. Traitement backend | `backend/src/app.js`, route `POST /api/tracks` | Multer (`upload.single('audio')`) → validation type/taille → écriture disque → `Track.create(...)` |
| 7. Réponse | `tracks-page.ts` `upload()`, callback `next` | `201 Track` → message de succès, reset formulaire, `load()` |

**Détail du choix du fichier** (`choose()`, `tracks-page.ts`) :

```ts
choose(event: Event): void {
  const input = event.target as HTMLInputElement;
  this.fileInputEl = input;
  const selected = input.files?.[0];
  // ... validate(selected), puis this.file = selected si valide
}
```

**Détail de la construction du `FormData`** (`track.service.ts`) :

```ts
upload(file: File, title: string) {
  const body = new FormData();
  body.append('audio', file);   // exactement le nom de champ attendu par Multer
  body.append('title', title);
  return this.http.post<Track>('/api/tracks', body);
}
```

Le nom du champ (`'audio'`) doit être **identique** à celui attendu côté
backend par `upload.single("audio")` (`backend/src/app.js`) — sinon Multer
ne trouve pas le fichier dans la requête et le handler répond `400
Fichier audio requis`.

## Flux 2 — Lecture (`API → Blob → ObjectURL → lecteur audio`)

| Étape | Où | Quoi |
|---|---|---|
| 1. Clic sur lire | `tracks-page.html` bouton `▶`, `tracks-page.ts` `play(track)` | Vérifie d'abord `isAvailable(track)` |
| 2. Appel HTTP en blob | `track.service.ts` `audio(id)` | `this.http.get(..., { responseType: 'blob' })` |
| 3. Passage par l'intercepteur | `auth.interceptor.ts` | Ajoute le JWT — **indispensable ici**, voir section dédiée |
| 4. Traitement backend | `backend/src/app.js`, route `GET /api/tracks/:id/audio` | Vérifie `ownerId === req.auth.sub`, sinon `404` ; sinon `res.sendFile(...)` |
| 5. Réception du Blob | `tracks-page.ts` `play()`, callback `next(blob)` | Le composant reçoit un objet `Blob` typé selon `track.mimeType` |
| 6. Révocation de l'ancienne URL | `tracks-page.ts` `play()` | `if (previousUrl) URL.revokeObjectURL(previousUrl)` |
| 7. Création de l'ObjectURL | `tracks-page.ts` `play()` | `this.audioUrl.set(URL.createObjectURL(blob))` |
| 8. Affectation au lecteur | `tracks-page.html` | `<audio [src]="audioUrl()" controls autoplay>` |
| 9. Révocation finale | `tracks-page.ts` constructeur, `DestroyRef.onDestroy` | Révoque l'URL encore active quand le composant est détruit |

**Code complet de `play()`** (`tracks-page.ts`) :

```ts
play(track: Track): void {
  if (!this.isAvailable(track)) return;
  this.audioError.set('');
  this.service.audio(track.id).subscribe({
    next: (blob) => {
      const previousUrl = this.audioUrl();
      if (previousUrl) URL.revokeObjectURL(previousUrl);   // étape 6
      this.audioUrl.set(URL.createObjectURL(blob));         // étape 7
      this.playingTrack.set(track);
    },
    error: (error) => this.audioError.set('Lecture impossible...'),
  });
}
```

## L'intercepteur JWT et la requête audio

**Fichier** : `frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`.

```ts
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).token();
  return next(
    token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request,
  );
  // + gestion du 401 (voir tp1/mission_1/MISSION_1.md, étape 2)
};
```

Il est branché **une seule fois**, globalement, dans `main.ts` via
`provideHttpClient(withInterceptors([authInterceptor]))` — il s'applique
donc automatiquement à **tout** appel fait via `HttpClient`, y compris
`TrackService.audio(id)`, sans rien à écrire de plus dans `track.service.ts`.

### Pourquoi une URL directe en `src` ne recevrait pas ce header

L'intercepteur ne s'exécute que pour les requêtes qui passent par
`HttpClient` d'Angular. Si on écrivait dans le template :

```html
<!-- Ne fonctionnerait PAS -->
<audio [src]="'/api/tracks/' + track.id + '/audio'" controls></audio>
```

le navigateur, en interprétant la balise `<audio>`, déclenche **lui-même**
une requête HTTP native (comme il le ferait pour une `<img>`) — un
mécanisme complètement extérieur à Angular, qui ne passe jamais par
`HttpClient` et donc jamais par `authInterceptor`. Aucun en-tête
`Authorization` ne serait ajouté. Or la route `GET /api/tracks/:id/audio`
est protégée par le middleware `auth` côté backend
(`backend/src/app.js`, route déclarée avec `auth` en 2ᵉ argument) : sans
en-tête, elle répondrait `401 Authentification requise`, et le lecteur
audio n'afficherait rien de lisible (erreur réseau silencieuse pour
l'utilisateur).

**C'est exactement pour ça que le code passe par `Blob`** : en appelant
`TrackService.audio(id)` via `HttpClient`, la requête *est* interceptée, le
JWT *est* attaché, le backend répond `200` avec les octets audio, Angular
les reçoit sous forme de `Blob` — et c'est seulement à partir de ce Blob
(déjà téléchargé avec succès, authentification déjà validée) qu'on
fabrique une URL locale (`blob:...`) que le `<audio>` peut lire sans avoir
besoin d'aucun header, puisqu'elle ne déclenche plus aucune requête réseau
(voir `BLOB_OBJECTURL_STREAMING.md`).

## Vérification « propriétaire uniquement » (checkpoint Network)

Backend, route `GET /api/tracks/:id/audio` (`backend/src/app.js`) :

```js
const track = await Track.findOne({
  _id: req.params.id,
  ownerId: req.auth.sub,   // scope systématique à l'utilisateur du token
}).select("+storedName");

if (!track) {
  return res.status(404).json({ message: "Piste inconnue" });
}
```

La requête Mongo filtre **directement** sur `ownerId`. Si l'utilisateur A
essaie de lire une piste appartenant à l'utilisateur B (même en devinant
un id Mongo valide), `Track.findOne` ne trouve rien — pas parce que la
piste n'existe pas, mais parce qu'elle n'appartient pas au bon
utilisateur — et la réponse est `404 Piste inconnue`, jamais `403`
(volontairement, pour ne pas révéler qu'une piste avec cet id existe chez
quelqu'un d'autre).
