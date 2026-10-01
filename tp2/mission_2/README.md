# Mission 2 — Bibliothèque paginée

Le code de Mission 2 vit dans `frontend-starter/` (pas ici) : c'est le
projet Angular réel, pas un dossier de documentation.

**Résumé complet de la mission (étapes, décisions) : voir `MISSION_2.md`.**

Mission 2 terminée, vérifiée en navigateur — voir aussi
`../avancement_tp2.md` pour le suivi détaillé de tout le TP2.

## Livrables finaux

- [x] Capture DevTools Network montrant le changement du paramètre `page`
      d'une requête `GET /api/tracks` à l'autre (clic sur Suivant/Précédent) :
      [`capture-network-page1.png`](capture-network-page1.png) (`page=1&limit=5`)
      et [`capture-network-page2-isavailable.png`](capture-network-page2-isavailable.png)
      (`page=2&limit=5` après clic sur Suivant)
- Note : la 2ᵉ capture montre aussi les requêtes `HEAD /api/tracks/:id/audio`
  de la fonctionnalité `isAvailable()` (une par piste affichée, hors sujet
  TP2, documentée dans `../../RAPPORT_IA_MODELE.md`) — le `404` visible
  dessus n'est pas une erreur, c'est une piste dont le fichier n'est pas
  présent sur ce backend local.
