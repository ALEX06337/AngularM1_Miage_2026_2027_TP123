# Mission 5 — Suppression d'une piste

Le code vit dans `frontend-starter/` (pas ici).

- **Résumé complet (étapes, décisions) : voir `MISSION_5.md`.**
- Suivi global : `../avancement_tp3.md`.

## Livrables

- [x] Bouton « Supprimer » + confirmation + anti double-clic + SnackBar
- [x] Liste rechargée après suppression, gestion du 404
- [x] Appel via `TrackService.delete()` (pas de `HttpClient` dans le composant)
- [x] Explication guard/UI vs backend (`MISSION_5.md`)
- [x] Tests automatisés (voir mission 7)
- [x] Capture Network d'une requête `DELETE` après confirmation :
      [`capture-network-delete.png`](capture-network-delete.png)
      (`DELETE /api/tracks/6ab4d0…`, `204 No Content`). Image recadrée avant
      la section `Request headers` pour ne pas exposer le JWT.
- [ ] Capture du SnackBar de succès : `capture-snackbar.png` (**à faire**)
