import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { RecaptchaService } from '../../services/recaptcha.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent implements OnInit {
  credentials = { username: '', password: '' };
  hpCheck: string = '';
  errorMessage = '';
  isLoading = false;
  isVerifyingCaptcha = false;

  constructor(
    private authService: AuthService,
    private recaptchaService: RecaptchaService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.recaptchaService.markFormFocus();
  }

  onFieldFocus(): void {
    this.recaptchaService.markFormFocus();
  }

  async onSubmit() {
    this.isVerifyingCaptcha = true;
    this.isLoading = true;
    this.errorMessage = '';

    try {
      // Ejecución invisible y asíncrona de reCAPTCHA
      const { recaptcha_token, client_metrics } = await this.recaptchaService.executeInvisibleRecaptcha('login');
      this.isVerifyingCaptcha = false;

      const payload = {
        ...this.credentials,
        recaptcha_token,
        hp_check: this.hpCheck,
        client_metrics
      };

      this.authService.login(payload).subscribe({
        next: () => {
          this.isLoading = false;
          this.router.navigate(['/dashboard']);
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'Error al iniciar sesión. Verifica tus credenciales.';
        }
      });
    } catch (err: any) {
      this.isVerifyingCaptcha = false;
      this.isLoading = false;
      this.errorMessage = 'No se pudo completar la verificación de seguridad reCAPTCHA. Intenta nuevamente.';
    }
  }
}
