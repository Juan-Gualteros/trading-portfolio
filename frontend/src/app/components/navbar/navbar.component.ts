import { Component, OnInit, HostListener, ElementRef } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AccountService } from '../../services/account.service';
import { SettingsService, UserTradingSettings } from '../../services/settings.service';
import { ToastService } from '../../services/toast.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, CommonModule, FormsModule],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements OnInit {
  isLoggedIn = false;
  username = '';
  userEmail = '';
  isDropdownOpen = false;
  showSettingsModal = false;

  accounts: any[] = [];
  defaultAccountId: number | null = null;

  // Preferencias de configuración local
  settings: UserTradingSettings = {
    baseCurrency: 'USD',
    defaultRisk: 1.0,
    privacyMode: false,
    maxDailyLoss: 250,
    defaultMarket: 'Todos',
    autoCalculatePnL: true,
    keyboardShortcuts: true,
    soundAlerts: false,
    theme: 'Oscuro Institucional'
  };

  constructor(
    public authService: AuthService,
    private settingsService: SettingsService,
    private accountService: AccountService,
    private toastService: ToastService,
    private elementRef: ElementRef
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated$.subscribe(auth => {
      this.isLoggedIn = auth;
      if (auth) {
        const user = this.authService.getCurrentUser();
        if (user) {
          this.username = user.username || 'Trader';
          this.userEmail = user.email || '';
        }
        this.loadNavbarAccounts();
      }
    });

    // Suscribir a configuraciones reactivas
    this.settingsService.settings$.subscribe(current => {
      this.settings = { ...current };
    });
  }

  loadNavbarAccounts(): void {
    if (!this.isLoggedIn) return;
    this.accountService.getAccounts().subscribe({
      next: (data) => {
        this.accounts = data || [];
        const def = this.accounts.find(a => a.is_default);
        if (def) {
          this.defaultAccountId = def.id_account;
        } else if (this.accounts.length > 0) {
          this.defaultAccountId = this.accounts[0].id_account;
        }
      },
      error: () => {}
    });
  }

  onDefaultAccountChange(event: any): void {
    const accId = parseInt(event.target.value, 10);
    if (!accId) return;
    this.accountService.setDefaultAccount(accId).subscribe({
      next: () => {
        this.defaultAccountId = accId;
        this.toastService.success('Cuenta principal actualizada.');
        this.loadNavbarAccounts();
      },
      error: (err) => {
        console.error(err);
        this.toastService.error('Error al actualizar cuenta principal.');
      }
    });
  }

  toggleDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  closeDropdown(): void {
    this.isDropdownOpen = false;
  }

  openSettings(): void {
    this.closeDropdown();
    this.settings = { ...this.settingsService.currentSettings };
    this.loadNavbarAccounts();
    this.showSettingsModal = true;
  }

  closeSettings(): void {
    this.settingsService.applyTheme(this.settingsService.currentSettings.theme);
    this.showSettingsModal = false;
  }

  saveSettings(): void {
    this.settingsService.updateSettings(this.settings);
    this.toastService.success('Configuración guardada correctamente.');
    this.showSettingsModal = false;
  }

  toggleTheme(): void {
    this.settingsService.toggleTheme();
  }

  setTheme(theme: string): void {
    this.settings.theme = theme;
    this.settingsService.applyTheme(theme);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isDropdownOpen = false;
    }
  }

  logout(): void {
    this.isDropdownOpen = false;
    this.authService.logout();
  }
}
