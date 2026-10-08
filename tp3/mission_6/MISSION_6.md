# Mission 6 — Progression de l'upload

Résumé de la démarche (d'après `SUJET_ETUDIANT_TP3.md`). Le code vit dans
`frontend-starter/`.

## Ce qui était demandé

Afficher la progression via les événements HTTP Angular, distinguer au moins
« aucun upload / en cours avec % / réussite / échec », désactiver les
contrôles pendant l'envoi, empêcher une 2ᵉ soumission, ne jamais afficher
mot de passe ni JWT, et expliquer pourquoi ce n'est pas une requête à
réponse unique.

## État de départ

- `upload()` du service : `http.post<Track>(...)` → **une seule émission**
  (la `Track` finale), donc aucune info de progression possible.
- Composant : un booléen `uploading` (TP2) — insuffisant pour distinguer
  succès/échec/repos.

## Étape 1 — Service : demander les événements

```ts
return this.http.post<Track>('/api/tracks', body, {
  observe: 'events',
  reportProgress: true,
});
```
- `reportProgress: true` : Angular émet des `HttpEventType.UploadProgress`.
- `observe: 'events'` : l'Observable livre les **événements**, plus
  seulement le corps de la réponse.

## Étape 2 — Composant : un vrai état

```ts
export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
readonly uploadStatus = signal<UploadStatus>('idle');
readonly uploadProgress = signal(0);
readonly uploading = computed(() => this.uploadStatus() === 'uploading');
```
`uploading` est **dérivé** (`computed`) : une seule source de vérité, pas de
risque que deux variables se contredisent. Le template existant
(`[disabled]="uploading()"`) continue donc de fonctionner.

## Étape 3 — Traiter les événements

```ts
next: (event) => {
  if (event.type === HttpEventType.UploadProgress) {
    if (event.total) this.uploadProgress.set(Math.round((100 * event.loaded) / event.total));
  } else if (event.type === HttpEventType.Response && event.body) {
    // succès : 100 %, message, formulaire vidé, retour page 1, rechargement
  }
}
```
- Pourcentage = `round(100 × loaded / total)`. `total` peut être
  `undefined` (taille inconnue) → on ne calcule pas, évitant `NaN %`.
- **Le succès n'est déclaré qu'à `HttpEventType.Response`.** Les autres
  événements (`Sent`, `ResponseHeader`) ne sont pas la fin de l'envoi.

## Étape 4 — Anti double-soumission et contrôles

- `if (!this.file || this.uploading()) return;` au début de `upload()`.
- Champs titre/fichier et bouton `disabled` pendant `uploading()`.
- Barre `<progress max="100" [value]="uploadProgress()">` + « N % » (rôle
  `status`) visible uniquement pendant l'envoi.
- Erreur : `uploadStatus = 'error'`, message du backend (`error.error.message`)
  ou message générique. Dans les logs, on n'affiche jamais le corps de la
  requête ni le token.

## Pourquoi ce n'est pas une requête « normale » (question du sujet)

Une requête classique émet **une valeur puis se termine** (le corps). Un
upload avec progression émet **une séquence** : `Sent`, `UploadProgress` × N,
`ResponseHeader`, `Response`. Il faut donc aiguiller sur `event.type`, et
seul `Response` contient la `Track` créée. Traiter le premier `next` comme
« terminé » serait une erreur : on afficherait un succès à 0 %.

## Comment Angular calcule le pourcentage (question de l'oral)

Le navigateur (XHR `upload.onprogress`) fournit `loaded` et `total` ;
Angular les emballe dans un `HttpProgressEvent`. Le pourcentage est calculé
par notre code : `100 × loaded / total`. Attention : cela mesure l'envoi vers
le serveur, pas le traitement serveur (écriture disque + Mongo) : on peut
être à 100 % et attendre encore la réponse.

## À savoir pour la démo

En local l'envoi est quasi instantané : pour **voir** le pourcentage,
DevTools → Network → throttling « Slow 4G » avec un fichier de plusieurs Mo.

## Tests associés

Voir `../mission_7/MISSION_7.md` : pourcentage mis à jour, passage à
`success`, erreur serveur, 2ᵉ soumission ignorée.
