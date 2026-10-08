# Mission 6 — Progression de l'upload

Le code vit dans `frontend-starter/` (pas ici).

- **Résumé complet : voir `MISSION_6.md`.**
- Suivi global : `../avancement_tp3.md`.

## Livrables

- [x] Événements HTTP (`observe: 'events'`, `reportProgress: true`)
- [x] États `idle` / `uploading` (%) / `success` / `error`
- [x] Contrôles désactivés + anti double-soumission
- [x] Explication « pourquoi pas une requête à réponse unique » (`MISSION_6.md`)
- [x] Tests automatisés (voir mission 7)
- [x] Capture Network de l'upload :
      [`capture-network-upload.png`](capture-network-upload.png)
      (`POST /api/tracks`, `201 Created`, onglet Payload présent). Image
      recadrée pour ne pas exposer le JWT. Elle ne montre pas les événements
      de progression : voir la case suivante.
- [ ] Capture de la barre de progression : `capture-progression.png` (**à faire**)
