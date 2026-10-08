# Mission 5 — Suppression d'une piste

Résumé de la démarche (d'après `SUJET_ETUDIANT_TP3.md`). Le code vit dans
`frontend-starter/` ; ce document explique ce qui a été fait et pourquoi.

## Ce qui était demandé

Action « Supprimer » par card, confirmation, état anti double-clic,
message succès/erreur (SnackBar Angular Material), liste mise à jour,
gestion « piste déjà supprimée / pas à moi », appel via `TrackService`
(jamais `HttpClient` dans le composant), et explication de pourquoi le guard
et l'UI ne sécurisent pas la suppression.

## État de départ (constaté avant de coder)

- Backend : `DELETE /api/tracks/:id` **existe déjà** (`backend/src/app.js`,
  `app.delete`). Il fait `findOneAndDelete({ _id, ownerId: req.auth.sub })`
  puis supprime le fichier sur disque. Réponses : `204`, `404` (inconnue ou
  pas à moi), `500` (métadonnée supprimée mais fichier non supprimé).
  → **aucune modification backend.**
- Frontend : aucune méthode `delete` dans `TrackService`, aucun bouton.
- `@angular/material` **non installé** → le SnackBar demandé était impossible.

## Étape 1 — Identifier composant et service

- Composant : `components/tracks-page/tracks-page.ts` (affiche les cards).
- Service : `shared/services/track.service.ts` (seul à utiliser `HttpClient`).

## Étape 2 — Installer Angular Material

`npm install @angular/material @angular/cdk` (versions 22.x, alignées sur
Angular 22), puis ajout du thème préconstruit
`@angular/material/prebuilt-themes/azure-blue.css` dans `angular.json`
(`styles`). Sans thème, le SnackBar s'afficherait sans style.

**Fichiers** : `package.json`, `package-lock.json`, `angular.json`.

## Étape 3 — Méthode de service

```ts
delete(id: string) {
  return this.http.delete<void>(`/api/tracks/${id}`);
}
```
`<void>` car le serveur répond `204` sans corps.

## Étape 4 — Logique du composant (`remove(track)`)

Ordre voulu, chaque garde-fou a une raison :

1. `if (this.isDeleting(track)) return;` — ignore un 2ᵉ clic.
2. `window.confirm(...)` — si refus, **aucune requête** ne part.
3. `deleting` (Signal de `Set<string>` d'ids) : l'id est ajouté avant
   l'appel, retiré au succès **et** à l'erreur (sinon bouton bloqué à vie).
   Un Set par id (et non un booléen) permet de supprimer deux pistes
   différentes en parallèle sans qu'elles se bloquent mutuellement.
4. `subscribe({ next, error })` explicite (convention du repo).
5. Succès : si la piste supprimée est celle en lecture → arrêt et
   `URL.revokeObjectURL` (sinon le lecteur joue un fichier supprimé) ;
   SnackBar ; `reloadAfterDelete()`.
6. `reloadAfterDelete()` : recharge depuis le serveur (jamais un simple
   filtrage local, qui masquerait un désaccord avec le serveur). Si la page
   courante n'avait qu'une piste et que `page > 1`, on recule d'une page
   (sinon « Page 3/2 » vide).

## Étape 5 — Erreurs (`deleteErrorMessage`)

| Statut | Message affiché | Rechargement |
|---|---|---|
| `404` | « n'existe plus ou ne vous appartient pas » | oui (écran périmé) |
| `500` | « supprimée mais fichier audio non effacé » | oui (la métadonnée a bien disparu) |
| `0` | « Serveur injoignable » | non |
| autre | « Suppression impossible » | non |

Le `404` est **volontairement identique** pour « n'existe plus » et
« appartient à un autre » : le backend ne révèle pas qu'une piste existe chez
autrui.

## Étape 6 — Template

Bouton rouge « Supprimer » dans chaque card, `disabled` pendant la
suppression et libellé « Suppression… », `aria-label` explicite.

## Pourquoi le guard et l'UI ne suffisent pas (question du sujet)

Le code Angular s'exécute chez l'utilisateur : il peut le modifier, masquer
le bouton à sa façon, ou appeler `DELETE /api/tracks/<id>` avec curl. Le
guard ne contrôle que la **navigation**. Seul le backend est digne de
confiance : le middleware `auth` vérifie signature et expiration du JWT, puis
`ownerId: req.auth.sub` dans la requête Mongo garantit qu'on ne supprime que
ses propres pistes. Le front n'apporte que le confort (confirmation, messages).

## Difficulté rencontrée

Aucune de blocage ; point d'attention : `@angular/material` à installer
avant de pouvoir importer `MatSnackBar`.

## Tests associés

Voir `../mission_7/MISSION_7.md` : suppression + rechargement, annulation,
anti double-clic, 404.
