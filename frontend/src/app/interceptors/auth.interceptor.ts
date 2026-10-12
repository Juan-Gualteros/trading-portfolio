import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const toastService = inject(ToastService);
  const router = inject(Router);
  const token = authService.getToken();

  let clonedReq = req;
  if (token) {
    clonedReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Evitar cerrar sesión si el fallo proviene del formulario de login/registro
        if (!req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/register')) {
          authService.logout();
          toastService.warning('Tu sesión ha expirado o no es válida. Por favor, inicia sesión nuevamente.');
          router.navigate(['/login']);
        }
      }
      return throwError(() => error);
    })
  );
};
