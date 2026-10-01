# Mission 3 — Upload et lecture audio

Le code de Mission 3 vit dans `frontend-starter/` (pas ici) : c'est le
projet Angular réel, pas un dossier de documentation.

- **Résumé complet de la mission (étapes, décisions) : voir `MISSION_3.md`.**
- **Flux détaillé upload/lecture + intercepteur JWT : voir `FLUX_UPLOAD_LECTURE.md`.**
- **Explication Blob/ObjectURL + réponses aux 5 questions du sujet : voir `BLOB_OBJECTURL_STREAMING.md`.**

Mission 3 vérifiée en navigateur (upload, lecture, propriétaire) — voir
`../avancement_tp2.md` pour le suivi détaillé de tout le TP2.

## Livrables finaux

- [x] Upload réussi + cards enrichies :
      [`capture-upload-succes-cards.png`](capture-upload-succes-cards.png)
      (message de succès, formulaire vidé, `MPEG · 3.4 Mo · 17 sept. 2026`
      — confirme au passage la correction du bug d'affichage de taille)
- [x] Lecture audio : [`capture-lecture-audio.png`](capture-lecture-audio.png)
      (lecteur `<audio>` natif, piste en cours affichée, en lecture)
- [x] Réponse de lecture = vrai flux audio :
      [`capture-network-audio-headers.png`](capture-network-audio-headers.png)
      (`200`, `Content-Type: audio/mpeg`, `Content-Length`, `Accept-Ranges: bytes`)
- [x] Header `Authorization: Bearer ...` confirmé sur cette même requête
      (onglet Request Headers du panneau Network)
- [x] Propriétaire uniquement : [`capture-proprietaire-liste-vide.png`](capture-proprietaire-liste-vide.png)
      (2ᵉ compte `test_profil`, bibliothèque vide — la liste est bien filtrée
      par `ownerId` côté backend, pas seulement la lecture individuelle)
- [ ] Capture Network du payload multipart de l'upload (`audio` + `title`) —
      pas capturée telle quelle, mais indirectement confirmée : Multer
      renvoie `400 Fichier audio requis` si le champ `audio` manque, or
      l'upload a réussi (`201`, message de succès affiché) donc les deux
      champs sont forcément arrivés correctement formés
- [ ] Capture d'une erreur `400` sur fichier invalide — non déclenchée :
      `accept="audio/*"` sur l'`<input type="file">` filtre déjà la boîte de
      dialogue du navigateur, donc impossible d'y sélectionner un fichier
      texte/image directement ; comportement attendu, pas un bug (le code de
      validation JS existe pour le cas où ce filtre est contourné — voir
      `MISSION_3.md`, étape 2)
