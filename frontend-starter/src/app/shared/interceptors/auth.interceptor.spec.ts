import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

// AuthService lit localStorage dès sa construction. Ce test unitaire ne
// dépend pas d'un vrai environnement DOM (jsdom/happy-dom) : on fournit un
// stub minimal suffisant pour isoler la logique de l'intercepteur.
(globalThis as { localStorage?: Storage }).localStorage ??= {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
  clear: () => {},
  key: () => null,
  length: 0,
} as Storage;

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it("ajoute l'en-tête Authorization quand un token est présent", () => {
    auth.token.set('abc123');

    http.get('/api/users/me').subscribe();

    const req = httpMock.expectOne('/api/users/me');
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush({});
  });

  it("n'ajoute pas d'en-tête quand il n'y a pas de token", () => {
    auth.token.set(null);

    http.get('/api/tracks').subscribe();

    const req = httpMock.expectOne('/api/tracks');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('déconnecte et redirige vers /login sur un 401 quand un token était envoyé', () => {
    auth.token.set('expired-token');
    auth.currentUser.set({ id: '1', name: 'Demo', email: 'demo@example.com', createdAt: '' });
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    http.get('/api/users/me').subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/users/me');
    req.flush({ message: 'Jeton invalide ou expiré' }, { status: 401, statusText: 'Unauthorized' });

    expect(auth.token()).toBeNull();
    expect(auth.currentUser()).toBeNull();
    expect(navigateSpy).toHaveBeenCalledWith('/login');
  });

  it("ne redirige pas sur un 401 sans token (ex: mauvais mot de passe au login)", () => {
    auth.token.set(null);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl');

    http.post('/api/auth/login', { email: 'x', password: 'wrong' }).subscribe({ error: () => {} });

    const req = httpMock.expectOne('/api/auth/login');
    req.flush({ message: 'Identifiants incorrects' }, { status: 401, statusText: 'Unauthorized' });

    expect(navigateSpy).not.toHaveBeenCalled();
  });
});
