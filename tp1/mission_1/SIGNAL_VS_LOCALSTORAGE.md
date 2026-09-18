# Signal vs `localStorage` — pourquoi le token est stocké aux deux endroits

Livrable demandé par `SUJET_ETUDIANT_TP1.md` : « courte explication de la
différence entre Signal et `localStorage` ». Cette explication s'appuie sur
le code réel du projet (`frontend-starter/src/app/shared/services/auth.service.ts`
et `frontend-starter/src/app/shared/interceptors/auth.interceptor.ts`).

## Deux problèmes différents, deux outils différents

Un Signal (`signal<string | null>(null)`) est une variable **réactive qui
vit en mémoire, dans le JavaScript de la page en cours**. Angular observe ce
Signal : dès qu'on l'écrit avec `token.set(...)`, tout ce qui lit `token()`
dans un template (comme le `@if (auth.token())` de `app.html`) se
recalcule automatiquement et l'affichage se met à jour, sans qu'on ait à
écrire de code pour rafraîchir la page à la main.

`localStorage` est l'inverse : **une mémoire persistante du navigateur**,
qui ne fait aucun rendu, ne déclenche aucune mise à jour d'écran toute
seule — mais qui, contrairement à une variable JavaScript, **survit** à un
rechargement de page (F5), à la fermeture de l'onglet, ou même au
redémarrage du navigateur.

Le problème : dès qu'on recharge une page (F5), **tout le JavaScript
redémarre de zéro**. Toutes les variables, tous les Signals, sont
réinitialisés à leur valeur par défaut (`null`). Si le token n'était stocké
que dans un Signal, se reconnecter serait nécessaire à chaque F5 — ce qui
serait absurde pour l'utilisateur.

## Comment ça marche concrètement dans le projet

Dans `AuthService`, le Signal `token` n'est pas initialisé à `null`, mais
en relisant `localStorage` :

```ts
readonly token = signal<string | null>(localStorage.getItem('gpc_token'));
```

Et à chaque fois qu'on se connecte ou qu'on se déconnecte, les deux sont
mis à jour ensemble (jamais un seul des deux) :

```ts
// après un login réussi
localStorage.setItem('gpc_token', response.token);
this.token.set(response.token);

// dans logout()
localStorage.removeItem('gpc_token');
this.token.set(null);
```

Ce double écriture est la clé : `localStorage` garantit que l'information
« je suis connecté » n'est pas perdue au F5 ; le Signal garantit que
l'interface réagit **immédiatement**, sans F5, dès qu'on se (dé)connecte.

## Pourquoi on ne peut pas se contenter d'un seul des deux

- **Seulement `localStorage`, sans Signal** : ça marcherait, mais il
  faudrait relire `localStorage.getItem(...)` manuellement à chaque endroit
  où on veut savoir si l'utilisateur est connecté, et rien ne rafraîchirait
  l'écran automatiquement quand ça change (pas de réactivité Angular).

- **Seulement un Signal, sans `localStorage`** : l'interface réagirait
  bien en temps réel, mais un simple F5 déconnecterait l'utilisateur, car
  le Signal repartirait à `null` — c'est exactement le bug qu'on a évité
  dans `app.html` en conditionnant le bouton logout sur `auth.token()` (qui
  relit `localStorage` au démarrage) et non sur `auth.currentUser()` (qui,
  lui, n'est rempli qu'après un appel réseau explicite et n'est jamais
  réhydrogéné depuis `localStorage`).

## Le lien avec l'intercepteur et le 401

`localStorage` a cependant une limite : il ne sait pas si le token qu'il
contient est **encore valide côté serveur** (expiré après 2h, ou invalidé).
C'est le rôle de `auth.interceptor.ts` : chaque requête HTTP protégée
envoie le token, et si le serveur répond `401`, l'intercepteur appelle
`auth.logout()` — qui vide à la fois le Signal **et** `localStorage` — puis
redirige vers `/login`. Sans ça, un token expiré resterait indéfiniment
dans `localStorage`, et l'utilisateur croirait être connecté (bouton
logout visible) alors que chaque requête réelle échouerait silencieusement.

## En une phrase

Le Signal gère le **présent** (faire réagir l'écran tout de suite), et
`localStorage` gère la **mémoire** (ne pas oublier qu'on était connecté
après un F5) ; l'intercepteur, lui, garde les deux synchronisés avec la
réalité côté serveur.
