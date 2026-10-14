import { Injectable, signal, computed } from '@angular/core';
import { TradeService } from './trade.service';
import { AccountService } from './account.service';
import { ToastService } from './toast.service';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class TradingStoreService {
  // Signals de Estado Reactivo Global
  public accounts = signal<any[]>([]);
  public selectedAccountId = signal<number | null>(null);
  public trades = signal<any[]>([]);
  public isLoading = signal<boolean>(false);
  public lastUpdateTimestamp = signal<number>(Date.now());

  // Signal Derivado / Computed de la cuenta seleccionada
  public selectedAccount = computed(() => {
    const id = this.selectedAccountId();
    const list = this.accounts();
    if (!id || list.length === 0) return null;
    return list.find(a => a.id_account === id) || null;
  });

  // Métricas Computadas en Tiempo Real
  public computedMetrics = computed(() => {
    const allTrades = this.trades();
    const account = this.selectedAccount();
    const initialCapital = account ? parseFloat(account.balance) : 10000;

    let grossProfit = 0;
    let grossLoss = 0;
    let totalPnL = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;
    let openTrades = 0;

    const winAmounts: number[] = [];
    const lossAmounts: number[] = [];

    allTrades.forEach(t => {
      const pnl = parseFloat(t.pnl);
      if (!isNaN(pnl) && t.pnl !== null) {
        totalPnL += pnl;
        if (pnl > 0) {
          winningTrades++;
          grossProfit += pnl;
          winAmounts.push(pnl);
        } else if (pnl < 0) {
          losingTrades++;
          const abs = Math.abs(pnl);
          grossLoss += abs;
          lossAmounts.push(abs);
        } else {
          breakevenTrades++;
        }
      } else {
        openTrades++;
      }
    });

    const totalClosed = winningTrades + losingTrades + breakevenTrades;
    const winRate = totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99 : 0);
    const avgWin = winAmounts.length > 0 ? (winAmounts.reduce((a, b) => a + b, 0) / winAmounts.length) : 0;
    const avgLoss = lossAmounts.length > 0 ? (lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length) : 0;
    const currentCapital = initialCapital + totalPnL;
    const roiPercentage = initialCapital > 0 ? (totalPnL / initialCapital) * 100 : 0;

    return {
      initialCapital,
      currentCapital: parseFloat(currentCapital.toFixed(2)),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      roiPercentage: parseFloat(roiPercentage.toFixed(2)),
      winRate: parseFloat(winRate.toFixed(1)),
      profitFactor: parseFloat((profitFactor >= 99 ? 99 : profitFactor).toFixed(2)),
      winningTrades,
      losingTrades,
      breakevenTrades,
      openTrades,
      totalTrades: allTrades.length,
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossLoss: parseFloat(grossLoss.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2))
    };
  });

  constructor(
    private tradeService: TradeService,
    private accountService: AccountService,
    private toastService: ToastService
  ) {}

  /**
   * Carga las cuentas disponibles del usuario
   */
  loadAccounts(): Observable<any[]> {
    this.isLoading.set(true);
    return this.accountService.getAccounts().pipe(
      tap({
        next: (list) => {
          this.accounts.set(list || []);
          if (list && list.length > 0) {
            // Mantener selección o seleccionar la primera
            const currentId = this.selectedAccountId();
            if (!currentId || !list.some(a => a.id_account === currentId)) {
              this.selectedAccountId.set(list[0].id_account);
            }
            this.loadTrades();
          } else {
            this.selectedAccountId.set(null);
            this.trades.set([]);
            this.isLoading.set(false);
          }
        },
        error: (err) => {
          console.error('Error loading accounts:', err);
          this.isLoading.set(false);
        }
      })
    );
  }

  /**
   * Cambia la cuenta activa seleccionada
   */
  selectAccount(accountId: number): void {
    if (this.selectedAccountId() !== accountId) {
      this.selectedAccountId.set(accountId);
      this.loadTrades();
    }
  }

  /**
   * Carga operaciones de la cuenta seleccionada
   */
  loadTrades(): void {
    const accountId = this.selectedAccountId();
    if (!accountId) {
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.tradeService.getTrades(accountId).subscribe({
      next: (trades) => {
        const sorted = (trades || []).sort(
          (a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        this.trades.set(sorted);
        this.isLoading.set(false);
        this.lastUpdateTimestamp.set(Date.now());
      },
      error: (err) => {
        console.error('Error loading trades:', err);
        this.isLoading.set(false);
      }
    });
  }

  /**
   * Añade una operación y actualiza reactivamente el estado
   */
  addTrade(tradeData: any): Observable<any> {
    return this.tradeService.addTrade(tradeData).pipe(
      tap({
        next: (createdTrade) => {
          this.trades.update(current => [...current, createdTrade]);
          this.lastUpdateTimestamp.set(Date.now());
          this.toastService.success('Operación registrada exitosamente.');
        }
      })
    );
  }

  /**
   * Actualiza una operación existente en el Store
   */
  updateTrade(id: number, tradeData: any): Observable<any> {
    return this.tradeService.updateTrade(id, tradeData).pipe(
      tap({
        next: (updated) => {
          this.trades.update(current => current.map(t => t.id_trade === id ? updated : t));
          this.lastUpdateTimestamp.set(Date.now());
          this.toastService.success('Operación actualizada.');
        }
      })
    );
  }

  /**
   * Elimina una operación y actualiza reactivamente el Store
   */
  deleteTrade(id: number): Observable<any> {
    return this.tradeService.deleteTrade(id).pipe(
      tap({
        next: () => {
          this.trades.update(current => current.filter(t => t.id_trade !== id));
          this.lastUpdateTimestamp.set(Date.now());
          this.toastService.success('Operación eliminada.');
        }
      })
    );
  }

  /**
   * Importa masivamente operaciones y refresca el Store
   */
  importTrades(accountId: number, trades: any[]): Observable<any> {
    this.isLoading.set(true);
    return this.tradeService.importCSV(accountId, trades).pipe(
      tap({
        next: (res) => {
          this.loadTrades();
          this.toastService.success(`🚀 ${res.count || trades.length} operaciones importadas con éxito.`);
        },
        error: (err) => {
          this.isLoading.set(false);
          this.toastService.error('Error al importar operaciones.');
        }
      })
    );
  }
}
