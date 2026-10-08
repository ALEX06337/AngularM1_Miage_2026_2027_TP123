import { TestBed } from '@angular/core/testing';
import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import '../../shared/testing/local-storage-stub';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TracksPageComponent } from './tracks-page';

const track = (id: string, title = `Piste ${id}`) => ({
  id,
  title,
  originalName: `${id}.mp3`,
  mimeType: 'audio/mpeg',
  size: 1024,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const pageOf = (ids: string[], page = 1, pages = 1) => ({
  items: ids.map((id) => track(id)),
  page,
  limit: 5,
  total: ids.length,
  pages,
});

describe('TracksPageComponent', () => {
  let httpMock: HttpTestingController;
  let component: TracksPageComponent;
  const snackBar = { open: vi.fn() };

  /** Répond à GET /api/tracks puis aux HEAD de disponibilité. */
  const flushList = (body: object, ids: string[]) => {
    httpMock.expectOne((r) => r.method === 'GET' && r.url === '/api/tracks').flush(body);
    for (const id of ids) httpMock.expectOne(`/api/tracks/${id}/audio`).flush(null);
  };

  beforeEach(() => {
    snackBar.open.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatSnackBar, useValue: snackBar },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    component = TestBed.createComponent(TracksPageComponent).componentInstance;
    flushList(pageOf(['a', 'b']), ['a', 'b']);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('suppression : DELETE /api/tracks/:id puis rechargement de la liste', () => {
    component.remove(component.tracks()[0]);

    const del = httpMock.expectOne('/api/tracks/a');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });

    expect(snackBar.open).toHaveBeenCalledWith('« Piste a » supprimée.', 'OK', expect.anything());
    // la liste est rechargée depuis le serveur
    flushList(pageOf(['b']), ['b']);
    expect(component.tracks().map((t) => t.id)).toEqual(['b']);
  });

  it('suppression : annulée si l\'utilisateur refuse la confirmation', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    component.remove(component.tracks()[0]);

    httpMock.expectNone('/api/tracks/a'); // aucune requête partie
    expect(component.isDeleting(component.tracks()[0])).toBe(false);
  });

  it('suppression : un second clic pendant la requête n\'envoie rien', () => {
    const target = component.tracks()[0];

    component.remove(target);
    component.remove(target);

    const pending = httpMock.match('/api/tracks/a');
    expect(pending.length).toBe(1);
    expect(component.isDeleting(target)).toBe(true);
    pending[0].flush(null, { status: 204, statusText: 'No Content' });
    flushList(pageOf(['b']), ['b']);
    expect(component.isDeleting(target)).toBe(false);
  });

  it('suppression : un 404 affiche un message explicite et recharge la liste', () => {
    component.remove(component.tracks()[0]);

    httpMock
      .expectOne('/api/tracks/a')
      .flush({ message: 'Piste inconnue' }, { status: 404, statusText: 'Not Found' });

    expect(snackBar.open).toHaveBeenCalledWith(
      "Cette piste n'existe plus ou ne vous appartient pas.",
      'Fermer',
      expect.anything(),
    );
    flushList(pageOf(['b']), ['b']);
  });

  it('upload : met à jour le pourcentage puis passe à success', () => {
    component.file = new File(['x'], 'riff.mp3', { type: 'audio/mpeg' });
    component.upload();
    expect(component.uploadStatus()).toBe('uploading');

    const req: TestRequest = httpMock.expectOne({ method: 'POST', url: '/api/tracks' });
    req.event({ type: HttpEventType.UploadProgress, loaded: 25, total: 100 });
    expect(component.uploadProgress()).toBe(25);

    // une seconde soumission pendant l'envoi est ignorée
    component.upload();
    httpMock.expectNone({ method: 'POST', url: '/api/tracks' });

    req.flush(track('new', 'riff'));
    expect(component.uploadStatus()).toBe('success');
    expect(component.uploadProgress()).toBe(100);
    flushList(pageOf(['new']), ['new']);
  });

  it('upload : une erreur serveur passe à error avec le message du backend', () => {
    component.file = new File(['x'], 'riff.mp3', { type: 'audio/mpeg' });
    component.upload();

    httpMock
      .expectOne({ method: 'POST', url: '/api/tracks' })
      .flush({ message: 'Format audio non accepté' }, { status: 400, statusText: 'Bad Request' });

    expect(component.uploadStatus()).toBe('error');
    expect(component.uploadError()).toBe('Format audio non accepté');
    expect(component.uploading()).toBe(false);
  });
});
