import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css'
})
export class ProfileComponent implements OnInit {
  profile = {
    first_name: '',
    last_name: '',
    email: '',
    username: ''
  };

  passwords = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  profileSuccess = '';
  profileError = '';
  passwordSuccess = '';
  passwordError = '';
  isLoading = true;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.isLoading = true;
    this.profileError = '';
    this.authService.getProfile().subscribe({
      next: (data) => {
        this.profile = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.profileError = err.error?.message || 'Error al cargar el perfil.';
        this.isLoading = false;
      }
    });
  }

  onUpdateProfile(): void {
    this.profileSuccess = '';
    this.profileError = '';
    
    this.authService.updateProfile(this.profile).subscribe({
      next: (res) => {
        this.profileSuccess = res.message;
        // update local profile
        this.profile.first_name = res.user.first_name;
        this.profile.last_name = res.user.last_name;
        this.profile.email = res.user.email;
      },
      error: (err) => {
        this.profileError = err.error?.message || 'Error al actualizar el perfil';
      }
    });
  }

  onChangePassword(): void {
    this.passwordSuccess = '';
    this.passwordError = '';

    if (this.passwords.newPassword !== this.passwords.confirmPassword) {
      this.passwordError = 'Las nuevas contraseñas no coinciden.';
      return;
    }

    if (this.passwords.newPassword.length < 6) {
      this.passwordError = 'La contraseña debe tener al menos 6 caracteres.';
      return;
    }

    this.authService.changePassword(this.passwords).subscribe({
      next: (res) => {
        this.passwordSuccess = res.message;
        this.passwords = { currentPassword: '', newPassword: '', confirmPassword: '' };
      },
      error: (err) => {
        this.passwordError = err.error?.message || 'Error al cambiar la contraseña';
      }
    });
  }
}
