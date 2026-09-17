# Mission 0 — Cartographie de l'application

Objectif du TP1 : savoir répondre "où est-ce que ça se passe ?" pour chaque
responsabilité de l'appli, sans avoir encore touché au code. Ce document
répond à chaque point demandé dans `SUJET_ETUDIANT_TP1.md`, avec les chemins
exacts pour que tu puisses ouvrir les fichiers toi-même et vérifier.

## 1. Le composant racine

Fichier : `frontend-starter/src/app/components/app/app.ts`

```ts
@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class AppComponent {}
```

C'est le point d'entrée visuel de toute l'appli. Il est "standalone" (pas de
`NgModule`), déclare son propre template (`app.html`) et importe directement
ce dont il a besoin : `RouterLink` (pour les liens de nav) et `RouterOutlet`
(la zone où le routeur va injecter la page active).

Son template (`app.html`) contient un header fixe (titre + nav) et
`<router-outlet />`, qui est remplacé dynamiquement par le composant de la
route active (login, profil, tracks...).

**Point à creuser toi-même** : le header ne contient aucun `@if` conditionnel
sur `auth.currentUser()` — donc pas de bouton de déconnexion ni d'affichage
"connecté en tant que X" actuellement. C'est un manque de la Mission 1.

## 2. La configuration des routes

Fichier : `frontend-starter/src/app/routes.ts`

```ts
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tracks' },
  { path: 'login', component: LoginPageComponent },
  { path: 'register', component: RegisterPageComponent },
  { path: 'profile', component: ProfilePageComponent, canActivate: [authGuard] },
  { path: 'tracks', component: TracksPageComponent, canActivate: [authGuard] },
  { path: '**', redirectTo: 'tracks' },
];
```

Chaque route associe une URL à un composant "page". Deux routes sont
protégées par `canActivate: [authGuard]` — `profile` et `tracks` — donc
inaccessibles sans être connecté. `login` et `register` sont publiques.

Ces routes sont enregistrées globalement dans `src/main.ts` via
`provideRouter(routes)` (voir section 3).

## 3. L'enregistrement de HttpClient

Fichier : `frontend-starter/src/main.ts`

```ts
bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
  ],
}).catch(console.error);
```

C'est ici, et nulle part ailleurs, que `HttpClient` est rendu disponible dans
toute l'application (pattern standalone : pas de `AppModule`, on fournit tout
au bootstrap). `withInterceptors([authInterceptor])` branche l'intercepteur
qui ajoute le token JWT (section 5) à **toutes** les requêtes HTTP sortantes.

## 4. Models, services et pages

### Models — `frontend-starter/src/app/shared/models/`

| Fichier | Rôle |
|---|---|
| `user.model.ts` | Forme d'un utilisateur (id, name, email, createdAt) |
| `auth-response.model.ts` | Réponse de `/login` et `/register` : `{ token, user }` |
| `track.model.ts` | Forme d'une piste audio (métadonnées, pas le fichier) |
| `page.model.ts` | Forme générique d'une réponse paginée (`tracks?page=1&limit=5`) |

Ce sont de simples `interface` TypeScript : aucune logique, juste la forme
des données échangées avec l'API (voir `API_CONTRACT.md` pour le contrat
exact).

### Services — `frontend-starter/src/app/shared/services/`

- **`auth.service.ts`** : le seul point de contact avec `HttpClient` pour
  tout ce qui touche à l'authentification et au profil. Contient :
  - `login()`, `register()` → `POST /api/auth/login|register`
  - `profile()` → `GET /api/users/me`
  - `update(name)` → `PUT /api/users/me`
  - `logout()` → nettoie le `localStorage` et les signals, aucun appel API
  - deux **Signals** exposés : `currentUser` (utilisateur courant ou `null`)
    et `token` (JWT ou `null`, initialisé depuis `localStorage.getItem('gpc_token')`)
- **`track.service.ts`** : équivalent pour les pistes audio (upload, liste,
  lecture).

Les composants ne doivent **jamais** injecter `HttpClient` directement — ils
passent toujours par un de ces deux services. Vérifie-le toi-même : aucun
`inject(HttpClient)` ne doit apparaître dans `components/`.

### Pages — `frontend-starter/src/app/components/`

| Dossier | Route | Protégée ? |
|---|---|---|
| `login-page/` | `/login` | non |
| `register-page/` | `/register` | non |
| `profile-page/` | `/profile` | oui (`authGuard`) |
| `tracks-page/` | `/tracks` | oui (`authGuard`) |

## 5. Le mécanisme JWT sur les requêtes protégées

Deux fichiers travaillent ensemble :

**a) L'intercepteur** — `frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`

```ts
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).token();
  return next(
    token
      ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : request,
  );
};
```

Un `HttpInterceptorFn` s'exécute pour **chaque** requête HTTP sortante,
avant qu'elle parte réellement. Ici : si un token existe dans
`AuthService.token()`, on clone la requête en ajoutant l'en-tête
`Authorization: Bearer <token>`. Sinon, la requête part telle quelle.
Branché une fois pour toutes dans `main.ts` (section 3).

**b) Le guard de route** — `frontend-starter/src/app/shared/guards/auth.guard.ts`

```ts
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.token() ? true : router.createUrlTree(['/login']);
};
```

Un `CanActivateFn` s'exécute **avant** que le routeur active une route.
Ici : si un token est présent (juste sa présence, pas sa validité côté
serveur), on autorise la navigation ; sinon on redirige vers `/login`.

**Limite à noter** (pour Mission 1) : ce guard ne vérifie que la présence
locale du token, pas son expiration. Si le token expire côté serveur,
l'utilisateur reste sur la page mais les appels API renverront `401` — et
rien ne le redirige automatiquement vers `/login` dans ce cas. C'est
exactement l'item "Gestion d'un 401" demandé dans Mission 1 et qui n'est pas
encore implémenté.

## Routes publiques vs protégées (d'après `API_CONTRACT.md`)

| Route | Publique / Protégée | Détail |
|---|---|---|
| `GET /health` | Publique | Pas d'auth |
| `POST /auth/register` | Publique | Crée le compte, renvoie déjà `{token, user}` |
| `POST /auth/login` | Publique | Seule façon d'obtenir un token si on n'en a pas déjà un |
| `GET /users/me` | **Protégée** | Requiert `Authorization: Bearer <token>` |
| `PUT /users/me` | **Protégée** | Requiert le JWT |
| `GET /tracks` | **Protégée** | Requiert le JWT |
| `POST /tracks` | **Protégée** | Requiert le JWT |
| `GET /tracks/:id/audio` | **Protégée** | Requiert le JWT |
| `DELETE /tracks/:id` | **Protégée** | Requiert le JWT (bonus) |

**Règle simple à retenir** : toutes les routes sont protégées **sauf** l'inscription et la connexion — logique, puisque ce sont les deux seules routes qu'on peut appeler *avant* d'avoir un token. C'est exactement ce que fait `authGuard` côté Angular (section 5) et ce que fait `auth` (middleware Express, à repérer toi-même dans `backend/src/app.js`) côté serveur.

## Schéma du flux "clic sur Se connecter"

Voir `flux-login.md` dans ce même dossier pour le diagramme annoté.

## Réponses aux questions du sujet

**Quelles routes du backend sont utilisées côté frontend ?**
D'après `auth.service.ts` et `track.service.ts` :
- `POST /api/auth/login`
- `POST /api/auth/register`
- `GET /api/users/me`
- `PUT /api/users/me`
- `GET /api/tracks` (liste paginée)
- `POST /api/tracks` (upload)
- `GET /api/tracks/:id/audio` (streaming du fichier, à confirmer dans `track.service.ts`)

**Où s'effectue "mise à jour du profil utilisateur" ?**
- Front : `ProfilePageComponent.save()` (`components/profile-page/profile-page.ts`)
  appelle `AuthService.update(name)`, qui fait un `PUT /api/users/me` et met
  à jour le Signal `currentUser`.
- Back : à documenter par toi dans `backend/src/` — cherche la route
  `PUT /users/me` (probablement dans un fichier de routes utilisateur), le
  middleware qui vérifie le JWT, puis le handler qui appelle
  `User.findByIdAndUpdate` (ou équivalent Mongoose).
