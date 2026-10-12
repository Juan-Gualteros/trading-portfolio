import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { interval, Subscription } from 'rxjs';

export interface TickerItem {
  symbol: string;
  name: string;
  price: number;
  change: number;
  market: string;
}

@Component({
  selector: 'app-ticker-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './ticker-bar.component.html',
  styleUrl: './ticker-bar.component.css'
})
export class TickerBarComponent implements OnInit, OnDestroy {
  tickerList: TickerItem[] = [
    { symbol: 'BTC/USDT', name: 'Bitcoin', price: 68450.00, change: 2.35, market: 'Cryptos' },
    { symbol: 'ETH/USDT', name: 'Ethereum', price: 3540.20, change: 1.80, market: 'Cryptos' },
    { symbol: 'EUR/USD', name: 'Euro / Dólar', price: 1.0862, change: -0.12, market: 'Forex' },
    { symbol: 'GBP/USD', name: 'Libra / Dólar', price: 1.2740, change: 0.28, market: 'Forex' },
    { symbol: 'S&P 500', name: 'S&P 500', price: 5125.60, change: 0.64, market: 'Futuros' },
    { symbol: 'NASDAQ', name: 'Nasdaq 100', price: 18320.15, change: 0.95, market: 'Futuros' },
    { symbol: 'XAU/USD', name: 'Oro (Gold)', price: 2364.50, change: 0.85, market: 'Futuros' },
    { symbol: 'AAPL', name: 'Apple Inc.', price: 185.90, change: -0.34, market: 'Acciones' },
    { symbol: 'NVDA', name: 'Nvidia Corp.', price: 920.40, change: 3.12, market: 'Acciones' }
  ];
  isPaused = false;
  private sub?: Subscription;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.fetchTickers();
    this.sub = interval(45000).subscribe(() => this.fetchTickers());
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  fetchTickers(): void {
    this.http.get<TickerItem[]>('http://localhost:3000/api/market-ticker').subscribe({
      next: (data) => {
        if (data && data.length > 0) {
          this.tickerList = data;
        }
      },
      error: () => {
        // Fallback datos locales
      }
    });
  }
}
