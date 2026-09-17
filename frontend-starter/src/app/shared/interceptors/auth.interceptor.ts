import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Adds the bearer token to protected API requests. If a request that
 * carried a token comes back 401 (token invalide ou expiré côté serveur),
 * on nettoie la session locale et on renvoie vers /login. Un 401 sans
 * token (ex : mauvais mot de passe sur /auth/login) n'est pas concerné :
 * il reste géré par le composant appelant (message d'erreur du formulaire).
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();

  const authorizedRequest = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;

  return next(authorizedRequest).pipe(
    catchError((error: HttpErrorResponse) => {
      if (token && error.status === 401) {
        console.warn('[authInterceptor] Token invalide ou expiré, déconnexion');
        auth.logout();
        void router.navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
