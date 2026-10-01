import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
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

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './tracks-page.html',
  styleUrl: './tracks-page.css',
})
export class TracksPageComponent {
  private readonly service = inject(TrackService);

  readonly tracks = signal<Track[]>([]);
  readonly page = signal(1);
  readonly pages = signal(1);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly unavailable = signal<ReadonlySet<string>>(new Set());

  readonly title = new FormControl('', { nonNullable: true });
  readonly uploading = signal(false);
  readonly uploadError = signal('');
  readonly uploadSuccess = signal('');
  file?: File;
  private fileInputEl?: HTMLInputElement;

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

    this.uploading.set(true);
    this.uploadError.set('');
    this.uploadSuccess.set('');

    this.service.upload(this.file, this.title.value || this.file.name).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.uploading.set(false);
        this.uploadSuccess.set(`« ${track.title} » envoyée avec succès.`);
        this.title.setValue('');
        this.file = undefined;
        if (this.fileInputEl) this.fileInputEl.value = '';
        this.page.set(1);
        this.load();
      },
      error: (error) => {
        console.error('[TracksPage] Envoi impossible', error);
        this.uploading.set(false);
        this.uploadError.set(
          error?.error?.message || 'Envoi impossible. Vérifiez le fichier et réessayez.',
        );
      },
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
