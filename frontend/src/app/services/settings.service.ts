import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface UserTradingSettings {
  baseCurrency: string;       // 'USD' | 'EUR' | 'GBP' | 'JPY' | 'COP' | 'MXN'
  defaultRisk: number;        // 0.5 to 5.0%
  privacyMode: boolean;       // Ocultar saldos en pantalla
  maxDailyLoss: number;       // Límite de pérdida diaria en USD
  defaultMarket: string;      // 'Todos' | 'Forex' | 'Futuros' | 'Cryptos' | 'Acciones' | 'Binarias'
  autoCalculatePnL: boolean;  // Auto-calcular PnL al ingresar cotizaciones
  keyboardShortcuts: boolean; // Atajos globales de teclado
  soundAlerts: boolean;       // Notificaciones auditivas
  theme: string;              // Tema institucional
}

export const DEFAULT_SETTINGS: UserTradingSettings = {
  baseCurrency: 'USD',
  defaultRisk: 1.0,
  privacyMode: false,
  maxDailyLoss: 250,
  defaultMarket: 'Todos',
  autoCalculatePnL: true,
  keyboardShortcuts: true,
  soundAlerts: false,
  theme: 'Oscuro'
};

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly STORAGE_KEY = 'user_trading_settings';
  private settingsSubject = new BehaviorSubject<UserTradingSettings>(this.loadSettings());
  public settings$ = this.settingsSubject.asObservable();

  constructor() {
    this.applyTheme(this.currentSettings.theme);
  }

  public get currentSettings(): UserTradingSettings {
    return this.settingsSubject.value;
  }

  public updateSettings(newSettings: Partial<UserTradingSettings>): void {
    const updated = { ...this.currentSettings, ...newSettings };
    if (newSettings.theme !== undefined) {
      this.applyTheme(updated.theme);
    }
    this.settingsSubject.next(updated);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving settings to localStorage:', e);
    }
  }

  public applyTheme(theme: string): void {
    if (typeof document !== 'undefined') {
      const isLight = theme === 'Claro';
      document.body.classList.toggle('light-theme', isLight);
      document.documentElement.setAttribute('data-theme', isLight ? 'light' : 'dark');
    }
  }

  public toggleTheme(): void {
    const nextTheme = this.currentSettings.theme === 'Claro' ? 'Oscuro' : 'Claro';
    this.updateSettings({ theme: nextTheme });
  }

  private loadSettings(): UserTradingSettings {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const normTheme = (parsed.theme && parsed.theme.includes('Claro')) ? 'Claro' : 'Oscuro';
        return { ...DEFAULT_SETTINGS, ...parsed, theme: normTheme };
      }
    } catch (e) {
      console.error('Error loading settings from localStorage:', e);
    }
    return { ...DEFAULT_SETTINGS };
  }
}
