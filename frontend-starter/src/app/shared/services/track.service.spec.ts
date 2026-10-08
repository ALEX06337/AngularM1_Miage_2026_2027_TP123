import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TrackService } from './track.service';

describe('TrackService', () => {
  let service: TrackService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TrackService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  // Vérifie qu'aucune requête inattendue n'est restée en attente.
  afterEach(() => httpMock.verify());

  it('list() transmet page et limit en paramètres de requête', () => {
    service.list(2, 10).subscribe();

    const req = httpMock.expectOne((r) => r.url === '/api/tracks');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('limit')).toBe('10');
    req.flush({ items: [], page: 2, limit: 10, total: 0, pages: 1 });
  });

  it('delete() envoie DELETE /api/tracks/:id', () => {
    let done = false;
    service.delete('abc123').subscribe(() => (done = true));

    const req = httpMock.expectOne('/api/tracks/abc123');
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
    expect(done).toBe(true);
  });

  it('upload() envoie un multipart (audio + title) et émet des événements de progression', () => {
    const file = new File(['abc'], 'riff.mp3', { type: 'audio/mpeg' });
    const events: number[] = [];
    service.upload(file, 'Mon riff').subscribe((e) => events.push(e.type));

    const req = httpMock.expectOne('/api/tracks');
    expect(req.request.method).toBe('POST');
    expect(req.request.reportProgress).toBe(true);
    const body = req.request.body as FormData;
    expect(body.get('title')).toBe('Mon riff');
    expect((body.get('audio') as File).name).toBe('riff.mp3');

    req.event({ type: HttpEventType.UploadProgress, loaded: 50, total: 100 });
    expect(events).toContain(HttpEventType.UploadProgress);
    req.flush({ id: '1', title: 'Mon riff' });
    expect(events).toContain(HttpEventType.Response);
  });
});
