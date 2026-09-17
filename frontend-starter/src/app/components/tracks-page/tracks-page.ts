import { Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, map, Observable } from 'rxjs';
import { Track } from '../../shared/models/track.model';
import { TrackService } from '../../shared/services/track.service';

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
  readonly audioUrl = signal('');
  readonly unavailable = signal<ReadonlySet<string>>(new Set());
  readonly title = new FormControl('', { nonNullable: true });
  file?: File;

  constructor() {
    this.load();
  }

  choose(event: Event): void {
    this.file = (event.target as HTMLInputElement).files?.[0];
    console.debug('[TracksPage] Fichier sélectionné', this.file?.name);
  }

  load(): void {
    this.loading.set(true);
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
    if (!this.file) return;

    this.service.upload(this.file, this.title.value || this.file.name).subscribe({
      next: (track) => {
        console.debug('[TracksPage] Piste envoyée', track.id);
        this.title.setValue('');
        this.file = undefined;
        this.page.set(1);
        this.load();
      },
      error: (error) => console.error('[TracksPage] Envoi impossible', error),
    });
  }

  play(track: Track): void {
    if (!this.isAvailable(track)) {
      console.warn('[TracksPage] Lecture bloquée, fichier indisponible', track.id);
      return;
    }

    this.service.audio(track.id).subscribe({
      next: (blob) => {
        console.debug('[TracksPage] Audio chargé', track.id);
        const previousUrl = this.audioUrl();
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        this.audioUrl.set(URL.createObjectURL(blob));
      },
      error: (error) => console.error('[TracksPage] Lecture impossible', error),
    });
  }
}
