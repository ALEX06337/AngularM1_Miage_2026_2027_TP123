# Mission 3 — Upload et lecture audio

Résumé de ce qui a été fait, pourquoi, et ce qui était attendu au départ
(d'après `SUJET_ETUDIANT_TP2.md`). Le code vit dans `frontend-starter/` —
ce document explique la démarche. Pour le détail « Blob / ObjectURL /
streaming » et les 5 questions du sujet, voir
`BLOB_OBJECTURL_STREAMING.md`. Pour le détail du flux complet avec les
noms de fichiers/méthodes exacts, voir `FLUX_UPLOAD_LECTURE.md`.

## Ce qui était demandé par le sujet

Le backend et le starter fournissent déjà le mécanisme principal — **ne
pas réimplémenter ce qui existe, ne pas modifier le contrat HTTP** :

1. Identifier dans le code : choix du fichier, construction du `FormData`,
   appel HTTP d'upload, récupération du `Blob`, création de l'`ObjectURL`,
   affectation au lecteur `<audio>`, révocation de l'ancienne URL.
2. Repérer l'intercepteur JWT sur la requête audio, expliquer pourquoi une
   URL mise directement dans `src` ne reçoit pas ce header.
3. Vérifier que le frontend construit bien le `FormData` avec exactement
   les champs `audio` et `title` (le backend vérifie déjà le reste :
   présence du fichier, formats acceptés, taille max 25 Mo).
4. Ajouter uniquement ce qui manque côté frontend : validation fichier
   avant l'appel HTTP + message d'erreur clair, état de chargement,
   anti double-soumission, erreurs serveur affichées, message de succès,
   formulaire vidé + retour page 1 après succès.
5. Cards responsives et accessibles (titre, nom original, format, taille,
   date d'ajout, action de lecture).
6. Compléter la lecture : morceau en cours affiché, erreur audio
   compréhensible, révocation de l'`ObjectURL` à la destruction du
   composant.
7. Répondre aux questions mémoire/buffering/streaming (voir
   `BLOB_OBJECTURL_STREAMING.md`).

## État de départ (constaté avant d'y toucher)

Comme pour la Mission 2, la mécanique de base existait déjà dans
`track.service.ts` et `tracks-page.ts` — cf. `FLUX_UPLOAD_LECTURE.md` pour
le détail ligne par ligne. Ce qui existait déjà et n'a **pas** été
retouché :

- `TrackService.upload(file, title)` construisait déjà le `FormData` avec
  exactement les champs `audio` et `title` (conforme au contrat) ;
- `TrackService.audio(id)` faisait déjà un `GET .../audio` en
  `responseType: 'blob'` ;
- `play()` créait déjà l'`ObjectURL` et révoquait la précédente **à chaque
  nouvelle lecture** (mais pas à la fermeture du composant, voir Étape 5).

Ce qui manquait précisément (les points listés en gras ci-dessus) :

- aucune validation fichier côté client (taille/format) ;
- aucun état de chargement dédié à l'upload, aucun anti double-soumission ;
- aucune erreur serveur affichée à l'écran (juste `console.error`) ;
- aucun message de succès ;
- cards minimalistes (titre, nom original, taille **mal affichée**, voir
  Étape 6) ;
- pas de révocation de l'`ObjectURL` à la destruction du composant.

## Étape 1 — Repérage du flux existant (lecture de code, sans modification)

Voir `FLUX_UPLOAD_LECTURE.md` pour le détail complet avec les noms de
fichiers et de méthodes exacts, y compris le point sur l'intercepteur JWT.

## Étape 2 — Validation frontend du fichier

**Fichiers modifiés** : `tracks-page.ts`.

**Démarche** : deux constantes ajoutées en tête de fichier, **volontairement
alignées sur les contrôles réels du backend** (`backend/src/app.js`, lignes
31 et 34-41, lues avant d'écrire le code plutôt que devinées) :

```ts
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg', 'audio/wav', 'audio/x-wav',
  'audio/ogg', 'audio/mp4', 'audio/x-m4a',
]);
```

La validation se déclenche dès la sélection du fichier (`choose()`), pas
au clic sur « Envoyer » : le fichier invalide est immédiatement rejeté (mis
à `undefined`, `<input type="file">` réinitialisé) et un message
explicite est affiché.

```ts
private validate(file: File): string {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    return `Format non supporté (${file.type || 'inconnu'}). Formats acceptés : MP3, WAV, OGG, M4A.`;
  }
  if (file.size > MAX_FILE_SIZE) {
    return `Fichier trop volumineux (${this.formatSize(file.size)}). Taille maximale : 25 Mo.`;
  }
  return '';
}
```

**Pourquoi ça n'annule pas la validation backend** : n'importe qui peut
appeler `POST /api/tracks` directement (curl, Postman, un autre frontend)
en sautant complètement le code Angular. La validation frontend n'est
qu'un confort — retour immédiat, pas d'aller-retour réseau inutile pour un
fichier visiblement invalide — jamais une garantie de sécurité. La seule
validation qui protège réellement le serveur est celle de Multer
(`backend/src/app.js`), qui refuse tout fichier hors formats/taille
*avant même de l'écrire sur le disque*, quel que soit l'appelant.

## Étape 3 — État de chargement + anti double-soumission

**Fichiers modifiés** : `tracks-page.ts`, `tracks-page.html`.

Trois nouveaux Signals, volontairement **séparés** de ceux de la liste
(`loading`/`error` de la Mission 2) :

```ts
readonly uploading = signal(false);
readonly uploadError = signal('');
readonly uploadSuccess = signal('');
```

**Pourquoi des Signals séparés et pas réutiliser `loading`/`error`** : ce
sont deux opérations HTTP indépendantes (charger la liste vs envoyer un
fichier). Si on avait réutilisé le même Signal `loading`, un envoi de
fichier en cours aurait aussi affiché « Chargement… » sur la liste des
pistes (et inversement), ce qui aurait été trompeur pour l'utilisateur —
deux actions distinctes, deux états distincts.

L'anti double-soumission est une simple garde en début de méthode :

```ts
upload(): void {
  if (!this.file || this.uploading()) return;
  this.uploading.set(true);
  // ...
}
```

Combinée au template, qui désactive aussi le bouton pendant l'envoi
(`[disabled]="!file || uploading()"`) : même en cas de clics multiples très
rapprochés (avant qu'Angular n'ait eu le temps de re-render le bouton
désactivé), la garde côté TypeScript bloque un deuxième appel HTTP.

## Étape 4 — Erreurs serveur et message de succès affichés

**Fichier modifié** : `tracks-page.ts`.

```ts
this.service.upload(this.file, this.title.value || this.file.name).subscribe({
  next: (track) => {
    this.uploading.set(false);
    this.uploadSuccess.set(`« ${track.title} » envoyée avec succès.`);
    // ... reset formulaire, retour page 1, rechargement (Étape 5)
  },
  error: (error) => {
    this.uploading.set(false);
    this.uploadError.set(
      error?.error?.message || 'Envoi impossible. Vérifiez le fichier et réessayez.',
    );
  },
});
```

`error?.error?.message` : dans une `HttpErrorResponse` Angular, le corps
JSON renvoyé par Express (`{ message: "..." }`, voir la gestion d'erreurs
centralisée de `backend/src/app.js`) se trouve dans la propriété `.error`
de l'objet d'erreur. Si jamais le serveur ne répond pas avec ce format
(panne réseau, timeout...), on retombe sur un message générique plutôt que
d'afficher `undefined`.

## Étape 5 — Vider le formulaire et recharger après succès

**Fichier modifié** : `tracks-page.ts`.

```ts
this.title.setValue('');
this.file = undefined;
if (this.fileInputEl) this.fileInputEl.value = '';
this.page.set(1);
this.load();
```

**Point technique non évident** : un `<input type="file">` ne peut **pas**
être vidé par data-binding Angular classique (`[value]` ne fonctionne pas
sur ce type de champ, pour des raisons de sécurité navigateur — on ne peut
pas *poser* de fichier par script, seulement le *retirer*). Il faut donc
garder une référence à l'élément natif — récupérée dans `choose()` via
`event.target` — pour pouvoir appeler `.value = ''` dessus après un envoi
réussi. Sans ça, le nom du fichier précédent resterait visiblement affiché
dans le champ malgré la réinitialisation de `this.file`.

`this.page.set(1)` puis `this.load()` : on revient explicitement en page 1
et on recharge — cohérent avec le fait qu'un nouvel upload apparaît
généralement en tête de liste (le plus récent).

## Étape 6 — Cards enrichies (et correction d'un bug d'affichage)

**Fichiers modifiés** : `tracks-page.ts`, `tracks-page.html`.

Le template affichait `{{ track.originalName }} · {{ track.size }} Ko` —
or `track.size` vient directement de `req.file.size` côté backend
(`backend/src/app.js`, voir handler `POST /api/tracks`), qui est **en
octets**, pas en kilooctets (c'est la convention de l'API Node `multer`).
Un fichier de 3 Mo affichait donc « 3 000 000 Ko » au lieu de « 3.0 Mo ».
Corrigé avec une vraie conversion :

```ts
formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} Ko`;
  return `${(kb / 1024).toFixed(1)} Mo`;
}
```

Le format (`MP3`, `WAV`, ...) est déduit du `mimeType` stocké par le
backend, pas ressaisi côté client :

```ts
format(track: Track): string {
  return track.mimeType.replace('audio/', '').replace('x-', '').toUpperCase();
}
```

Et la date, via l'API navigateur standard :

```ts
formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
}
```

## Étape 7 — Révocation de l'ObjectURL à la destruction du composant

**Fichier modifié** : `tracks-page.ts`.

```ts
constructor() {
  this.load();
  inject(DestroyRef).onDestroy(() => {
    const url = this.audioUrl();
    if (url) URL.revokeObjectURL(url);
  });
}
```

**Pourquoi `DestroyRef` et pas `ngOnDestroy`** : dans un composant Angular
standalone qui utilise déjà `inject()` partout ailleurs (comme celui-ci),
`DestroyRef.onDestroy(callback)` est l'équivalent fonctionnel moderne — pas
besoin d'implémenter l'interface `OnDestroy` ni d'ajouter une méthode de
cycle de vie séparée, le callback est enregistré directement là où le
Signal `audioUrl` est défini, ce qui garde tout le code lié à `audioUrl`
regroupé au même endroit. Le comportement est strictement équivalent à
`ngOnDestroy()`.

**Pourquoi c'est nécessaire** : sans ça, si l'utilisateur écoute un morceau
puis quitte `/tracks` (navigation vers `/profile` par exemple), l'`ObjectURL`
du dernier morceau joué resterait enregistrée en mémoire navigateur
indéfiniment (jusqu'à la fermeture complète de l'onglet) — voir le détail
dans `BLOB_OBJECTURL_STREAMING.md`, question 5.

## Vérifications à faire par toi (navigateur / Network)

Je n'ai pas d'outil pour piloter un navigateur ici, donc rien de ce qui
suit n'a été testé de mon côté — c'est le "Checkpoint Network" du sujet,
à faire avant de considérer la mission terminée :

- [ ] Upload d'un fichier valide (`fichiers-audio-de-test/`) → message de
      succès, formulaire vidé, liste rechargée en page 1
- [ ] Upload d'un fichier trop gros ou d'un mauvais format → message
      d'erreur **avant** tout appel réseau (vérifier dans Network qu'aucune
      requête `POST /api/tracks` n'est partie)
- [ ] Onglet Network sur l'upload : vérifier que la requête est bien
      `multipart/form-data` avec exactement les champs `audio` et `title`
- [ ] Forcer une erreur serveur (ex. couper le backend juste avant
      d'envoyer) → message d'erreur serveur affiché, pas juste en console
- [ ] Lecture d'un morceau → `<audio>` apparaît avec le bon titre, la
      requête `GET /api/tracks/:id/audio` porte bien l'en-tête
      `Authorization: Bearer ...` (vérifier dans Network → Headers)
- [ ] Se connecter avec un 2e compte, vérifier qu'il ne peut pas lire une
      piste appartenant au 1er compte (404 attendu, voir
      `FLUX_UPLOAD_LECTURE.md`)
- [ ] Double-clic rapide sur « Envoyer » → un seul upload part réellement

## Ce qu'il faut savoir expliquer à l'oral

- La différence entre validation frontend (confort, contournable) et
  validation backend (sécurité, seule garantie réelle).
- Pourquoi `<input type="file">` ne peut pas être réinitialisé par
  data-binding classique.
- Pourquoi les Signals d'upload sont séparés de ceux de la liste.
- Pourquoi `DestroyRef.onDestroy` et pas une classe `implements OnDestroy`.
- Le flux complet upload et lecture, avec le rôle exact de l'intercepteur
  JWT sur chacun (voir `FLUX_UPLOAD_LECTURE.md`).
