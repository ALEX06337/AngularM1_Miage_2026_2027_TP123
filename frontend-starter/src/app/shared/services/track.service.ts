import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { Page } from '../models/page.model';
import { Track } from '../models/track.model';

/** Encapsulates all HTTP operations for backing tracks. */
@Injectable({ providedIn: 'root' })
export class TrackService {
  private readonly http = inject(HttpClient);

  list(page = 1, limit = 5) {
    return this.http.get<Page<Track>>('/api/tracks', {
      params: { page, limit },
    });
  }

  upload(file: File, title: string) {
    const body = new FormData();
    body.append('audio', file);
    body.append('title', title);
    return this.http.post<Track>('/api/tracks', body);
  }

  audio(id: string) {
    return this.http.get(`/api/tracks/${id}/audio`, {
      responseType: 'blob',
    });
  }

  /**
   * Vérifie que le fichier audio existe réellement sur le backend
   * interrogé (utile quand deux binômes partagent la même base Mongo
   * mais ont chacun leurs fichiers sur leur propre machine : la métadonnée
   * existe pour les deux, le fichier non).
   */
  isAvailable(id: string) {
    return this.http
      .head(`/api/tracks/${id}/audio`, { observe: 'response' })
      .pipe(
        map(() => true),
        catchError(() => of(false)),
      );
  }
}
