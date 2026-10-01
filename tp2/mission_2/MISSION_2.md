# Mission 2 — Bibliothèque paginée

Résumé de ce qui a été fait, pourquoi, et ce qui était attendu au départ
(d'après `SUJET_ETUDIANT_TP2.md`). Le code lui-même vit dans
`frontend-starter/` — ce document explique la démarche, pas le code en
détail (voir directement les fichiers cités).

## Ce qui était demandé par le sujet

Le backend fournit déjà `GET /api/tracks?page=1&limit=5` — **interdiction de
le modifier** pour cette mission.

- `TrackService.list(page, limit)` doit vraiment transmettre `page` et
  `limit` au backend ;
- flux attendu : `composant bibliothèque → TrackService → HttpClient → GET /api/tracks?page=...&limit=...` ;
- représenter avec des **Signals** : `tracks`, `page` (page courante),
  `pages` (nombre total de pages), `loading`, et l'erreur éventuelle ;
- afficher avec `@for`, l'état vide avec `@empty`, le chargement avec `@if` ;
- boutons « Précédent »/« Suivant », désactivés aux bornes ;
- **chaque changement de page doit refaire une requête HTTP** — interdit de
  tout récupérer puis découper côté Angular.

## État de départ (constaté avant d'y toucher)

Comme pour la Mission 1 du TP1, le starter n'était pas vide : la quasi
totalité de la Mission 2 existait déjà. En relisant
`frontend-starter/src/app/shared/services/track.service.ts` et
`frontend-starter/src/app/components/tracks-page/tracks-page.ts` avant
toute modification :

```ts
// track.service.ts — déjà présent, transmet bien page ET limit
list(page = 1, limit = 5) {
  return this.http.get<Page<Track>>('/api/tracks', {
    params: { page, limit },
  });
}
```

```ts
// tracks-page.ts — déjà présent
readonly tracks = signal<Track[]>([]);
readonly page = signal(1);
readonly pages = signal(1);
readonly loading = signal(false);
// pas de Signal `error` !

go(page: number): void {
  this.page.set(page);
  this.load();   // relance bien un appel HTTP à chaque clic, pas de slicing
}
```

Et côté template (`tracks-page.html`), `@for`/`@empty`/`@if` étaient déjà
utilisés, la pagination Préc./Suiv. déjà désactivée aux bornes
(`[disabled]="page() === 1"` / `[disabled]="page() === pages()"`).

**Constat** : un seul point manquait vraiment — **aucun Signal d'erreur**,
et donc rien à l'écran si `GET /api/tracks` échouait (l'erreur finissait
uniquement en `console.error`, invisible pour l'utilisateur final).

## Étape unique — Ajouter et afficher l'état d'erreur

**Fichiers modifiés** : `tracks-page.ts`, `tracks-page.html`.

**Démarche** : ajout d'un Signal `error` à côté des Signals existants,
remis à vide à chaque nouveau chargement (pour qu'une erreur affichée ne
reste pas collée à l'écran après un retry réussi), rempli dans la branche
`error` de la subscription :

```ts
readonly error = signal('');

load(): void {
  this.loading.set(true);
  this.error.set('');                 // on efface une éventuelle erreur précédente
  this.unavailable.set(new Set());
  this.service.list(this.page()).subscribe({
    next: (response) => { /* ... */ this.loading.set(false); },
    error: (error) => {
      console.error('[TracksPage] Chargement impossible', error);
      this.loading.set(false);
      this.error.set('Impossible de charger la bibliothèque. Réessayez plus tard.');
    },
  });
}
```

Et dans le template, juste après l'état de chargement :

```html
@if (error()) {
  <p class="error" role="alert">{{ error() }}</p>
}
```

**Décision technique** : `role="alert"` sur le paragraphe d'erreur, pas
juste une classe CSS. Un `role="alert"` est annoncé automatiquement par un
lecteur d'écran dès qu'il apparaît dans le DOM, sans que l'utilisateur ait
besoin de naviguer dessus — important pour l'accessibilité demandée par le
sujet (Mission 3, mais le principe s'applique aussi ici).

**Message générique, pas le détail technique de l'erreur** : on affiche
« Impossible de charger la bibliothèque. Réessayez plus tard. » et pas le
contenu brut de la `HttpErrorResponse` (qui peut contenir des détails
techniques inutiles, voire sensibles, pour l'utilisateur final) — le détail
technique reste réservé à `console.error`, visible seulement par qui ouvre
la console.

## Pourquoi il n'y a pas de slicing local (et pourquoi c'est important)

`go(page)` ne fait *jamais* `tracks().slice(...)` : il change juste le
Signal `page`, puis rappelle systématiquement `load()`, qui refait un vrai
`GET /api/tracks?page=X&limit=5`. C'est le backend qui décide quels
documents Mongo renvoyer pour la page demandée (`skip`/`limit` côté
Mongoose, à vérifier toi-même dans `backend/src/app.js` si tu veux
approfondir).

**Pourquoi c'est la bonne approche et pas un détail cosmétique** : si la
bibliothèque contient 10 000 morceaux, un slicing local obligerait à
télécharger les métadonnées des 10 000 pistes dès le premier affichage
(lent, gaspille de la bande passante, gaspille de la mémoire navigateur)
avant de n'en afficher que 5. La pagination serveur ne transfère et ne
charge en mémoire que les métadonnées de la page demandée — le principe est
le même que celui documenté pour l'audio dans
`../mission_3/BLOB_OBJECTURL_STREAMING.md` (question « 100 morceaux »).

## Vérification Network — à faire par toi

Je n'ai pas d'outil pour piloter un navigateur ici, donc ce point n'a pas
été vérifié de mon côté. À faire et à capturer pour les livrables :

1. Se connecter avec le compte démo, aller sur `/tracks`.
2. Ouvrir DevTools → onglet **Network**, filtrer sur `tracks` ou `Fetch/XHR`.
3. Cliquer sur « Suivant » : une nouvelle requête `GET /api/tracks?page=2&limit=5`
   doit apparaître (vérifier la query string exacte dans l'onglet Headers).
4. Vérifier que le bouton « Précédent » est bien désactivé en page 1, et
   « Suivant » désactivé sur la dernière page.
5. (Optionnel mais utile) Couper le backend un instant, cliquer sur
   « Actualiser » : le message d'erreur ajouté ci-dessus doit apparaître.

## Ce qu'il faut savoir expliquer à l'oral

- Pourquoi la pagination doit être pilotée par le serveur (`page`/`limit`
  en query params) et pas simulée côté client avec `.slice()`.
- Pourquoi le Signal `error` est remis à `''` **au début** de `load()` et
  pas seulement en cas de succès.
- La différence entre le message affiché à l'utilisateur (générique,
  actionnable) et ce qui part dans `console.error` (détail technique).
