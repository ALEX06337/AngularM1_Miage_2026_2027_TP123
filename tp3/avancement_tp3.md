# Avancement TP3

Suivi global du TP3 (`SUJET_ETUDIANT_TP3.md`), branche `tp3`. Même principe
que `tp2/avancement_tp2.md` : cases cochées seulement quand c'est vérifié.

**Documentation détaillée par mission** :
- [`mission_5/README.md`](mission_5/README.md) et [`mission_5/MISSION_5.md`](mission_5/MISSION_5.md) — suppression
- [`mission_6/README.md`](mission_6/README.md) et [`mission_6/MISSION_6.md`](mission_6/MISSION_6.md) — progression d'upload
- [`mission_7/README.md`](mission_7/README.md) et [`mission_7/MISSION_7.md`](mission_7/MISSION_7.md) — tests

## Constat initial (avant modifications)

- Backend : `DELETE /api/tracks/:id` existe déjà → aucune modif backend.
- Frontend : pas de suppression ; `upload()` ne renvoyait que la réponse
  finale ; seul l'intercepteur avait des tests (4).
- `@angular/material` (SnackBar exigé) non installé.

## Mission 5 — Suppression — code terminé, preuves navigateur à faire

- [x] `@angular/material` + `@angular/cdk` installés, thème dans `angular.json`
- [x] `TrackService.delete(id)`
- [x] Bouton « Supprimer », confirmation, anti double-clic (Signal d'ids)
- [x] SnackBar succès/erreur ; rechargement ; recul de page si page vide
- [x] 404 (supprimée ailleurs / pas à moi), 500, réseau gérés
- [x] Explication guard/UI vs backend rédigée
- [x] Vérifié en navigateur réel : `DELETE` → `204` (`mission_5/capture-network-delete.png`)

## Mission 6 — Progression — code terminé, preuves navigateur à faire

- [x] `observe: 'events'` + `reportProgress: true`
- [x] États `idle/uploading/success/error` + pourcentage
- [x] Contrôles désactivés, 2ᵉ soumission ignorée, barre `<progress>`
- [x] Explication « réponse unique vs événements » rédigée
- [ ] Vérifié en navigateur réel (throttling Slow 4G, % visible)

## Mission 7 — Tests — terminé

- [x] 13 tests frontend ajoutés (17/17 avec les 4 existants)
- [x] 4 tests backend ajoutés (6/6), sans MongoDB
- [x] Test de mutation (URL DELETE cassée → 8 échecs)
- [x] Stub `localStorage` partagé (cause de 4 échecs initiaux)
- [ ] (Facultatif, non fait) pagination / piste d'un autre utilisateur — base requise

## Vérifications finales

- [x] `npm test` frontend : 17/17
- [x] `npm test` backend : 6/6
- [x] `npm run build` : OK
- [x] Network : requête `DELETE` après confirmation (`mission_5/capture-network-delete.png`)
- [x] Network : requête d'upload `POST` → `201` (`mission_6/capture-network-upload.png`)
- [ ] Progression visible à l'écran (barre + %) — nécessite throttling Slow 4G
- [ ] Console sans erreur inattendue ni donnée sensible

## Livrables TP3

- [x] Suppression fonctionnelle (code + tests)
- [x] Progression d'upload (code + tests)
- [x] ≥ 3 tests frontend
- [x] Rapport des tests attendus/observés (`mission_7/MISSION_7.md`)
- [x] Captures Network suppression + upload
- [x] `npm run build` exécuté
- [x] `RAPPORT_IA_MODELE.md` — section TP3 rédigée (à compléter avec vos vérifications)
- [x] `API_CONTRACT.md` mis à jour (DELETE : 204/401/404/500)
