import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="toast-container" *ngIf="(toasts$ | async) as toasts">
      <div 
        *ngFor="let toast of toasts" 
        class="toast-item" 
        [ngClass]="'toast-' + toast.type"
        (click)="dismiss(toast.id)">
        <div class="toast-icon">
          <svg *ngIf="toast.type === 'success'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <svg *ngIf="toast.type === 'error'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          <svg *ngIf="toast.type === 'warning'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          <svg *ngIf="toast.type === 'info'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        </div>
        <div class="toast-message">{{ toast.message }}</div>
        <button class="toast-close" (click)="dismiss(toast.id); $event.stopPropagation()">×</button>
      </div>
    </div>
  `,
  styles: [`
    .toast-container {
      position: fixed;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: none;
    }
    .toast-item {
      pointer-events: auto;
      min-width: 280px;
      max-width: 420px;
      padding: 0.9rem 1.2rem;
      border-radius: 10px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(12px);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 0.8rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      animation: slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      transition: transform 0.2s ease, opacity 0.2s ease;
    }
    .toast-item:hover {
      transform: translateY(-2px);
    }
    .toast-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .toast-success {
      border-left: 4px solid #10b981;
      box-shadow: 0 8px 25px rgba(16, 185, 129, 0.2);
    }
    .toast-success .toast-icon {
      color: #10b981;
      font-weight: bold;
    }
    .toast-error {
      border-left: 4px solid #ef4444;
      box-shadow: 0 8px 25px rgba(239, 68, 68, 0.2);
    }
    .toast-error .toast-icon {
      color: #ef4444;
      font-weight: bold;
    }
    .toast-warning {
      border-left: 4px solid #f59e0b;
      box-shadow: 0 8px 25px rgba(245, 158, 11, 0.2);
    }
    .toast-warning .toast-icon {
      color: #f59e0b;
    }
    .toast-info {
      border-left: 4px solid #3b82f6;
      box-shadow: 0 8px 25px rgba(59, 130, 246, 0.2);
    }
    .toast-info .toast-icon {
      color: #3b82f6;
    }
    .toast-message {
      flex: 1;
      font-size: 0.92rem;
      line-height: 1.4;
      color: #f8fafc;
    }
    .toast-close {
      background: none;
      border: none;
      color: #94a3b8;
      font-size: 1.25rem;
      cursor: pointer;
      padding: 0;
      line-height: 1;
    }
    .toast-close:hover {
      color: #fff;
    }
    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateX(40px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }
  `]
})
export class ToastComponent {
  toasts$ = this.toastService.toasts;

  constructor(private toastService: ToastService) {}

  dismiss(id: number): void {
    this.toastService.remove(id);
  }
}
