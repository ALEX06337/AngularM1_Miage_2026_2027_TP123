import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse, HttpEventType } from '@angular/common/http';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin, map, Observable } from 'rxjs';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

// Doit rester aligné avec les contrôles du backend (backend/src/app.js) :
// mêmes types MIME et même taille max, pour donner un retour immédiat côté
// client sans jamais remplacer la validation serveur, qui reste la seule
// source de vérité.
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
  'audio/mp4',
  'audio/x-m4a',
]);

/** États possibles d'un upload (affichés dans l'interface). */
export type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent {
  private readonly service = inject(TrackService);
  private readonly snackBar = inject(MatSnackBar);

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly unavailable = signal<ReadonlySet<string>>(new Set());

  readonly title = new FormControl('', { nonNullable: true });
  readonly uploadStatus = signal<UploadStatus>('idle');
  readonly uploadProgress = signal(0);
  readonly uploading = computed(() => this.uploadStatus() === 'uploading');
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  file?: File;
  private fileInputEl?: HTMLInputElement;

  // Ids des pistes dont la suppression est en cours (anti double-clic).
  readonly deleting = signal<ReadonlySet<string>>(new Set());

  readonly audioUrl = signal('');
  readonly playingTrack = signal<Track | null>(null);
  readonly audioError = signal('');

  constructor() {
    this.load();
    // Le blob de lecture en cours a un ObjectURL vivant tant qu'on ne le
    // révoque pas explicitement : sans ça, il fuit en mémoire au-delà de
    // la durée de vie du composant.
    inject(DestroyRef).onDestroy(() => {
      const url = this.audioUrl();
      if (url) URL.revokeObjectURL(url);
    });
  }

  choose(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.fileInputEl = input;
    const selected = input.files?.[0];
    this.uploadError.set('');
    this.uploadSuccess.set('');

    if (!selected) {
      this.file = undefined;
      return;
    }

    const validationError = this.validate(selected);
    if (validationError) {
      console.warn('[TracksPage] Fichier rejeté côté client', selected.name, validationError);
      this.uploadError.set(validationError);
      this.file = undefined;
      input.value = '';
      return;
    }

    this.file = selected;
    console.debug('[TracksPage] Fichier sélectionné', this.file.name);
  }

  /**
   * Vérification côté client avant l'appel HTTP : elle améliore l'expérience
   * (retour immédiat, pas d'aller-retour réseau inutile) mais ne remplace
   * jamais la validation backend, seule garante de la sécurité (un client
   * malveillant peut toujours envoyer une requête sans passer par ce code).
   */
  private validate(file: File): string {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return `Format non supporté (${file.type || 'inconnu'}). Formats acceptés : MP3, WAV, OGG, M4A.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Fichier trop volumineux (${this.formatSize(file.size)}). Taille maximale : 25 Mo.`;
    }
    return '';
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.unavailable.set(new Set());
    this.service.list(this.page()).subscribe({
      next: (response) => {
        console.debug('[TracksPage] Pistes chargées', response.items.length);
        this.tracks.set(response.items);
        this.pages.set(response.pages);
        this.loading.set(false);
        this.checkAvailability(response.items);
      },
      error: (error) => {
        console.error('[TracksPage] Chargement impossible', error);
        this.loading.set(false);
        this.error.set('Impossible de charger la bibliothèque. Réessayez plus tard.');
      },
    });
  }

  /**
   * Teste chaque piste de la page courante : si le fichier audio n'existe
   * pas sur CE backend (cas d'un binôme où chacun a son propre backend
   * local mais partage la même base Mongo), on la grise dans l'UI.
   */
  private checkAvailability(items: Track[]): void {
    if (items.length === 0) return;

    const checks: Observable<{ id: string; available: boolean }>[] = items.map((track) =>
      this.service.isAvailable(track.id).pipe(
        map((available) => ({ id: track.id, available })),
      ),
    );

    forkJoin(checks).subscribe((results) => {
      const missing = results.filter((r) => !r.available).map((r) => r.id);
      if (missing.length > 0) {
        console.warn('[TracksPage] Fichiers indisponibles sur ce backend', missing);
      }
      this.unavailable.set(new Set(missing));
    });
  }

  isAvailable(track: Track): boolean {
    return !this.unavailable().has(track.id);
  }

  go(page: number): void {
    this.page.set(page);
    this.load();
  }

  upload(): void {
    if (!this.file || this.uploading()) return;

    this.uploadStatus.set('uploading');
    this.uploadProgress.set(0);
    this.uploadError.set('');
    this.uploadSuccess.set('');

    this.service.upload(this.file, this.title.value || this.file.name).subscribe({
      next: (event) => {
        if (event.type === HttpEventType.UploadProgress) {
          // `total` est undefined si la taille n'est pas connue : pas de %.
          if (event.total) {
            this.uploadProgress.set(Math.round((100 * event.loaded) / event.total));
          }
        } else if (event.type === HttpEventType.Response && event.body) {
          const track = event.body;
          console.debug('[TracksPage] Piste envoyée', track.id);
          this.uploadProgress.set(100);
          this.uploadStatus.set('success');
          this.uploadSuccess.set(`« ${track.title} » envoyée avec succès.`);
          this.title.setValue('');
          this.file = undefined;
          if (this.fileInputEl) this.fileInputEl.value = '';
          this.page.set(1);
          this.load();
        }
      },
      error: (error) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploadStatus.set('error');
        this.uploadError.set(
          error?.error?.message || 'Envoi impossible. Vérifiez le fichier et réessayez.',
        );
      },
    });
  }

  isDeleting(track: Track): boolean {
    return this.deleting().has(track.id);
  }

  /**
   * Suppression d'une piste : confirmation, verrou anti double-clic,
   * appel via TrackService, SnackBar, puis rechargement de la liste.
   * La sécurité réelle (JWT + propriétaire) reste côté backend.
   */
  remove(track: Track): void {
    if (this.isDeleting(track)) return;
    if (!window.confirm(`Supprimer « ${track.title} » ? Cette action est définitive.`)) return;

    this.setDeleting(track.id, true);
    this.service.delete(track.id).subscribe({
      next: () => {
        console.debug('[TracksPage] Piste supprimée', track.id);
        this.setDeleting(track.id, false);
        this.stopPlayingIf(track);
        this.snackBar.open(`« ${track.title} » supprimée.`, 'OK', { duration: 4000 });
        this.reloadAfterDelete();
      },
      error: (error: HttpErrorResponse) => {
        console.error('[TracksPage] Suppression impossible', error.status);
        this.setDeleting(track.id, false);
        this.snackBar.open(this.deleteErrorMessage(error), 'Fermer', { duration: 6000 });
        // 404 / 500 : l'état serveur a changé, la liste affichée est périmée.
        if (error.status === 404 || error.status === 500) this.reloadAfterDelete();
      },
    });
  }

  private deleteErrorMessage(error: HttpErrorResponse): string {
    switch (error.status) {
      case 404:
        // Même réponse pour « n'existe plus » et « appartient à un autre » :
        // le backend ne révèle pas l'existence de la piste d'autrui.
        return "Cette piste n'existe plus ou ne vous appartient pas.";
      case 500:
        return 'La piste a été supprimée mais son fichier audio n\'a pas pu être effacé.';
      case 0:
        return 'Serveur injoignable. Vérifiez votre connexion.';
      default:
        return 'Suppression impossible. Réessayez plus tard.';
    }
  }

  /** Recharge la liste ; recule d'une page si la page courante est devenue vide. */
  private reloadAfterDelete(): void {
    if (this.tracks().length === 1 && this.page() > 1) this.page.update((p) => p - 1);
    this.load();
  }

  private stopPlayingIf(track: Track): void {
    if (this.playingTrack()?.id !== track.id) return;
    URL.revokeObjectURL(this.audioUrl());
    this.audioUrl.set('');
    this.playingTrack.set(null);
  }

  private setDeleting(id: string, active: boolean): void {
    this.deleting.update((current) => {
      const next = new Set(current);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  play(track: Track): void {
    if (!this.isAvailable(track)) {
      console.warn('[TracksPage] Lecture bloquée, fichier indisponible', track.id);
      return;
    }

    this.audioError.set('');
    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        const previousUrl = this.audioUrl();
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
        this.playingTrack.set(track);
      },
      error: (error) => {
        console.error('[TracksPage] Lecture impossible', error);
        this.audioError.set('Lecture impossible. Le fichier est peut-être indisponible.');
      },
    });
  }

  format(track: Track): string {
    return track.mimeType.replace('audio/', '').replace('x-', '').toUpperCase();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} o`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} Ko`;
    return `${(kb / 1024).toFixed(1)} Mo`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
