import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import '../testing/local-storage-stub';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('login() fait POST /api/auth/login avec email et password, puis stocke le token', () => {
    service.login('demo@example.com', 'Demo1234!').subscribe();

    const req = httpMock.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ email: 'demo@example.com', password: 'Demo1234!' });

    const user = { id: '1', name: 'Demo', email: 'demo@example.com', createdAt: '' };
    req.flush({ token: 'jwt-simule', user });

    expect(service.token()).toBe('jwt-simule');
    expect(service.currentUser()).toEqual(user);
  });

  it('login() ne stocke rien quand le serveur répond 401', () => {
    service.login('demo@example.com', 'mauvais').subscribe({ error: () => {} });

    httpMock
      .expectOne('/api/auth/login')
      .flush({ message: 'Identifiants incorrects' }, { status: 401, statusText: 'Unauthorized' });

    expect(service.token()).toBeNull();
    expect(service.currentUser()).toBeNull();
  });
});
