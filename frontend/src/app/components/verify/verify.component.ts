import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-verify',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './verify.component.html',
  styleUrl: './verify.component.css'
})
export class VerifyComponent implements OnInit {
  status: 'loading' | 'success' | 'error' = 'loading';
  message: string = 'Verificando tu cuenta...';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.paramMap.get('token');
    if (token) {
      this.authService.verifyEmail(token).subscribe({
        next: (res) => {
          this.status = 'success';
          this.message = res.message || 'Cuenta verificada exitosamente. Ya puedes iniciar sesión.';
        },
        error: (err) => {
          this.status = 'error';
          this.message = err.error?.message || 'El enlace de verificación es inválido o ha expirado.';
        }
      });
    } else {
      this.status = 'error';
      this.message = 'No se proporcionó ningún token de verificación.';
    }
  }
}
