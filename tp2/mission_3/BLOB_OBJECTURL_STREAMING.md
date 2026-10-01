# Blob, ObjectURL et streaming — pourquoi ce choix, et les questions du sujet

Livrables demandés par `SUJET_ETUDIANT_TP2.md` : « explication écrite du
choix `Blob`/`ObjectURL` » et « réponses aux questions sur mémoire,
buffering et streaming ». Comme `tp1/mission_1/SIGNAL_VS_LOCALSTORAGE.md`
pour le TP1, cette explication s'appuie sur le code réel du projet, pas sur
une théorie générique.

## Pourquoi `Blob` + `ObjectURL`, et pas une URL directe

Deux contraintes du projet imposent ce choix, ensemble :

1. **La route audio est protégée par JWT**
   (`GET /api/tracks/:id/audio`, middleware `auth` dans
   `backend/src/app.js`). Un `<audio src="...">` classique ne peut pas
   porter d'en-tête `Authorization` — voir le détail dans
   `FLUX_UPLOAD_LECTURE.md`.
2. **Un `<audio>` a besoin d'une URL, pas d'un objet JavaScript brut.** Le
   navigateur ne sait interpréter que des URLs dans un attribut `src`, pas
   un `Blob` posé directement.

La solution retenue résout les deux à la fois : on télécharge d'abord
l'audio via `HttpClient` (donc *avec* le JWT, grâce à l'intercepteur), ce
qui donne un `Blob` en mémoire côté navigateur ; puis
`URL.createObjectURL(blob)` transforme ce `Blob` en une URL locale du type
`blob:http://localhost:4200/3f2a1e...`, valable uniquement dans cette page,
que le `<audio src="...">` peut lire *sans* requête réseau supplémentaire
(donc sans avoir besoin d'aucun header).

```ts
// track.service.ts
audio(id: string) {
  return this.http.get(`/api/tracks/${id}/audio`, { responseType: 'blob' });
}

// tracks-page.ts, play()
this.service.audio(track.id).subscribe({
  next: (blob) => {
    const previousUrl = this.audioUrl();
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    this.audioUrl.set(URL.createObjectURL(blob));
  },
});
```

## Les questions du sujet

### 1. Le backend envoie-t-il le fichier entier en mémoire ou peut-il l'envoyer progressivement depuis le disque ?

Il l'envoie **progressivement depuis le disque**, il ne le charge jamais
entièrement en mémoire côté serveur. La route utilise
`res.sendFile(audioPath, ...)` (`backend/src/app.js`, route
`GET /api/tracks/:id/audio`) — la méthode `sendFile` d'Express (via le
module `send`) ouvre un flux de lecture sur le fichier
(`fs.createReadStream` en interne) et le transmet morceau par morceau sur
la connexion HTTP, avec support des requêtes `Range` (utile pour le
seek dans un lecteur audio). Même chose côté upload, dans l'autre sens :
Multer est configuré en `diskStorage` (pas `memoryStorage`,
`backend/src/app.js`), donc pendant qu'un fichier arrive, il est écrit
directement sur le disque au fur et à mesure, sans jamais être entièrement
accumulé dans la mémoire du process Node. Les deux sens du transfert sont
donc conçus pour rester légers en mémoire serveur, quelle que soit la
taille du fichier (dans la limite des 25 Mo imposés de toute façon).

### 2. Avec `HttpClient` et `responseType: "blob"`, à quel moment le composant reçoit-il généralement le fichier ?

**Une fois le téléchargement entièrement terminé**, pas au fur et à
mesure. `HttpClient.get(..., { responseType: 'blob' })` (utilisé tel quel
dans `TrackService.audio()`, sans l'option `reportProgress`) attend que la
réponse HTTP soit intégralement reçue et assemblée par le navigateur avant
d'appeler le callback `next(blob)` de la `subscribe()`. Le transfert réseau
lui-même se fait bien en plusieurs paquets TCP/HTTP (comme tout transfert
réseau), mais Angular ne donne aucune visibilité sur cette progression au
composant par défaut — il faudrait explicitement passer
`observe: 'events', reportProgress: true` et écouter les événements
`HttpEventType.DownloadProgress` pour obtenir une progression, ce que ce
code ne fait pas. Le composant "voit" donc le fichier d'un seul coup, une
fois complet.

### 3. Si la bibliothèque contient 100 morceaux, les 100 fichiers audio sont-ils chargés en mémoire dès l'affichage de la liste ? Justifier à partir du code.

**Non.** `TracksPageComponent.load()` appelle uniquement
`TrackService.list(page)`, qui fait `GET /api/tracks?page=...&limit=...` —
cette route ne renvoie que des **métadonnées** (`id`, `title`,
`originalName`, `mimeType`, `size`, `createdAt`, cf. `track.model.ts` et
`Track.toPublic()` côté backend), jamais les octets audio eux-mêmes. La
seule méthode qui télécharge de l'audio est `TrackService.audio(id)`, et
elle n'est appelée que depuis `play(track)`, donc uniquement **à la
demande explicite** d'un clic sur le bouton ▶ d'une piste précise. Même en
affichant 100 pistes sur une page (ou en changeant `limit` à 100), zéro
octet audio n'est chargé tant qu'aucun clic n'a eu lieu, et un seul `Blob`
(le dernier joué) est gardé en mémoire à la fois — le précédent est
explicitement révoqué (`URL.revokeObjectURL`) avant chaque nouvelle
lecture.

### 4. Quelle différence y aurait-il avec 100 éléments `<audio>` utilisant directement une URL HTTP ?

Si chaque piste rendait directement `<audio src="/api/tracks/:id/audio">`
au lieu de passer par `Blob`/`ObjectURL` :

- **Ça ne fonctionnerait pas du tout ici**, l'authentification par JWT
  serait manquante (voir `FLUX_UPLOAD_LECTURE.md`) — chaque requête
  recevrait `401`.
- En supposant cette contrainte levée (route publique, par exemple) : le
  navigateur charge un `<audio>` avec `preload="metadata"` par défaut,
  donc il n'irait pas forcément télécharger les 100 fichiers en entier
  d'un coup — mais il déclencherait quand même une requête réseau par
  élément dès qu'il entre dans le DOM (pour en lire au moins les
  métadonnées), soit potentiellement 100 requêtes/connexions ouvertes
  simplement pour afficher la liste, contre **zéro** requête audio tant
  qu'on ne clique pas sur lire dans la version actuelle.
- Côté mémoire, un `<audio>` nourri par une URL réseau laisse le moteur
  media du navigateur gérer lui-même le buffering (il ne garde en mémoire
  que ce qui est nécessaire à la lecture en cours, et sait faire du
  seek via des requêtes `Range` sans tout retélécharger) — potentiellement
  plus économe par piste qu'un `Blob` complet en mémoire JS, mais au prix
  d'ouvrir un flux réseau par lecteur au lieu d'un seul à la fois.

### 5. Pourquoi l'URL créée par `URL.createObjectURL` doit-elle être révoquée ?

Parce que `URL.createObjectURL(blob)` crée une **référence forte** entre
l'URL générée et le `Blob` sous-jacent, maintenue par le navigateur en
mémoire tant que la page reste ouverte — cette référence n'est **pas**
nettoyée automatiquement par le ramasse-miettes JavaScript juste parce que
plus aucune variable ne pointe vers l'URL (le navigateur, pas le moteur
JS, est propriétaire de cette référence). Sans révocation explicite via
`URL.revokeObjectURL(url)`, chaque nouvelle piste écoutée dans une même
session laisserait le `Blob` de la piste précédente entièrement en
mémoire, indéfiniment — une vraie fuite mémoire si l'utilisateur écoute
plusieurs dizaines de morceaux dans la même session.

C'est pour ça que le code révoque à **deux** moments (`tracks-page.ts`) :

- dans `play()`, juste avant de créer la nouvelle URL, pour ne jamais
  garder plus d'un `Blob` de lecture en mémoire à la fois ;
- dans `DestroyRef.onDestroy()` (constructeur), pour libérer le dernier
  `Blob` encore actif si l'utilisateur quitte `/tracks` sans changer de
  piste — sinon ce dernier resterait en mémoire jusqu'à la fermeture
  complète de l'onglet, même après avoir quitté la page.

## En une phrase

Le `Blob` fait passer l'audio par le pipeline authentifié d'Angular
(`HttpClient` + intercepteur JWT) ; l'`ObjectURL` le rend ensuite lisible
par un `<audio>` HTML natif sans requête réseau ni header ; et comme cette
URL retient le `Blob` en mémoire tant qu'elle n'est pas révoquée, il faut
explicitement la libérer à chaque changement de piste et à la fermeture du
composant.
