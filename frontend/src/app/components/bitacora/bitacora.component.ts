import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TradeService } from '../../services/trade.service';
import { AccountService } from '../../services/account.service';
import { ToastService } from '../../services/toast.service';
import { TradingStoreService } from '../../services/trading-store.service';
import { ReportExportService } from '../../services/report-export.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-bitacora',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bitacora.component.html',
  styleUrl: './bitacora.component.css'
})
export class BitacoraComponent implements OnInit {
  trades: any[] = [];
  filteredTrades: any[] = [];
  accounts: any[] = [];
  selectedAccountId: number | null = null;
  selectedAccount: any = null;
  isPrivacyMode = false;

  // Paginación de alto rendimiento en Bitácora
  currentPage: number = 1;
  pageSize: number = 25;
  pageSizeOptions: number[] = [10, 25, 50, 100];

  // Importador Masivo de CSV (MT4/MT5, NinjaTrader, TradingView)
  showCsvModal: boolean = false;
  csvFileName: string = '';
  parsedCsvTrades: any[] = [];
  csvPreviewSnippet: any[] = [];
  isImportingCsv: boolean = false;
  
  isLoading = true;
  showForm = false;
  isEditing = false;
  isFetchingEntryPrice = false;
  isFetchingExitPrice = false;
  
  showAccountForm = false;
  isEditingAccount = false;
  accountForm: any = { name: '', market_type: 'General', balance: 10000 };
  
  emotions = ['FOMO', 'Miedo', 'Codicia', 'Calma', 'Confianza'];
  tradeTypes = ['LONG', 'SHORT'];
  marketTypes = ['Forex', 'Cryptos', 'Futuros', 'Acciones', 'Binarias'];
  statuses = ['Abierta', 'Ganada', 'Perdida', 'Empate'];

  availableConfluences: string[] = [
    'Soporte / Resistencia', 'Ruptura (Breakout)', 'Línea de Tendencia', 
    'Retroceso Fibonacci', 'Patrón de Velas', 'Noticia Fundamental', 
    'Medias Móviles', 'Order Block / SMC', 'Divergencia RSI'
  ];

  activeScreenshotModal: string | null = null;
  
  showEmotionAnalysis = false;
  isAnalyzingPsychology = false;
  aiPsychologyReport: any = null;
  emotionStats: any[] = [];
  emotionConclusion: string = '';
  isDetectingEmotion = false;
  detectedEmotionFeedback: string | null = null;

  liveFxRates: { [currency: string]: number } = {
    'USD': 1.0,
    'AUD': 0.6988,
    'EUR': 1.1206,
    'GBP': 1.3234,
    'NZD': 0.5612,
    'JPY': 158.246,
    'CAD': 1.4254,
    'CHF': 0.8300,
    'MXN': 19.50,
    'ZAR': 18.20,
    'TRY': 34.20,
    'SEK': 10.60,
    'NOK': 10.85
  };

  get calculatedForexDetails(): { pips: number, units: number, pipValueUSD: number, quoteRate: number, quote: string } | null {
    if (this.currentTrade?.market_type !== 'Forex' || !this.currentTrade?.entry_price || !this.currentTrade?.stop_loss) {
      return null;
    }
    const cleanAsset = (this.currentTrade.asset || '').toUpperCase().trim();
    const diff = Math.abs(this.currentTrade.entry_price - this.currentTrade.stop_loss);
    const isJpy = cleanAsset.includes('JPY');
    const pips = isJpy ? (diff / 0.01) : (diff / 0.0001);

    let quote = '';
    if (cleanAsset.includes('/')) {
      quote = cleanAsset.split('/')[1]?.split(' ')[0]?.trim() || '';
    } else {
      const letters = cleanAsset.replace(/[^A-Z]/g, '');
      if (letters.length === 6) quote = letters.substring(3, 6);
    }

    let rate = 1.0;
    if (quote === 'USD') {
      rate = 1.0;
    } else if (this.liveFxRates[quote]) {
      rate = this.liveFxRates[quote];
    }

    const isDirect = ['GBP', 'EUR', 'AUD', 'NZD'].includes(quote);
    const quoteMultiplier = isDirect ? rate : (rate > 0 ? (1 / rate) : 1);
    const vol = this.currentTrade.volume || 0;
    const units = Math.round(vol * 100000);
    const pipValueUSD = (isJpy ? 1000 : 10) * quoteMultiplier * vol;

    return {
      pips: parseFloat(pips.toFixed(1)),
      units,
      pipValueUSD: parseFloat(pipValueUSD.toFixed(2)),
      quoteRate: parseFloat(rate.toFixed(4)),
      quote: quote || 'USD'
    };
  }

  get calculatedFuturesDetails(): { points: number, dollarRiskPerContract: number, recommendedContracts: number, exactContracts: number, multiplier: number, isMicro: boolean } | null {
    if (this.currentTrade?.market_type !== 'Futuros' || !this.currentTrade?.entry_price || !this.currentTrade?.stop_loss) {
      return null;
    }
    const cleanAsset = (this.currentTrade.asset || '').toUpperCase().trim();
    const diff = Math.abs(this.currentTrade.entry_price - this.currentTrade.stop_loss);
    
    let multiplier = 1;
    let isMicro = false;
    if (cleanAsset.includes('MES') || cleanAsset.includes('MICRO S&P')) { multiplier = 5; isMicro = true; }
    else if (cleanAsset.includes('(ES)') || cleanAsset.includes('S&P') || cleanAsset === 'ES' || cleanAsset.startsWith('ES1!')) { multiplier = 50; }
    else if (cleanAsset.includes('MNQ') || cleanAsset.includes('MICRO NASDAQ')) { multiplier = 2; isMicro = true; }
    else if (cleanAsset.includes('(NQ)') || cleanAsset.includes('NASDAQ') || cleanAsset === 'NQ' || cleanAsset.startsWith('NQ1!')) { multiplier = 20; }
    else if (cleanAsset.includes('MYM') || cleanAsset.includes('MICRO DOW')) { multiplier = 0.5; isMicro = true; }
    else if (cleanAsset.includes('(YM)') || cleanAsset.includes('DOW') || cleanAsset === 'YM' || cleanAsset.startsWith('YM1!')) { multiplier = 5; }
    else if (cleanAsset.includes('M2K') || cleanAsset.includes('MICRO RUSSELL')) { multiplier = 5; isMicro = true; }
    else if (cleanAsset.includes('(RTY)') || cleanAsset.includes('RUSSELL') || cleanAsset === 'RTY') { multiplier = 50; }
    else if (cleanAsset.includes('MCL') || cleanAsset.includes('MICRO PETR') || cleanAsset.includes('MICRO OIL')) { multiplier = 100; isMicro = true; }
    else if (cleanAsset.includes('(CL)') || cleanAsset.includes('PETR') || cleanAsset === 'CL' || cleanAsset.includes('USOIL')) { multiplier = 1000; }
    else if (cleanAsset.includes('MGC') || cleanAsset.includes('MICRO ORO') || cleanAsset.includes('MICRO GOLD')) { multiplier = 10; isMicro = true; }
    else if (cleanAsset.includes('(GC)') || cleanAsset.includes('ORO') || cleanAsset.includes('GOLD') || cleanAsset === 'GC') { multiplier = 100; }
    else if (cleanAsset.includes('(SI)') || cleanAsset.includes('PLATA')) { multiplier = 5000; }
    else if (cleanAsset.includes('(NG)')) { multiplier = 10000; }
    else if (cleanAsset.includes('(HG)')) { multiplier = 25000; }
    else if (cleanAsset.includes('(ZB)')) { multiplier = 1000; }
    else if (cleanAsset.includes('(6E)')) { multiplier = 125000; }
    else if (cleanAsset.includes('(6J)')) { multiplier = 125000; }

    const dollarRiskPerContract = diff * multiplier;
    const exactContracts = dollarRiskPerContract > 0 ? (this.riskAmount / dollarRiskPerContract) : 0;
    const recommendedContracts = Math.max(1, Math.floor(exactContracts));

    return {
      points: parseFloat(diff.toFixed(2)),
      dollarRiskPerContract: parseFloat(dollarRiskPerContract.toFixed(2)),
      recommendedContracts,
      exactContracts: parseFloat(exactContracts.toFixed(2)),
      multiplier,
      isMicro
    };
  }

  get availableMarkets(): string[] {
    if (!this.selectedAccount) return this.marketTypes;
    if (this.selectedAccount.market_type === 'General') {
      return this.marketTypes;
    }
    return [this.selectedAccount.market_type];
  }
  
  get accountBalance(): number {
    return this.selectedAccount ? this.selectedAccount.balance : 0;
  }
  
  get totalPnL(): number {
    return this.trades.reduce((acc, trade) => acc + (parseFloat(trade.pnl) || 0), 0);
  }
  
  get currentBalance(): number {
    return this.accountBalance + this.totalPnL;
  }
  
  get riskAmount(): number {
    if (!this.currentTrade || !this.currentTrade.risk_percentage) return 0;
    const effectiveBalance = this.currentBalance > 0 ? this.currentBalance : (this.accountBalance || 1000);
    return (effectiveBalance * this.currentTrade.risk_percentage) / 100;
  }

  // Cálculo universal de PnL en dólares (USD) para cualquier mercado, activo o par
  calculatePnLInUSD(
    entryPrice: number | null | undefined,
    exitPrice: number | null | undefined,
    volume: number | null | undefined,
    marketType: string,
    asset: string,
    tradeType: string
  ): number {
    if (entryPrice === null || entryPrice === undefined || 
        exitPrice === null || exitPrice === undefined || 
        volume === null || volume === undefined || 
        volume <= 0) {
      return 0;
    }

    const direction = tradeType === 'LONG' ? 1 : -1;
    const diff = exitPrice - entryPrice;
    const cleanAsset = (asset || '').toUpperCase().trim();

    // 1. OPCIONES BINARIAS
    if (marketType === 'Binarias') {
      const rawPayout = (this.currentTrade?.payout_percentage !== undefined && this.currentTrade?.payout_percentage !== null)
        ? parseFloat(this.currentTrade.payout_percentage)
        : 85;
      const payout = (rawPayout > 0 ? rawPayout : 85) / 100;
      const effectiveDiff = diff * direction;
      if (effectiveDiff > 0.00000001) {
        return parseFloat((volume * payout).toFixed(2));
      } else if (effectiveDiff < -0.00000001) {
        return -parseFloat(volume.toFixed(2));
      } else {
        return 0;
      }
    }

    // 2. CRYPTOS
    if (marketType === 'Cryptos') {
      if (cleanAsset.endsWith('/BTC') || cleanAsset.endsWith('BTC')) {
        return parseFloat((diff * volume * direction * 65000).toFixed(2));
      }
      return parseFloat((diff * volume * direction).toFixed(2));
    }

    // 3. ACCIONES
    if (marketType === 'Acciones') {
      return parseFloat((diff * volume * direction).toFixed(2));
    }

    // 4. FUTUROS
    if (marketType === 'Futuros') {
      let contractMultiplier = 1;
      if (cleanAsset.includes('MES') || cleanAsset.includes('MICRO S&P')) {
        contractMultiplier = 5; // $5 por punto (Micro)
      } else if (cleanAsset.includes('(ES)') || cleanAsset.includes('S&P') || cleanAsset === 'ES' || cleanAsset.startsWith('ES1!')) {
        contractMultiplier = 50; // $50 por punto
      } else if (cleanAsset.includes('MNQ') || cleanAsset.includes('MICRO NASDAQ')) {
        contractMultiplier = 2; // $2 por punto (Micro)
      } else if (cleanAsset.includes('(NQ)') || cleanAsset.includes('NASDAQ') || cleanAsset === 'NQ' || cleanAsset.startsWith('NQ1!')) {
        contractMultiplier = 20; // $20 por punto
      } else if (cleanAsset.includes('MYM') || cleanAsset.includes('MICRO DOW')) {
        contractMultiplier = 0.5; // $0.50 por punto (Micro)
      } else if (cleanAsset.includes('(YM)') || cleanAsset.includes('DOW') || cleanAsset === 'YM' || cleanAsset.startsWith('YM1!')) {
        contractMultiplier = 5; // $5 por punto
      } else if (cleanAsset.includes('M2K') || cleanAsset.includes('MICRO RUSSELL')) {
        contractMultiplier = 5; // $5 por punto (Micro)
      } else if (cleanAsset.includes('(RTY)') || cleanAsset.includes('RUSSELL') || cleanAsset === 'RTY') {
        contractMultiplier = 50; // $50 por punto
      } else if (cleanAsset.includes('MCL') || cleanAsset.includes('MICRO PETR') || cleanAsset.includes('MICRO OIL') || cleanAsset.includes('MICRO CRUDE')) {
        contractMultiplier = 100; // $100 por punto (Micro)
      } else if (cleanAsset.includes('(CL)') || cleanAsset.includes('PETR') || cleanAsset === 'CL' || cleanAsset.includes('USOIL')) {
        contractMultiplier = 1000; // $1,000 por punto (1,000 barriles)
      } else if (cleanAsset.includes('MGC') || cleanAsset.includes('MICRO ORO') || cleanAsset.includes('MICRO GOLD')) {
        contractMultiplier = 10; // $10 por punto (Micro)
      } else if (cleanAsset.includes('(GC)') || cleanAsset.includes('ORO') || cleanAsset.includes('GOLD') || cleanAsset === 'GC' || cleanAsset.includes('XAU')) {
        contractMultiplier = 100; // $100 por punto (100 onzas)
      } else if (cleanAsset.includes('(SI)') || cleanAsset.includes('PLATA') || cleanAsset.includes('SILVER') || cleanAsset === 'SI' || cleanAsset.includes('XAG')) {
        contractMultiplier = 5000; // $5,000 por punto (5,000 onzas)
      } else if (cleanAsset.includes('(NG)') || cleanAsset.includes('GAS NATURAL') || cleanAsset === 'NG') {
        contractMultiplier = 10000; // $10,000 por punto (10,000 MMBtu)
      } else if (cleanAsset.includes('(HG)') || cleanAsset.includes('COBRE') || cleanAsset === 'HG') {
        contractMultiplier = 25000; // $25,000 por punto (25,000 lbs)
      } else if (cleanAsset.includes('(ZB)') || cleanAsset.includes('BONOS') || cleanAsset === 'ZB') {
        contractMultiplier = 1000; // $1,000 por punto
      } else if (cleanAsset.includes('(6E)') || cleanAsset.includes('EURO FX') || cleanAsset === '6E') {
        contractMultiplier = 125000;
      } else if (cleanAsset.includes('(6J)') || cleanAsset.includes('YEN') || cleanAsset === '6J') {
        contractMultiplier = 125000;
      }

      return parseFloat((diff * volume * contractMultiplier * direction).toFixed(2));
    }

    // 5. FOREX
    if (marketType === 'Forex') {
      if (cleanAsset.includes('XAU') || cleanAsset.includes('GOLD') || cleanAsset.includes('ORO')) {
        return parseFloat((diff * volume * 100 * direction).toFixed(2)); // 1 lote = 100 oz
      }
      if (cleanAsset.includes('XAG') || cleanAsset.includes('SILVER') || cleanAsset.includes('PLATA')) {
        return parseFloat((diff * volume * 5000 * direction).toFixed(2)); // 1 lote = 5,000 oz
      }

      const lotSize = 100000; // 1 lote estándar = 100,000 unidades
      const rawProfitQuote = diff * volume * lotSize * direction;

      let base = '';
      let quote = '';
      if (cleanAsset.includes('/')) {
        const parts = cleanAsset.split(' ')[0].split('/');
        base = parts[0].trim();
        quote = parts[1] ? parts[1].trim() : '';
      } else {
        const lettersOnly = cleanAsset.replace(/[^A-Z]/g, '');
        if (lettersOnly.length === 6) {
          base = lettersOnly.substring(0, 3);
          quote = lettersOnly.substring(3, 6);
        }
      }

      // Par directo cotizado en USD (EUR/USD, GBP/USD, AUD/USD, NZD/USD)
      if (quote === 'USD') {
        return parseFloat(rawProfitQuote.toFixed(2));
      }

      // Par indirecto con USD como moneda base (USD/JPY, USD/CHF, USD/CAD, USD/MXN, etc.)
      if (base === 'USD') {
        const rate = exitPrice > 0 ? exitPrice : entryPrice;
        return rate > 0 ? parseFloat((rawProfitQuote / rate).toFixed(2)) : parseFloat(rawProfitQuote.toFixed(2));
      }

      // Cruces de divisas (Quote convertida a USD)
      const directCurrencies = ['GBP', 'EUR', 'AUD', 'NZD'];
      if (quote && this.liveFxRates[quote]) {
        const rate = this.liveFxRates[quote];
        const isDirect = directCurrencies.includes(quote);
        const val = isDirect ? (rawProfitQuote * rate) : (rawProfitQuote / rate);
        return parseFloat(val.toFixed(2));
      }

      if (cleanAsset.includes('JPY') && this.liveFxRates['JPY']) return parseFloat((rawProfitQuote / this.liveFxRates['JPY']).toFixed(2));
      if (cleanAsset.includes('GBP') && this.liveFxRates['GBP']) return parseFloat((rawProfitQuote * this.liveFxRates['GBP']).toFixed(2));
      if (cleanAsset.includes('EUR') && this.liveFxRates['EUR']) return parseFloat((rawProfitQuote * this.liveFxRates['EUR']).toFixed(2));
      if (cleanAsset.includes('AUD') && this.liveFxRates['AUD']) return parseFloat((rawProfitQuote * this.liveFxRates['AUD']).toFixed(2));

      return parseFloat(rawProfitQuote.toFixed(2));
    }

    return parseFloat((diff * volume * direction).toFixed(2));
  }

  autoCalculateVolume(): void {
    if (!this.currentTrade.risk_percentage) return;

    // En Opciones Binarias, el importe invertido corresponde directamente al porcentaje de riesgo de la cuenta
    if (this.currentTrade.market_type === 'Binarias') {
      const riskUsd = this.riskAmount;
      if (riskUsd > 0) {
        this.currentTrade.volume = parseFloat(riskUsd.toFixed(2));
      } else if (!this.currentTrade.volume || this.currentTrade.volume <= 0) {
        this.currentTrade.volume = 1.0;
      }
      return;
    }

    if (!this.currentTrade.entry_price) return;
    if (!this.currentTrade.stop_loss) return;

    // Calculamos cuánto dinero se pierde exactamente con 1 unidad o lote si toca el Stop Loss
    const dollarLossFor1Unit = Math.abs(
      this.calculatePnLInUSD(
        this.currentTrade.entry_price,
        this.currentTrade.stop_loss,
        1.0,
        this.currentTrade.market_type,
        this.currentTrade.asset,
        this.currentTrade.trade_type
      )
    );

    if (dollarLossFor1Unit > 0) {
      const calculatedVolume = this.riskAmount / dollarLossFor1Unit;
      
      if (this.currentTrade.market_type === 'Forex') {
        this.currentTrade.volume = parseFloat(Math.max(0.01, calculatedVolume).toFixed(2));
      } else if (this.currentTrade.market_type === 'Futuros') {
        if (calculatedVolume >= 1) {
          this.currentTrade.volume = Math.floor(calculatedVolume);
        } else {
          this.currentTrade.volume = parseFloat(Math.max(0.1, calculatedVolume).toFixed(2));
        }
      } else if (this.currentTrade.market_type === 'Acciones') {
        this.currentTrade.volume = parseFloat(Math.max(1, calculatedVolume).toFixed(2));
      } else if (this.currentTrade.market_type === 'Cryptos') {
        const decimals = calculatedVolume < 0.1 ? 6 : (calculatedVolume < 10 ? 4 : 2);
        this.currentTrade.volume = parseFloat(calculatedVolume.toFixed(decimals));
      } else {
        this.currentTrade.volume = parseFloat(calculatedVolume.toFixed(4));
      }
    }
  }
  
  onRiskOrPriceChange(): void {
    this.autoCalculateVolume();
    this.autoCalculatePnL();
  }

  onAssetChange(): void {
    if (this.currentTrade?.asset) {
      this.renderChart(this.currentTrade.asset);
      const available = this.marketAssets[this.currentTrade.market_type] || [];
      const trimmed = this.currentTrade.asset.trim().toLowerCase();
      const match = available.find(a => a.toLowerCase() === trimmed);
      if (match) {
        this.fetchCurrentPrice(match, this.currentTrade.market_type, 'entry_price', false);
      }
    }
    this.onRiskOrPriceChange();
  }

  setPayout(pct: number): void {
    this.currentTrade.payout_percentage = pct;
    this.autoCalculatePnL();
  }

  onVolumeChange(): void {
    if (this.currentTrade.market_type === 'Binarias') {
      const vol = parseFloat(this.currentTrade.volume);
      const effectiveBalance = this.currentBalance > 0 ? this.currentBalance : (this.accountBalance || 1000);
      if (!isNaN(vol) && vol > 0 && effectiveBalance > 0) {
        const pct = (vol / effectiveBalance) * 100;
        this.currentTrade.risk_percentage = parseFloat(pct.toFixed(2));
      }
    }
    this.autoCalculatePnL();
  }

  get potentialBinaryGain(): number {
    const vol = parseFloat(this.currentTrade?.volume) || 1;
    const rawPayout = (this.currentTrade?.payout_percentage !== undefined && this.currentTrade?.payout_percentage !== null)
      ? parseFloat(this.currentTrade.payout_percentage)
      : 85;
    const payout = (rawPayout > 0 ? rawPayout : 85) / 100;
    return parseFloat((vol * payout).toFixed(2));
  }

  onStatusChange(): void {
    if (this.currentTrade.market_type === 'Binarias') {
      const vol = parseFloat(this.currentTrade.volume) || 1;
      const rawPayout = (this.currentTrade.payout_percentage !== undefined && this.currentTrade.payout_percentage !== null)
        ? parseFloat(this.currentTrade.payout_percentage)
        : 85;
      const payout = (rawPayout > 0 ? rawPayout : 85) / 100;
      if (this.currentTrade.status === 'Ganada') {
        this.currentTrade.pnl = parseFloat((vol * payout).toFixed(2));
      } else if (this.currentTrade.status === 'Perdida') {
        this.currentTrade.pnl = -parseFloat(vol.toFixed(2));
      } else if (this.currentTrade.status === 'Empate') {
        this.currentTrade.pnl = 0;
      }
    }
  }

  autoCalculatePnL(): void {
    // 1. Manejo específico para Opciones Binarias
    if (this.currentTrade.market_type === 'Binarias') {
      const vol = parseFloat(this.currentTrade.volume);
      if (isNaN(vol) || vol <= 0) return;
      const rawPayout = (this.currentTrade.payout_percentage !== undefined && this.currentTrade.payout_percentage !== null)
        ? parseFloat(this.currentTrade.payout_percentage)
        : 85;
      const payout = (rawPayout > 0 ? rawPayout : 85) / 100;

      if (this.currentTrade.entry_price != null && this.currentTrade.exit_price != null) {
        const entry = parseFloat(this.currentTrade.entry_price);
        const exit = parseFloat(this.currentTrade.exit_price);
        const direction = this.currentTrade.trade_type === 'LONG' ? 1 : -1;
        const eff = (exit - entry) * direction;

        if (eff > 0.00000001) {
          this.currentTrade.pnl = parseFloat((vol * payout).toFixed(2));
          this.currentTrade.status = 'Ganada';
        } else if (eff < -0.00000001) {
          this.currentTrade.pnl = -parseFloat(vol.toFixed(2));
          this.currentTrade.status = 'Perdida';
        } else {
          this.currentTrade.pnl = 0;
          this.currentTrade.status = 'Empate';
        }
      } else if (this.currentTrade.status === 'Ganada') {
        this.currentTrade.pnl = parseFloat((vol * payout).toFixed(2));
      } else if (this.currentTrade.status === 'Perdida') {
        this.currentTrade.pnl = -parseFloat(vol.toFixed(2));
      }
      return;
    }

    if (this.currentTrade.entry_price === null || this.currentTrade.entry_price === undefined || 
        this.currentTrade.exit_price === null || this.currentTrade.exit_price === undefined || 
        !this.currentTrade.volume) {
      return; 
    }
    
    const suggested = this.calculatePnLInUSD(
      this.currentTrade.entry_price,
      this.currentTrade.exit_price,
      this.currentTrade.volume,
      this.currentTrade.market_type,
      this.currentTrade.asset,
      this.currentTrade.trade_type
    );
    
    this.currentTrade.pnl = parseFloat(suggested.toFixed(2));

    // Automatizar el estado según el PnL y gestionar fecha de cierre si aplica
    if (this.currentTrade.pnl > 0) {
      this.currentTrade.status = 'Ganada';
    } else if (this.currentTrade.pnl < 0) {
      this.currentTrade.status = 'Perdida';
    } else if (this.currentTrade.pnl === 0) {
      this.currentTrade.status = 'Empate';
    }

    // Si se especificó precio de salida pero no fecha de salida, sugerir la fecha actual
    if (this.currentTrade.exit_price && !this.currentTrade.exit_date) {
      this.currentTrade.exit_date = this.formatDateTimeForInput(new Date());
    } else if (!this.currentTrade.exit_price) {
      this.currentTrade.status = 'Abierta';
      this.currentTrade.pnl = null;
      this.currentTrade.exit_date = null;
    }
  }

  formatDateTimeForInput(date: Date | string | null | undefined): string {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => n < 10 ? '0' + n : n;
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  get isOutcomeLocked(): boolean {
    return this.currentTrade?.entry_price != null && 
           this.currentTrade?.exit_price != null && 
           this.currentTrade?.entry_price !== '' && 
           this.currentTrade?.exit_price !== '';
  }

  get isHistoricalTrade(): boolean {
    if (!this.currentTrade?.entry_date) return false;
    const diff = Date.now() - new Date(this.currentTrade.entry_date).getTime();
    return diff > (1000 * 60 * 60 * 12); // Más de 12 horas atrás se considera histórica
  }

  getTradeDurationString(): string {
    if (!this.currentTrade?.entry_date || !this.currentTrade?.exit_date) return '';
    const start = new Date(this.currentTrade.entry_date).getTime();
    const end = new Date(this.currentTrade.exit_date).getTime();
    const diffMs = end - start;
    if (diffMs <= 0 || isNaN(diffMs)) return '';
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins} min`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }

  getTradeRowDuration(trade: any): string {
    const entry = trade.entry_date || trade.createdAt;
    const exit = trade.exit_date;
    if (!entry || !exit) return '';
    const start = new Date(entry).getTime();
    const end = new Date(exit).getTime();
    const diffMs = end - start;
    if (diffMs <= 0 || isNaN(diffMs)) return '';
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 60) return `${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours < 24) return `${hours}h ${mins}m`;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `${days}d ${remHours}h`;
  }

  // --- CALENDARIO Y SELECTOR DE FECHA/HORA PROFESIONAL ---
  activeDatePicker: 'entry' | 'exit' | null = null;
  calYear: number = new Date().getFullYear();
  calMonth: number = new Date().getMonth(); // 0 - 11
  calSelectedDay: number = new Date().getDate();
  calHour: number = 12; // 1 - 12
  calMinute: number = 0; // 0 - 59
  calAmpm: 'AM' | 'PM' = 'AM';
  
  readonly monthNames: string[] = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  readonly dayNamesShort: string[] = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  get calMonthName(): string {
    return this.monthNames[this.calMonth] || '';
  }

  get calDaysGrid(): { day: number | null, isToday: boolean, isSelected: boolean, isWeekend: boolean }[] {
    const year = this.calYear;
    const month = this.calMonth;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Primer día del mes: 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    let firstDayIndex = new Date(year, month, 1).getDay();
    // Normalizar para que 0 sea Lunes, 6 Domingo
    firstDayIndex = (firstDayIndex + 6) % 7;

    const grid: { day: number | null, isToday: boolean, isSelected: boolean, isWeekend: boolean }[] = [];
    
    for (let i = 0; i < firstDayIndex; i++) {
      grid.push({ day: null, isToday: false, isSelected: false, isWeekend: false });
    }

    const today = new Date();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

    for (let d = 1; d <= daysInMonth; d++) {
      const dayOfWeek = (firstDayIndex + d - 1) % 7;
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const isToday = isCurrentMonth && today.getDate() === d;
      const isSelected = this.calSelectedDay === d;
      grid.push({ day: d, isToday, isSelected, isWeekend });
    }

    return grid;
  }

  openDatePicker(type: 'entry' | 'exit'): void {
    if (type === 'exit' && !this.currentTrade?.exit_price) return;
    if (this.activeDatePicker === type) {
      this.closeDatePicker();
      return;
    }
    this.activeDatePicker = type;
    const raw = type === 'entry' ? this.currentTrade?.entry_date : this.currentTrade?.exit_date;
    const d = raw ? new Date(raw) : new Date();
    const safeDate = isNaN(d.getTime()) ? new Date() : d;

    this.calYear = safeDate.getFullYear();
    this.calMonth = safeDate.getMonth();
    this.calSelectedDay = safeDate.getDate();

    const h24 = safeDate.getHours();
    this.calAmpm = h24 >= 12 ? 'PM' : 'AM';
    this.calHour = h24 % 12 || 12;
    this.calMinute = safeDate.getMinutes();
  }

  closeDatePicker(): void {
    this.activeDatePicker = null;
  }

  prevCalMonth(): void {
    if (this.calMonth === 0) {
      this.calMonth = 11;
      this.calYear--;
    } else {
      this.calMonth--;
    }
  }

  nextCalMonth(): void {
    if (this.calMonth === 11) {
      this.calMonth = 0;
      this.calYear++;
    } else {
      this.calMonth++;
    }
  }

  selectCalDay(day: number | null): void {
    if (!day) return;
    this.calSelectedDay = day;
  }

  setCalHour(h: number): void {
    this.calHour = Math.max(1, Math.min(12, h));
  }

  stepCalHour(delta: number): void {
    let next = this.calHour + delta;
    if (next > 12) next = 1;
    if (next < 1) next = 12;
    this.calHour = next;
  }

  setCalMinute(m: number): void {
    this.calMinute = Math.max(0, Math.min(59, m));
  }

  stepCalMinute(delta: number): void {
    let next = this.calMinute + delta;
    if (next >= 60) next = 0;
    if (next < 0) next = 55;
    this.calMinute = next;
  }

  toggleCalAmpm(ampm: 'AM' | 'PM'): void {
    this.calAmpm = ampm;
  }

  get calPreviewFormatted(): string {
    let h24 = this.calHour % 12;
    if (this.calAmpm === 'PM') h24 += 12;
    const d = new Date(this.calYear, this.calMonth, this.calSelectedDay, h24, this.calMinute, 0);
    return isNaN(d.getTime()) ? '' : this.formatDisplayDate(this.formatDateTimeForInput(d));
  }

  applyCalDateTime(): void {
    if (!this.activeDatePicker) return;
    
    let h24 = this.calHour % 12;
    if (this.calAmpm === 'PM') h24 += 12;
    
    const d = new Date(this.calYear, this.calMonth, this.calSelectedDay, h24, this.calMinute, 0);
    const formatted = this.formatDateTimeForInput(d);

    const pickerType = this.activeDatePicker;
    if (pickerType === 'entry') {
      this.currentTrade.entry_date = formatted;
      this.onTradeDateChange();
    } else {
      this.currentTrade.exit_date = formatted;
      this.autoCalculatePnL();
    }

    this.activeDatePicker = null;
    this.toastService.success(`Fecha de ${pickerType === 'entry' ? 'entrada' : 'cierre'} actualizada.`);
  }

  applyTraderPreset(preset: string): void {
    const now = new Date();
    let target = new Date();

    if (preset === 'now') {
      target = now;
    } else if (preset === '-15m') {
      target = new Date(now.getTime() - (15 * 60 * 1000));
    } else if (preset === '-1h') {
      target = new Date(now.getTime() - (60 * 60 * 1000));
    } else if (preset === '-4h') {
      target = new Date(now.getTime() - (4 * 60 * 60 * 1000));
    } else if (preset === 'yesterday') {
      target = new Date(now.getTime() - (24 * 60 * 60 * 1000));
    } else if (preset === 'ny_open') {
      target.setHours(9, 30, 0, 0);
    } else if (preset === 'london_open') {
      target.setHours(3, 0, 0, 0);
    } else if (preset === '+5m' && this.currentTrade?.entry_date) {
      const entry = new Date(this.currentTrade.entry_date);
      target = new Date(entry.getTime() + (5 * 60 * 1000));
    } else if (preset === '+15m' && this.currentTrade?.entry_date) {
      const entry = new Date(this.currentTrade.entry_date);
      target = new Date(entry.getTime() + (15 * 60 * 1000));
    } else if (preset === '+30m' && this.currentTrade?.entry_date) {
      const entry = new Date(this.currentTrade.entry_date);
      target = new Date(entry.getTime() + (30 * 60 * 1000));
    } else if (preset === '+1h' && this.currentTrade?.entry_date) {
      const entry = new Date(this.currentTrade.entry_date);
      target = new Date(entry.getTime() + (60 * 60 * 1000));
    } else if (preset === '+4h' && this.currentTrade?.entry_date) {
      const entry = new Date(this.currentTrade.entry_date);
      target = new Date(entry.getTime() + (4 * 60 * 60 * 1000));
    }

    this.calYear = target.getFullYear();
    this.calMonth = target.getMonth();
    this.calSelectedDay = target.getDate();
    const h24 = target.getHours();
    this.calAmpm = h24 >= 12 ? 'PM' : 'AM';
    this.calHour = h24 % 12 || 12;
    this.calMinute = target.getMinutes();
  }

  formatDisplayDate(dateStr?: string | null): string {
    if (!dateStr) return 'No definida';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Fecha no seleccionada';

    const day = d.getDate();
    const month = this.monthNames[d.getMonth()]?.substring(0, 3) || '';
    const year = d.getFullYear();
    let h = d.getHours();
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    const m = d.getMinutes() < 10 ? '0' + d.getMinutes() : d.getMinutes();

    return `${day} ${month} ${year}, ${h}:${m} ${ampm}`;
  }

  getDateBadge(dateStr?: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    
    const now = new Date();
    const isToday = now.toDateString() === d.toDateString();
    if (isToday) return 'Hoy';

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (yesterday.toDateString() === d.toDateString()) return 'Ayer';

    const diffDays = Math.round((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays > 0) return `Hace ${diffDays}d`;
    if (diffDays < 0) return `En ${Math.abs(diffDays)}d`;
    return '';
  }

  setCurrentEntryDate(): void {
    this.currentTrade.entry_date = this.formatDateTimeForInput(new Date());
    this.onTradeDateChange();
  }

  setCurrentExitDate(): void {
    this.currentTrade.exit_date = this.formatDateTimeForInput(new Date());
    this.autoCalculatePnL();
  }

  onTradeDateChange(): void {
    if (this.currentTrade?.asset) {
      this.renderChart(this.currentTrade.asset);
    }
  }

  copyTradeDateToClipboard(): void {
    if (!this.currentTrade?.entry_date) return;
    const d = new Date(this.currentTrade.entry_date);
    if (isNaN(d.getTime())) return;
    const pad = (n: number) => n < 10 ? '0' + n : n;
    const str = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(str).then(() => {
        this.toastService.info(`Fecha copiada: ${str}. En el gráfico presiona Alt+G para saltar a esta fecha.`);
      }).catch(() => {
        this.toastService.info(`Fecha del trade: ${str}`);
      });
    } else {
      this.toastService.info(`Fecha del trade: ${str}`);
    }
  }



  getPipsOrPointsDiff(p1: number | null, p2: number | null): string {
    if (p1 === null || p2 === null) return '';
    const diff = Math.abs(p1 - p2);
    const asset = (this.currentTrade?.asset || '').toUpperCase();
    if (this.currentTrade?.market_type === 'Forex') {
      const isJpy = asset.includes('JPY');
      const pips = isJpy ? (diff / 0.01) : (diff / 0.0001);
      return `${pips.toFixed(1)} pips`;
    }
    if (this.currentTrade?.market_type === 'Futuros') {
      return `${diff.toFixed(2)} pts`;
    }
    if (this.currentTrade?.market_type === 'Cryptos') {
      const base = Math.min(p1, p2);
      const pct = base > 0 ? (diff / base) * 100 : 0;
      return `${pct.toFixed(2)}% ($${diff.toFixed(2)})`;
    }
    return `$${diff.toFixed(2)}`;
  }

  getAssetSpecInfo(): string {
    const market = this.currentTrade.market_type;
    const asset = (this.currentTrade.asset || '').toUpperCase();
    if (market === 'Binarias') return `Retorno broker: ${this.currentTrade.payout_percentage || 85}% por operación ganadora. Sin Stop Loss / Take Profit (vencimiento por tiempo).`;
    if (market === 'Cryptos') return 'Cotización directa en USD/USDT por unidad.';
    if (market === 'Acciones') return '1 unidad = 1 acción en USD. PnL directo por diferencia de precio.';
    if (market === 'Futuros') {
      if (asset.includes('MES') || asset.includes('MICRO S&P')) return 'Contrato Micro E-mini S&P 500 (MES): $5 USD por punto ($1.25/tick CME)';
      if (asset.includes('ES') || asset.includes('S&P')) return 'Contrato E-mini S&P 500 (ES): $50 USD por punto ($12.50/tick CME)';
      if (asset.includes('MNQ') || asset.includes('MICRO NASDAQ')) return 'Contrato Micro E-mini Nasdaq (MNQ): $2 USD por punto ($0.50/tick CME)';
      if (asset.includes('NQ') || asset.includes('NASDAQ')) return 'Contrato E-mini Nasdaq 100 (NQ): $20 USD por punto ($5.00/tick CME)';
      if (asset.includes('MYM') || asset.includes('MICRO DOW')) return 'Contrato Micro E-mini Dow (MYM): $0.50 USD por punto ($0.50/tick CME)';
      if (asset.includes('YM') || asset.includes('DOW')) return 'Contrato E-mini Dow Jones (YM): $5 USD por punto ($5.00/tick CME)';
      if (asset.includes('M2K') || asset.includes('MICRO RUSSELL')) return 'Contrato Micro Russell 2000 (M2K): $5 USD por punto ($0.50/tick CME)';
      if (asset.includes('RTY') || asset.includes('RUSSELL')) return 'Contrato E-mini Russell 2000 (RTY): $50 USD por punto ($5.00/tick CME)';
      if (asset.includes('MCL') || asset.includes('MICRO PETR') || asset.includes('MICRO OIL')) return 'Contrato Micro Petróleo (MCL - 100 barriles): $100 USD por punto ($1/tick NYMEX)';
      if (asset.includes('CL') || asset.includes('PETR') || asset.includes('USOIL')) return 'Contrato Petróleo Crudo (CL - 1,000 barriles): $1,000 USD por punto ($10/tick NYMEX)';
      if (asset.includes('MGC') || asset.includes('MICRO ORO') || asset.includes('MICRO GOLD')) return 'Contrato Micro Oro (MGC - 10 oz troy): $10 USD por punto ($1/tick COMEX)';
      if (asset.includes('GC') || asset.includes('ORO') || asset.includes('GOLD')) return 'Contrato Oro (GC - 100 oz troy): $100 USD por punto ($10/tick COMEX)';
      if (asset.includes('SI') || asset.includes('PLATA')) return 'Contrato Plata (SI - 5,000 oz): $5,000 USD por punto ($25/tick COMEX)';
      if (asset.includes('NG') || asset.includes('GAS')) return 'Contrato Gas Natural (NG - 10,000 MMBtu): $10,000 USD por punto ($10/tick NYMEX)';
      if (asset.includes('HG') || asset.includes('COBRE')) return 'Contrato Cobre (HG - 25,000 lbs): $25,000 USD por punto ($12.50/tick COMEX)';
      if (asset.includes('ZB') || asset.includes('BONOS')) return 'Contrato Bonos del Tesoro 30A (ZB): $1,000 USD por punto (CBOT)';
      if (asset.includes('6E') || asset.includes('EURO FX')) return 'Contrato Futuro Euro FX (6E - 125,000 EUR): $12.50 USD por pip (CME)';
      return 'Futuros: Multiplicadores oficiales CME / NYMEX / CBOT para cálculo de margen y riesgo.';
    }
    if (market === 'Forex') {
      if (asset.includes('XAU') || asset.includes('GOLD') || asset.includes('ORO')) return 'Oro Forex (XAU/USD): 1 lote estándar = 100 oz troy ($10 USD por pip)';
      if (asset.includes('XAG') || asset.includes('SILVER') || asset.includes('PLATA')) return 'Plata Forex (XAG/USD): 1 lote estándar = 5,000 oz troy ($50 USD por punto)';
      if (asset.endsWith('USD')) return 'Forex Directo: 1 lote estándar = 100,000 unidades ($10.00 USD / pip)';
      if (asset.startsWith('USD')) return 'Forex Indirecto: Conversión interbancaria dividida por tasa de cambio oficial (BCE)';
      return 'Forex Cruce (Estilo Myfxbook): Conversión de divisa cotizada a USD vía feed interbancario del Banco Central Europeo';
    }
    return '';
  }
  
  analyzeEmotions(): void {
    if (!this.selectedAccountId) return;
    this.isAnalyzingPsychology = true;
    this.toastService.info('Analizando perfil conductual y sesgos de la cuenta...');

    this.tradeService.getPsychologicalAnalysis(this.selectedAccountId, true).subscribe({
      next: (res) => {
        this.isAnalyzingPsychology = false;
        if (res && res.hasData) {
          this.aiPsychologyReport = res;
          this.emotionStats = res.emotionStats || [];
          this.emotionConclusion = res.aiSummary || '';
          this.showEmotionAnalysis = true;
        } else {
          this.generateLocalPsychologicalReport();
        }
      },
      error: (err) => {
        console.error('Error fetching psychological analysis from server:', err);
        this.isAnalyzingPsychology = false;
        this.generateLocalPsychologicalReport();
      }
    });
  }

  generateLocalPsychologicalReport(): void {
    const trades = [...this.trades].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    
    if (trades.length === 0) {
      this.aiPsychologyReport = {
        hasData: true,
        isInitial: true,
        totalTrades: 0,
        archetype: {
          title: 'Estratega Disciplinado',
          emoji: '',
          subtitle: 'Disciplina inicial intacta (100% de cumplimiento)',
          description: 'Tu cuenta arranca con una hoja en blanco y 100% de disciplina mental. Tu capital está blindado y tus reglas listas para ejecutar. Mantén este estándar impecable colocando Stop Loss técnico y respetando el riesgo por operación desde tu primer trade.'
        },
        disciplineScore: 100,
        biases: [
          {
            name: 'Trading por Venganza (Revenge)',
            severity: 0,
            costUSD: 0,
            detected: false,
            tip: 'Mantén una pausa obligatoria de 20 minutos si el mercado toca tu Stop Loss.'
          },
          {
            name: 'FOMO (Entradas Impulsivas / Sin SL)',
            severity: 0,
            costUSD: 0,
            detected: false,
            tip: 'Exige confirmación de tus confluencias antes de pulsar comprar o vender.'
          },
          {
            name: 'Efecto Disposición (Aversión al Riesgo)',
            severity: 0,
            costUSD: 0,
            detected: false,
            tip: 'Deja correr las ganancias a tu Take Profit técnico y asume las pérdidas normales como costo del negocio.'
          }
        ],
        financialImpact: {
          undisciplinedLoss: 0,
          potentialSavings: 0
        },
        prescriptions: [
          '<strong>Disciplina Inicial al 100%:</strong> Inicias con el índice de disciplina perfecto. Tu objetivo profesional es protegerlo trade a trade.',
          '<strong>Regla del Stop Loss Técnico:</strong> Toda orden debe ingresar al mercado con su nivel de invalidación definido previamente.',
          '<strong>Aceptación Probabilística:</strong> Evalúa tu jornada por el porcentaje de disciplina operativa, no por el dinero diario.'
        ],
        aiSummary: 'Bienvenido al <strong>Auditor de Psicología Operativa</strong>. Tu cuenta arranca con un índice de disciplina mental del <strong>100/100</strong> y $0.00 de fuga de capital. Tu ventaja estadística se forja respetando tu plan desde la primera operación.'
      };
      this.emotionStats = [];
      this.emotionConclusion = this.aiPsychologyReport.aiSummary;
      this.showEmotionAnalysis = true;
      return;
    }

    const totalTrades = trades.length;
    let closedTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let slSetCount = 0;
    let safeRiskCount = 0;
    let revengeCount = 0;
    let revengeLoss = 0;
    let fomoCount = 0;
    let fomoLoss = 0;
    let undisciplinedLoss = 0;
    let netPnL = 0;
    let winAmounts: number[] = [];
    let lossAmounts: number[] = [];
    let stats: { [key: string]: any } = {};

    trades.forEach((t, i) => {
      const pnl = t.pnl !== null && t.pnl !== undefined ? parseFloat(t.pnl) : null;
      if (pnl !== null && !isNaN(pnl)) {
        closedTrades++;
        netPnL += pnl;
        if (pnl > 0) {
          winningTrades++;
          winAmounts.push(pnl);
        } else if (pnl < 0) {
          losingTrades++;
          lossAmounts.push(Math.abs(pnl));
        }
      }

      const emo = t.emotion_state || 'Calma';
      if (!stats[emo]) stats[emo] = { emotion: emo, count: 0, wins: 0, pnl: 0 };
      stats[emo].count++;
      if (pnl !== null && !isNaN(pnl)) {
        if (pnl > 0) stats[emo].wins++;
        stats[emo].pnl += pnl;
      }

      const hasSL = (t.stop_loss !== null && t.stop_loss !== undefined && parseFloat(t.stop_loss) > 0);
      if (hasSL) {
        slSetCount++;
      } else {
        fomoCount++;
        if (pnl !== null && pnl < 0) fomoLoss += Math.abs(pnl);
      }

      const risk = (t.risk_percentage !== null && t.risk_percentage !== undefined && !isNaN(parseFloat(t.risk_percentage)))
        ? parseFloat(t.risk_percentage)
        : 1.0;
      const isSafeRisk = (risk <= 2.5);
      if (isSafeRisk) safeRiskCount++;

      let isRevenge = false;
      if (i > 0) {
        const prev = trades[i - 1];
        const prevPnl = prev.pnl !== null && prev.pnl !== undefined ? parseFloat(prev.pnl) : 0;
        if (prevPnl < 0) {
          const diffMin = (new Date(t.createdAt).getTime() - new Date(prev.createdAt).getTime()) / (1000 * 60);
          const volInc = (t.volume && prev.volume && parseFloat(t.volume) > parseFloat(prev.volume) * 1.25);
          const isNegativeEmo = ['FOMO', 'Venganza', 'Ira', 'Frustración', 'Desquite'].includes(emo);
          if (diffMin >= 0 && diffMin < 20 && (volInc || !isSafeRisk || !hasSL || isNegativeEmo)) {
            isRevenge = true;
            revengeCount++;
            if (pnl !== null && pnl < 0) revengeLoss += Math.abs(pnl);
          }
        }
      }

      if (pnl !== null && pnl < 0) {
        if (!hasSL || !isSafeRisk || isRevenge) {
          undisciplinedLoss += Math.abs(pnl);
        }
      }
    });

    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const avgWin = winAmounts.length > 0 ? (winAmounts.reduce((a, b) => a + b, 0) / winAmounts.length) : 0;
    const avgLoss = lossAmounts.length > 0 ? (lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length) : 0;
    const dispositionRatio = avgLoss > 0 ? (avgWin / avgLoss) : 1;

    const isSuperPositive = (netPnL > 0 && (winRate >= 65 || losingTrades <= 1));

    let calculatedDiscipline = Math.round(
      ((slSetCount / totalTrades) * 40) +
      ((safeRiskCount / totalTrades) * 35) +
      Math.max(0, 15 - (revengeCount * 15)) +
      (isSuperPositive ? 10 : 8)
    );
    if (slSetCount === totalTrades && safeRiskCount === totalTrades && revengeCount === 0) {
      calculatedDiscipline = 100;
    }
    const disciplineScore = Math.max(10, Math.min(100, calculatedDiscipline));

    let archetype = {
      title: 'Operador Metódico en Desarrollo',
      emoji: '',
      subtitle: 'Trading estructurado con margen de optimización',
      description: 'Muestras una base sólida de reglas y control de riesgo, con buena resiliencia mental general.'
    };

    if (isSuperPositive) {
      archetype = {
        title: 'Estratega de Alta Precisión',
        emoji: '',
        subtitle: `Alta ventaja estadística institucional (${winRate.toFixed(0)}% Win Rate)`,
        description: `Muestras una lectura de mercado técnica con balance neto de +$${netPnL.toFixed(2)} USD. ` +
          (losingTrades <= 1 
            ? `Tu única pérdida es simplemente varianza estadística normal y controlada por tu Stop Loss.` 
            : `Tus pérdidas están rigurosamente contenidas dentro de tu plan de riesgo.`)
      };
    } else if (revengeCount >= 2 && revengeLoss > 0) {
      archetype = {
        title: 'Operador Reactivo',
        emoji: '',
        subtitle: 'Vulnerable a buscar revancha rápida tras una pérdida',
        description: 'La frustración post-pérdida nubla tu criterio temporalmente. Tiendes a entrar deprisa intentando recuperar el capital.'
      };
    } else if (fomoCount >= Math.max(2, totalTrades * 0.4) || (slSetCount < totalTrades * 0.6)) {
      archetype = {
        title: 'Operador Impulsivo',
        emoji: '',
        subtitle: 'Propenso al miedo a quedarse fuera de los movimientos (FOMO / Sin SL)',
        description: 'Tu velocidad de entrada es alta, pero te precipitas sin esperar confluencias o descuidando el Stop Loss por ansiedad.'
      };
    } else if (!isSuperPositive && dispositionRatio < 0.7 && lossAmounts.length >= 3 && netPnL < 0) {
      archetype = {
        title: 'Operador Cauteloso',
        emoji: '',
        subtitle: 'Corta ganancias antes de tiempo por miedo a perder',
        description: 'Te cuesta dejar correr los beneficios hasta el Take Profit, conformándote con pequeñas ganancias mientras asumes el Stop Loss completo.'
      };
    } else if (disciplineScore >= 80) {
      archetype = {
        title: 'Estratega Disciplinado',
        emoji: '',
        subtitle: 'Operador disciplinado con enfoque en proceso',
        description: 'Demuestras serenidad ante las fluctuaciones del mercado y mantienes tu plan de gestión de riesgo bajo control.'
      };
    }

    const biases = [
      {
        name: 'Trading por Venganza (Revenge)',
        severity: totalTrades > 0 ? Math.min(100, Math.round((revengeCount / totalTrades) * 100)) : 0,
        costUSD: revengeLoss,
        detected: revengeCount > 0 && revengeLoss > 0,
        tip: (revengeCount > 0 && revengeLoss > 0)
          ? 'Toma un receso de 20 minutos tras cualquier Stop Loss para enfriar las emociones.'
          : 'Excelente temple. Mantienes la calma y evitas represalias emocionales contra el mercado.'
      },
      {
        name: 'FOMO (Entradas Impulsivas / Sin SL)',
        severity: totalTrades > 0 ? Math.min(100, Math.round((fomoCount / totalTrades) * 100)) : 0,
        costUSD: fomoLoss,
        detected: fomoCount > 0 && fomoLoss > 0,
        tip: (fomoCount > 0 && fomoLoss > 0)
          ? 'Espera el retroceso del precio; nunca entres sin Stop Loss técnico.'
          : 'Cero entradas sin protección. Tu rigor con el Stop Loss es óptimo.'
      },
      {
        name: 'Efecto Disposición (Aversión al Riesgo)',
        severity: (isSuperPositive || lossAmounts.length <= 1) ? 0 : Math.min(100, Math.round(dispositionRatio < 1 ? (1 - dispositionRatio) * 100 : 10)),
        costUSD: 0,
        detected: (!isSuperPositive && lossAmounts.length >= 3 && dispositionRatio < 0.7),
        tip: (isSuperPositive || lossAmounts.length <= 1)
          ? 'Tus ratios son saludables y la cuenta avanza en terreno positivo. Deja correr tus Take Profits.'
          : 'Mantén los trades ganadores hasta sus objetivos técnicos o gestiona con trailing stop.'
      }
    ];

    const prescriptions = [];
    if (isSuperPositive) {
      prescriptions.push(`<strong>Edge Estadístico Comprobado:</strong> Tu sistema genera valor (+${netPnL.toFixed(2)} USD). La consistencia reside en no modificar las reglas cuando ganas.`);
      prescriptions.push(losingTrades <= 1 
        ? '<strong>Pérdidas como Costo Operativo:</strong> Tu pérdida individual es matemáticamente normal. En el trading profesional, tener un 10-25% de pérdidas es un estándar de élite institucional.'
        : '<strong>Preservación de Ganancias:</strong> Protege tus beneficios acumulados manteniendo el riesgo strictly &le; 2% por trade.');
      prescriptions.push('<strong>Enfoque en Proceso:</strong> Evalúa tu sesión por tu porcentaje de disciplina operativa. El dinero es la consecuencia natural de la maestría mental.');
    } else {
      if (revengeCount > 0) prescriptions.push('<strong>Regla del Enfriamiento:</strong> No abras una nueva operación en los 20 minutos posteriores a una pérdida.');
      if (fomoCount > 0) prescriptions.push('<strong>Filtro de Confluencias:</strong> Marca al menos 2 motivos técnicos en el checklist antes de entrar.');
      prescriptions.push('<strong>Aceptación Probabilística:</strong> Cada trade individual es solo una muestra estadística de tu estrategia a largo plazo.');
    }

    let summaryText = '';
    if (isSuperPositive) {
      summaryText = `Auditoría completada sobre <strong>${totalTrades}</strong> operaciones. Tu cuenta presenta una curva de capital fuertemente positiva (<strong>+$${netPnL.toFixed(2)} USD</strong>) con una efectividad del <strong>${winRate.toFixed(1)}%</strong>. ` +
        (losingTrades === 1 
          ? `La única pérdida registrada fue asumida con Stop Loss como un costo operativo natural de tu ventaja probabilística. ` 
          : `Tus pérdidas están rigurosamente contenidas dentro de tu plan de riesgo. `) +
        `Tu índice de disciplina mental es de <strong>${disciplineScore}/100</strong>. ` +
        (undisciplinedLoss === 0 
          ? `<strong>Cero fuga de capital por indisciplina</strong>: mantén esta serenidad de ejecución para consolidar tu consistencia a largo plazo.` 
          : `Se detectó una fuga menor de <strong>-$${undisciplinedLoss.toFixed(2)} USD</strong> en operaciones fuera de plan.`);
    } else {
      summaryText = `El análisis cuantitativo ha catalogado tu conducta operativa como <strong>"${archetype.title}"</strong> con un índice de disciplina del <strong>${disciplineScore}%</strong>. ` +
        (undisciplinedLoss > 0 ? `Se estima un costo por decisiones fuera de plan de <strong>-$${undisciplinedLoss.toFixed(2)} USD</strong>.` : '¡Mantienes un excelente autocontrol emocional y cero fuga de capital!');
    }

    this.aiPsychologyReport = {
      hasData: true,
      totalTrades,
      archetype,
      disciplineScore,
      biases,
      financialImpact: {
        undisciplinedLoss
      },
      prescriptions,
      aiSummary: summaryText
    };

    this.emotionStats = Object.values(stats).map((s: any) => ({
      ...s,
      winRate: (s.wins / s.count) * 100
    })).sort((a: any, b: any) => b.pnl - a.pnl);

    this.emotionConclusion = this.aiPsychologyReport.aiSummary;
    this.showEmotionAnalysis = true;
  }

  detectCurrentEmotion(): void {
    this.isDetectingEmotion = true;
    this.detectedEmotionFeedback = 'Analizando contexto operativo y técnico...';

    this.tradeService.detectEmotion({
      ...this.currentTrade,
      accountId: this.selectedAccountId
    }).subscribe({
      next: (res) => {
        this.isDetectingEmotion = false;
        if (res && res.emotion) {
          this.currentTrade.emotion_state = res.emotion;
          this.detectedEmotionFeedback = `Contexto (${res.confidence}% certeza): ${res.reason}`;
          this.toastService.info(`Emoción detectada: ${res.emotion}`);
        }
      },
      error: () => {
        this.isDetectingEmotion = false;
        this.runLocalEmotionDetection();
      }
    });
  }

  runLocalEmotionDetection(): void {
    const notesLower = (this.currentTrade.notes || '').toLowerCase();
    let detected = 'Calma';
    let reason = 'Plan técnico con riesgo prudente.';

    if (notesLower.includes('fomo') || notesLower.includes('escapa') || notesLower.includes('tarde') || notesLower.includes('apresurad')) {
      detected = 'FOMO';
      reason = 'Tus notas indican sensación de urgencia o miedo a perder el movimiento.';
    } else if (notesLower.includes('recuperar') || notesLower.includes('venganza') || notesLower.includes('rabia')) {
      detected = 'FOMO';
      reason = 'Señal de urgencia por recuperar una pérdida reciente.';
    } else if (notesLower.includes('miedo') || notesLower.includes('duda') || notesLower.includes('insegur')) {
      detected = 'Miedo';
      reason = 'Expresas cautela excesiva o inseguridad en la ejecución.';
    } else if (!this.currentTrade.stop_loss || this.currentTrade.stop_loss <= 0) {
      detected = 'FOMO';
      reason = 'Operación sin Stop Loss programado (impulso o negación del riesgo).';
    } else if (this.currentTrade.risk_percentage > 2.5) {
      detected = 'Codicia';
      reason = `Riesgo superior al 2.5% (${this.currentTrade.risk_percentage}%).`;
    } else if (this.currentTrade.confluences && this.currentTrade.confluences.split(',').length >= 2) {
      detected = 'Confianza';
      reason = 'Entrada planificada con múltiples confluencias técnicas.';
    }

    this.currentTrade.emotion_state = detected;
    this.detectedEmotionFeedback = `Análisis Heurístico: ${reason}`;
    this.toastService.info(`Emoción detectada: ${detected}`);
  }
  
  durations = ['1 min', '3 min', '5 min', '15 min', '30 min', '1 Hora', 'Otra'];
  tradingStyles = ['Scalping', 'Intraday', 'Swing', 'Position'];
  instrumentTypes = ['Acción al Contado (Spot)', 'CFDs', 'Opciones sobre Acciones'];
  
  marketAssets: { [key: string]: string[] } = {
    'Forex': [
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD', 
      'EUR/GBP', 'EUR/JPY', 'GBP/JPY', 'AUD/JPY', 'EUR/AUD', 'EUR/CHF', 'GBP/CHF',
      'AUD/CAD', 'CAD/JPY', 'NZD/JPY', 'CHF/JPY', 'EUR/NZD', 'EUR/CAD', 'AUD/NZD', 
      'AUD/CHF', 'CAD/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD', 'NZD/CAD', 'NZD/CHF',
      'USD/MXN', 'USD/ZAR', 'USD/TRY', 'USD/SEK', 'USD/NOK', 'USD/DKK', 'USD/SGD', 'USD/HKD', 'USD/CNH'
    ],
    'Cryptos': ['Cargando desde Binance...'], // Se llenará con la API
    'Futuros': [
      'S&P 500 (ES)', 'Micro S&P 500 (MES)',
      'Nasdaq 100 (NQ)', 'Micro Nasdaq 100 (MNQ)',
      'Dow Jones (YM)', 'Micro Dow Jones (MYM)',
      'Russell 2000 (RTY)', 'Micro Russell 2000 (M2K)',
      'Petróleo Crudo (CL)', 'Micro Petróleo (MCL)',
      'Oro (GC)', 'Micro Oro (MGC)',
      'Plata (SI)', 'Gas Natural (NG)',
      'Cobre (HG)', 'Bonos Tesoro 30A (ZB)',
      'Euro FX (6E)', 'Yen Japonés (6J)'
    ],
    'Acciones': [
      'AAPL (Apple)', 'MSFT (Microsoft)', 'AMZN (Amazon)', 'GOOGL (Alphabet)', 
      'TSLA (Tesla)', 'META (Meta)', 'NVDA (Nvidia)', 'NFLX (Netflix)', 
      'V (Visa)', 'JPM (JPMorgan)', 'WMT (Walmart)', 'MA (Mastercard)', 
      'DIS (Disney)', 'PYPL (PayPal)', 'AMD', 'INTC', 'BA (Boeing)', 'KO (Coca-Cola)'
    ],
    'Binarias': [
      'EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CHF', 'USD/CAD', 'NZD/USD',
      'EUR/JPY', 'EUR/GBP', 'GBP/JPY', 'AUD/JPY',
      'EUR/USD (OTC)', 'GBP/USD (OTC)', 'USD/JPY (OTC)', 'AUD/USD (OTC)', 'USD/CHF (OTC)',
      'USD/CAD (OTC)', 'NZD/USD (OTC)', 'EUR/JPY (OTC)', 'EUR/GBP (OTC)', 'GBP/JPY (OTC)'
    ]
  };

  currentTrade: any = this.getEmptyTrade();
  
  currentFilter: string = 'Todos';
  
  showDropdown = false;

  constructor(
    private tradeService: TradeService, 
    private accountService: AccountService,
    public toastService: ToastService,
    public store: TradingStoreService,
    private reportExportService: ReportExportService,
    private settingsService: SettingsService
  ) {}

  // --- ATAJOS DE TECLADO OPERATIVOS (QUICK LOG) ---
  @HostListener('window:keydown', ['$event'])
  handleKeyboardShortcuts(event: KeyboardEvent): void {
    const activeTag = (document.activeElement?.tagName || '').toUpperCase();
    const isInputActive = activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT';

    // [Esc]: Cerrar modales activos
    if (event.key === 'Escape') {
      if (this.activeDatePicker) { this.activeDatePicker = null; return; }
      if (this.activeScreenshotModal) { this.activeScreenshotModal = null; return; }
      if (this.showCsvModal) { this.showCsvModal = false; return; }
      if (this.showForm) { this.showForm = false; return; }
      if (this.showAccountForm) { this.showAccountForm = false; return; }
      if (this.showEmotionAnalysis) { this.showEmotionAnalysis = false; return; }
    }

    // [Ctrl+S] o [Cmd+S]: Guardar operación si el formulario de trade está abierto
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      if (this.showForm) {
        event.preventDefault();
        this.saveTrade();
        return;
      }
    }

    // [N] o [n]: Abrir modal de nueva operación cuando no se escribe en un input
    if ((event.key === 'n' || event.key === 'N') && !isInputActive && !event.ctrlKey && !event.altKey && !event.metaKey) {
      if (this.selectedAccountId && !this.showForm && !this.showCsvModal && !this.showAccountForm) {
        event.preventDefault();
        this.openAddForm();
      }
    }
  }

  // --- PAGINACIÓN EN BITÁCORA ---
  get paginatedTrades(): any[] {
    const list = this.filteredTrades;
    if (this.pageSize >= 999) return list;
    const start = (this.currentPage - 1) * this.pageSize;
    return list.slice(start, start + this.pageSize);
  }

  get totalPages(): number {
    if (this.pageSize >= 999) return 1;
    return Math.max(1, Math.ceil(this.filteredTrades.length / this.pageSize));
  }

  setPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }

  setPageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
  }

  // --- IMPORTADOR MASIVO CSV (MetaTrader 4/5, NinjaTrader, TradingView) ---
  openCsvModal(): void {
    this.showCsvModal = true;
    this.parsedCsvTrades = [];
    this.csvPreviewSnippet = [];
    this.csvFileName = '';
  }

  onCsvFileSelected(event: any): void {
    const file = event.target.files?.[0];
    if (!file) return;
    this.csvFileName = file.name;
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const text = e.target.result;
      this.parseCsvContent(text);
    };
    reader.readAsText(file);
  }

  parseCsvContent(csvText: string): void {
    try {
      const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      if (lines.length < 2) {
        this.toastService.error('El archivo CSV debe tener al menos una fila de encabezado y una de datos.');
        return;
      }

      const firstLine = lines[0];
      let delimiter = ',';
      if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';
      else if (firstLine.includes('\t')) delimiter = '\t';

      const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/['"]/g, ''));

      const findCol = (keywords: string[]) => {
        return headers.findIndex(h => keywords.some(k => h.includes(k)));
      };

      const dateIdx = findCol(['date', 'fecha', 'time', 'open time', 'hora']);
      const symbolIdx = findCol(['symbol', 'asset', 'activo', 'par', 'item', 'ticker', 'instrument']);
      const typeIdx = findCol(['type', 'tipo', 'action', 'direccion', 'cmd', 'side']);
      const volIdx = findCol(['volume', 'volumen', 'size', 'lot', 'lote', 'shares', 'contracts', 'contratos']);
      const entryIdx = findCol(['open price', 'entry', 'precio entrada', 'precio', 'price']);
      const exitIdx = findCol(['close price', 'exit', 'precio salida', 'cierre']);
      const slIdx = findCol(['sl', 'stop loss', 'stoploss', 'stop']);
      const tpIdx = findCol(['tp', 'take profit', 'takeprofit']);
      const pnlIdx = findCol(['profit', 'pnl', 'beneficio', 'ganancia', 'resultado', 'net profit']);
      const emoIdx = findCol(['emotion', 'emocion', 'estado']);
      const notesIdx = findCol(['comment', 'notes', 'notas', 'comentario']);

      const parsed: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(delimiter).map(c => c.trim().replace(/^["']|["']$/g, ''));
        if (row.length < 2) continue;

        const asset = symbolIdx !== -1 && row[symbolIdx] ? row[symbolIdx].toUpperCase() : 'EUR/USD';
        const rawType = typeIdx !== -1 && row[typeIdx] ? row[typeIdx].toUpperCase() : 'BUY';
        const tradeType = (rawType.includes('SELL') || rawType.includes('SHORT')) ? 'SHORT' : 'LONG';
        const volume = volIdx !== -1 && row[volIdx] ? parseFloat(row[volIdx].replace(',', '.')) : 1;
        const entry = entryIdx !== -1 && row[entryIdx] ? parseFloat(row[entryIdx].replace(',', '.')) : null;
        const exit = exitIdx !== -1 && row[exitIdx] ? parseFloat(row[exitIdx].replace(',', '.')) : null;
        const sl = slIdx !== -1 && row[slIdx] ? parseFloat(row[slIdx].replace(',', '.')) : null;
        const tp = tpIdx !== -1 && row[tpIdx] ? parseFloat(row[tpIdx].replace(',', '.')) : null;
        let pnl = pnlIdx !== -1 && row[pnlIdx] ? parseFloat(row[pnlIdx].replace(',', '.')) : null;
        const emo = emoIdx !== -1 && row[emoIdx] ? row[emoIdx] : (!sl ? 'FOMO' : 'Calma');
        const dateVal = dateIdx !== -1 && row[dateIdx] ? row[dateIdx] : new Date().toISOString();
        const notes = notesIdx !== -1 && row[notesIdx] ? row[notesIdx] : 'Importado vía extracto CSV';

        let market = this.selectedAccount?.market_type || 'General';
        if (market === 'General') {
          if (asset.includes('/') && (asset.includes('USD') || asset.includes('EUR') || asset.includes('JPY') || asset.includes('GBP'))) market = 'Forex';
          else if (asset.includes('BTC') || asset.includes('ETH') || asset.includes('SOL')) market = 'Cryptos';
          else if (asset.includes('ES') || asset.includes('NQ') || asset.includes('CL') || asset.includes('GC')) market = 'Futuros';
          else market = 'Forex';
        }

        if ((pnl === null || isNaN(pnl)) && entry !== null && exit !== null) {
          pnl = this.calculatePnLInUSD(entry, exit, volume, market, asset, tradeType);
        }

        parsed.push({
          asset,
          trade_type: tradeType,
          market_type: market,
          volume: isNaN(volume) || volume <= 0 ? 1 : volume,
          entry_price: isNaN(entry as number) ? null : entry,
          exit_price: isNaN(exit as number) ? null : exit,
          stop_loss: isNaN(sl as number) ? null : sl,
          take_profit: isNaN(tp as number) ? null : tp,
          pnl: isNaN(pnl as number) ? null : pnl,
          emotion_state: emo,
          notes,
          createdAt: dateVal
        });
      }

      this.parsedCsvTrades = parsed;
      this.csvPreviewSnippet = parsed.slice(0, 5);
      this.toastService.success(`Archivo procesado: ${parsed.length} operaciones detectadas.`);
    } catch (err) {
      console.error('Error parseando CSV:', err);
      this.toastService.error('Error al analizar formato del archivo CSV.');
    }
  }

  confirmCsvImport(): void {
    if (!this.selectedAccountId) {
      this.toastService.error('Selecciona una cuenta antes de importar.');
      return;
    }
    if (this.parsedCsvTrades.length === 0) {
      this.toastService.error('No hay operaciones válidas para importar.');
      return;
    }

    this.isImportingCsv = true;
    this.tradeService.importCSV(this.selectedAccountId, this.parsedCsvTrades).subscribe({
      next: (res) => {
        this.isImportingCsv = false;
        this.showCsvModal = false;
        this.toastService.success(`${res.count || this.parsedCsvTrades.length} operaciones importadas con éxito.`);
        this.loadTrades();
      },
      error: (err) => {
        this.isImportingCsv = false;
        console.error('Error importando CSV:', err);
        this.toastService.error('Error en el servidor al importar operaciones.');
      }
    });
  }

  // --- INFORMES EJECUTIVOS REALES (PDF & EXCEL XLSX) ---
  exportPdfReport(): void {
    if (!this.selectedAccount) return;
    this.toastService.info('Generando informe ejecutivo formal en PDF con jsPDF...');
    this.tradeService.getQuantitativeAnalysis(this.selectedAccountId!).subscribe({
      next: (quantData) => {
        this.tradeService.getPsychologicalAnalysis(this.selectedAccountId!).subscribe({
          next: (psychData) => {
            this.reportExportService.exportExecutivePdf({
              account: this.selectedAccount,
              metrics: {
                initialCapital: this.accountBalance,
                currentCapital: this.currentBalance,
                totalPnL: this.totalPnL,
                roiPercentage: this.accountBalance > 0 ? ((this.totalPnL / this.accountBalance) * 100).toFixed(2) : '0.00',
                winRate: psychData.tradesSummary?.winRate || '0.00',
                profitFactor: psychData.tradesSummary?.profitFactor || '0.00',
                maxDrawdown: '0.00'
              },
              quantitative: quantData,
              psychology: psychData,
              trades: this.trades
            });
            this.toastService.success('Informe ejecutivo PDF descargado correctamente.');
          },
          error: () => this.toastService.error('Error al compilar auditoría psicológica para PDF.')
        });
      },
      error: () => this.toastService.error('Error al compilar métricas cuantitativas para PDF.')
    });
  }

  exportExcelReport(): void {
    if (!this.selectedAccount) return;
    this.toastService.info('Generando libro de cálculo estructurado en Excel (.xlsx)...');
    this.tradeService.getQuantitativeAnalysis(this.selectedAccountId!).subscribe({
      next: (quantData) => {
        this.tradeService.getPsychologicalAnalysis(this.selectedAccountId!).subscribe({
          next: (psychData) => {
            this.reportExportService.exportStructuredExcel({
              account: this.selectedAccount,
              metrics: {
                initialCapital: this.accountBalance,
                currentCapital: this.currentBalance,
                totalPnL: this.totalPnL,
                roiPercentage: this.accountBalance > 0 ? ((this.totalPnL / this.accountBalance) * 100).toFixed(2) : 0,
                winRate: psychData.tradesSummary?.winRate || 0,
                profitFactor: psychData.tradesSummary?.profitFactor || 0,
                maxDrawdown: 0
              },
              quantitative: quantData,
              psychology: psychData,
              trades: this.trades
            });
            this.toastService.success('Archivo Excel descargado con éxito.');
          },
          error: () => this.toastService.error('Error al generar Excel.')
        });
      },
      error: () => this.toastService.error('Error al compilar datos para Excel.')
    });
  }

  ngOnInit(): void {
    this.settingsService.settings$.subscribe(settings => {
      this.isPrivacyMode = settings.privacyMode;
    });
    this.loadAccounts();
    this.fetchBinanceCryptos();
    this.loadTradingViewScript();
    this.loadLiveFxRates();
  }

  loadLiveFxRates(): void {
    this.tradeService.getFxRates().subscribe({
      next: (rates) => {
        if (rates && typeof rates === 'object') {
          this.liveFxRates = { ...this.liveFxRates, ...rates };
          if (this.currentTrade?.entry_price && this.currentTrade?.stop_loss) {
            this.onRiskOrPriceChange();
          }
        }
      },
      error: (err) => console.warn('Could not refresh live FX rates, using standard current rates:', err)
    });
  }

  loadAccounts(): void {
    this.isLoading = true;
    this.accountService.getAccounts().subscribe({
      next: (data) => {
        this.accounts = data || [];
        if (this.accounts.length > 0) {
          let match = null;
          if (this.selectedAccountId) {
            match = this.accounts.find(a => a.id_account == this.selectedAccountId);
          }
          if (!match) {
            match = this.accounts.find(a => a.is_default) || this.accounts[0];
          }
          this.selectedAccount = match;
          this.selectedAccountId = this.selectedAccount.id_account;
          this.loadTrades();
        } else {
          this.selectedAccountId = null;
          this.selectedAccount = null;
          this.trades = [];
          this.filteredTrades = [];
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error('Error fetching accounts', err);
        this.isLoading = false;
      }
    });
  }

  onAccountChange(event: any): void {
    this.selectedAccountId = parseInt(event.target.value, 10);
    this.selectedAccount = this.accounts.find(a => a.id_account === this.selectedAccountId);
    this.loadTrades();
  }

  openAccountForm(edit: boolean = false): void {
    this.isEditingAccount = edit;
    if (edit && this.selectedAccount) {
      this.accountForm = { 
        name: this.selectedAccount.name || '',
        market_type: this.selectedAccount.market_type || 'General',
        balance: this.selectedAccount.balance !== undefined ? this.selectedAccount.balance : 10000,
        is_default: !!this.selectedAccount.is_default
      };
    } else {
      this.accountForm = { 
        name: '', 
        market_type: 'General', 
        balance: 10000,
        is_default: this.accounts.length === 0
      };
    }
    this.showAccountForm = true;
  }

  saveAccount(): void {
    if (this.isEditingAccount && this.selectedAccount) {
      this.accountService.updateAccount(this.selectedAccount.id_account, this.accountForm).subscribe({
        next: (updated) => {
          this.showAccountForm = false;
          this.toastService.success('Cuenta y configuración actualizadas correctamente.');
          if (updated && updated.id_account) {
            this.selectedAccountId = updated.id_account;
          }
          this.loadAccounts();
        },
        error: (err) => {
          console.error(err);
          this.toastService.error('Error al actualizar la cuenta.');
        }
      });
    } else {
      this.accountService.addAccount(this.accountForm).subscribe({
        next: (newAccount) => {
          this.showAccountForm = false;
          this.selectedAccountId = newAccount.id_account;
          this.toastService.success('Cuenta creada exitosamente.');
          this.loadAccounts();
        },
        error: (err) => {
          console.error(err);
          this.toastService.error('Error al crear la cuenta.');
        }
      });
    }
  }

  setAsDefaultAccount(account: any, event?: Event): void {
    if (event) event.stopPropagation();
    if (!account || account.is_default) return;

    this.accountService.setDefaultAccount(account.id_account).subscribe({
      next: () => {
        this.toastService.success(`"${account.name}" establecida como cuenta principal.`);
        this.selectedAccountId = account.id_account;
        this.loadAccounts();
      },
      error: (err) => {
        console.error(err);
        this.toastService.error('Error al establecer cuenta principal.');
      }
    });
  }

  loadTradingViewScript() {
    if (document.getElementById('tradingview-script')) {
      return;
    }
    const script = document.createElement('script');
    script.id = 'tradingview-script';
    script.src = 'https://s3.tradingview.com/tv.js';
    script.async = true;
    document.body.appendChild(script);
  }

  async fetchBinanceCryptos() {
    try {
      const response = await fetch('https://api.binance.com/api/v3/exchangeInfo');
      const data = await response.json();
      // Filtrar pares activos que cotizan contra USDT
      const cryptos = data.symbols
        .filter((s: any) => s.status === 'TRADING' && s.quoteAsset === 'USDT')
        .map((s: any) => s.symbol.replace('USDT', '/USDT'));
      
      this.marketAssets['Cryptos'] = cryptos;
      
      // Si el usuario tiene abierto el formulario en cryptos, actualizamos el valor por defecto si estaba vacío
      if (this.currentTrade.market_type === 'Cryptos' && this.currentTrade.asset === 'Cargando desde Binance...') {
        this.currentTrade.asset = '';
      }
    } catch (error) {
      console.error('Error al conectar con Binance:', error);
      this.marketAssets['Cryptos'] = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT', 'ADA/USDT'];
    }
  }

  getEmptyTrade() {
    const market = this.availableMarkets.includes('Cryptos') ? 'Cryptos' : this.availableMarkets[0];
    const defaults: any = {
      'Forex': 'EUR/USD',
      'Cryptos': 'BTC/USDT',
      'Futuros': 'S&P 500 (ES)',
      'Acciones': 'AAPL (Apple)',
      'Binarias': 'EUR/USD'
    };
    return {
      entry_price: null,
      exit_price: null,
      volume: market === 'Binarias' ? 1.0 : null,
      emotion_state: 'Calma',
      trade_type: 'LONG',
      market_type: market,
      status: 'Abierta',
      asset: defaults[market] || '',
      duration: market === 'Binarias' ? '1 min' : null,
      trading_style: (market !== 'Binarias' && market !== 'Acciones') ? (this.tradingStyles[0] || 'Day Trading') : null,
      instrument_type: market === 'Acciones' ? (this.instrumentTypes[0] || 'Acciones Contado') : null,
      stop_loss: null,
      take_profit: null,
      risk_percentage: 1, // Riesgo del 1% por defecto
      payout_percentage: 85, // Retorno 85% por defecto para Binarias
      pnl: null,
      screenshot: null,
      confluences: '',
      notes: '',
      entry_date: this.formatDateTimeForInput(new Date()),
      exit_date: null
    };
  }

  onMarketChange(): void {
    const defaults: any = {
      'Forex': 'EUR/USD',
      'Cryptos': 'BTC/USDT',
      'Futuros': 'S&P 500 (ES)',
      'Acciones': 'AAPL (Apple)',
      'Binarias': 'EUR/USD'
    };
    
    // Al cambiar de mercado, ponemos un activo por defecto
    this.currentTrade.asset = defaults[this.currentTrade.market_type] || '';
    
    // Reseteamos también los campos condicionales con valores por defecto
    this.currentTrade.duration = this.currentTrade.market_type === 'Binarias' ? '1 min' : null;
    this.currentTrade.trading_style = (this.currentTrade.market_type !== 'Binarias' && this.currentTrade.market_type !== 'Acciones') ? (this.tradingStyles[0] || 'Day Trading') : null;
    this.currentTrade.instrument_type = this.currentTrade.market_type === 'Acciones' ? (this.instrumentTypes[0] || 'Acciones Contado') : null;
    this.showDropdown = false;

    if (this.currentTrade.market_type === 'Binarias') {
      this.currentTrade.stop_loss = null;
      this.currentTrade.take_profit = null;
      this.currentTrade.payout_percentage = 85;
      if (!this.currentTrade.risk_percentage) {
        this.currentTrade.risk_percentage = 1.0;
      }
      const initialVol = this.riskAmount;
      this.currentTrade.volume = initialVol > 0 ? parseFloat(initialVol.toFixed(2)) : 1.0;
    }
    
    this.renderChart(this.currentTrade.asset);
    this.fetchCurrentPrice(this.currentTrade.asset, this.currentTrade.market_type, 'entry_price', false);
    this.onRiskOrPriceChange();
  }

  get filteredAssetOptions(): string[] {
    const assets = this.marketAssets[this.currentTrade.market_type] || [];
    if (!this.currentTrade.asset) return assets;
    const search = this.currentTrade.asset.toLowerCase();
    return assets.filter(a => a.toLowerCase().includes(search));
  }

  hideDropdown(): void {
    // Retraso para permitir que el mousedown de la lista se dispare primero
    setTimeout(() => {
      this.showDropdown = false;
    }, 150);
  }

  selectAsset(asset: string): void {
    this.currentTrade.asset = asset;
    this.showDropdown = false;
    this.renderChart(asset);
    this.fetchCurrentPrice(asset, this.currentTrade.market_type, 'entry_price', false);
    this.onRiskOrPriceChange();
  }

  async fetchCurrentPrice(
    asset: string, 
    market: string, 
    targetField: 'entry_price' | 'exit_price' = 'entry_price', 
    isManualClick = false
  ): Promise<void> {
    if (!asset || asset.trim() === '') {
      if (isManualClick) {
        this.toastService.warning('Por favor ingresa o selecciona un activo primero (ej. BTC/USDT, EUR/USD).');
      }
      return;
    }

    if (targetField === 'entry_price') {
      this.isFetchingEntryPrice = true;
    } else {
      this.isFetchingExitPrice = true;
    }
    
    try {
      let currentPrice: number | null = null;
      let cleanAsset = asset.split(' (')[0].trim();

      // 1. Para Cryptos, intentar primero Binance directo (latencia mínima)
      if (market === 'Cryptos') {
        let pair = cleanAsset.replace('/', '').toUpperCase();
        if (!pair.endsWith('USDT') && !pair.endsWith('BUSD') && !pair.endsWith('USD')) {
          pair += 'USDT';
        }
        try {
          const binanceRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
          if (binanceRes.ok) {
            const data = await binanceRes.json();
            if (data.price) currentPrice = parseFloat(data.price);
          }
        } catch (e) {
          console.warn('Binance directo no disponible, usando proxy backend:', e);
        }
      }

      // 2. Para Forex y Binarias, consultar directamente TradingView Scanner (misma fuente y precisión exacta del gráfico)
      if (currentPrice === null && (market === 'Forex' || market === 'Binarias')) {
        try {
          const clean = cleanAsset.replace('(OTC)', '').trim().replace('/', '').toUpperCase();
          const tvRes = await fetch('https://scanner.tradingview.com/forex/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              symbols: { tickers: [`FX:${clean}`, `FX_IDC:${clean}`, `OANDA:${clean}`] },
              columns: ['close']
            })
          });
          if (tvRes.ok) {
            const tvData = await tvRes.json();
            if (tvData.data && tvData.data.length > 0 && tvData.data[0].d?.[0]) {
              currentPrice = parseFloat(tvData.data[0].d[0]);
            }
          }
        } catch (e) {
          console.warn('TradingView directo en navegador no disponible, usando proxy backend:', e);
        }
      }

      // 3. Si no se obtuvo precio aún, usar backend proxy (que consulta TradingView y tiene respaldo en Yahoo)
      if (currentPrice === null) {
        const backendUrl = 'http://localhost:3000/api/price';
        const response = await fetch(`${backendUrl}?symbol=${encodeURIComponent(asset)}&market=${encodeURIComponent(market)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.price !== undefined && data.price !== null) {
            currentPrice = parseFloat(data.price);
          }
        }
      }

      if (currentPrice !== null && !isNaN(currentPrice)) {
        this.currentTrade[targetField] = currentPrice;
        this.onRiskOrPriceChange();
        if (isManualClick) {
          const fieldLabel = targetField === 'entry_price' ? 'Entrada' : 'Salida';
          this.toastService.success(`Precio de ${fieldLabel} actualizado: $${currentPrice}`);
        }
      } else {
        if (isManualClick) {
          this.toastService.error(`No se pudo obtener el precio en vivo para "${asset}". Revisa el símbolo o ingrésalo manualmente.`);
        }
      }
    } catch (error) {
      console.error('Error fetching live price:', error);
      if (isManualClick) {
        this.toastService.error('Error de conexión al obtener cotización en vivo.');
      }
    } finally {
      if (targetField === 'entry_price') {
        this.isFetchingEntryPrice = false;
      } else {
        this.isFetchingExitPrice = false;
      }
    }
  }



  formatSymbolForTV(asset: string, market: string): string {
    if (!asset) return 'BINANCE:BTCUSDT';
    
    // Limpiar nombres (ej. "AAPL (Apple)" -> "AAPL")
    let cleanAsset = asset.split(' (')[0].trim();

    if (market === 'Cryptos') {
      const pair = cleanAsset.replace('/', '').toUpperCase();
      return 'BINANCE:' + (pair.includes('USDT') ? pair : pair + 'USDT');
    } else if (market === 'Forex') {
      return 'FX:' + cleanAsset.replace('/', '').toUpperCase();
    } else if (market === 'Binarias') {
      const cleanFx = cleanAsset.replace('(OTC)', '').trim().replace('/', '').toUpperCase();
      return 'FX:' + cleanFx;
    } else if (market === 'Acciones') {
      return cleanAsset.toUpperCase(); 
    } else if (market === 'Futuros') {
      const upper = (asset || '').toUpperCase().trim();
      
      // S&P 500 (E-mini ES y Micro MES) -> US500 continuo
      if (upper.includes('MES') || upper.includes('(ES)') || upper.includes('S&P') || upper.includes('ES1!')) {
        return 'CAPITALCOM:US500';
      }
      // Nasdaq 100 (E-mini NQ y Micro MNQ) -> US100 continuo
      if (upper.includes('MNQ') || upper.includes('(NQ)') || upper.includes('NASDAQ') || upper.includes('NQ1!')) {
        return 'CAPITALCOM:US100';
      }
      // Dow Jones (E-mini YM y Micro MYM) -> US30 continuo
      if (upper.includes('MYM') || upper.includes('(YM)') || upper.includes('DOW') || upper.includes('YM1!')) {
        return 'CAPITALCOM:US30';
      }
      // Russell 2000 (E-mini RTY y Micro M2K) -> US2000 continuo
      if (upper.includes('M2K') || upper.includes('(RTY)') || upper.includes('RUSSELL') || upper.includes('RTY1!')) {
        return 'CAPITALCOM:US2000';
      }
      // Petróleo Crudo WTI (CL y Micro MCL) -> USOIL oficial TVC continuo
      if (upper.includes('MCL') || upper.includes('(CL)') || upper.includes('PETR') || upper.includes('CL1!') || upper.includes('USOIL') || upper.includes('OIL')) {
        return 'TVC:USOIL';
      }
      // Oro (GC y Micro MGC) -> GOLD oficial TVC continuo
      if (upper.includes('MGC') || upper.includes('(GC)') || upper.includes('ORO') || upper.includes('GOLD') || upper.includes('GC1!')) {
        return 'TVC:GOLD';
      }
      // Plata (SI) -> SILVER oficial TVC continuo
      if (upper.includes('(SI)') || upper.includes('PLATA') || upper.includes('SILVER') || upper.includes('SI1!')) {
        return 'TVC:SILVER';
      }
      // Gas Natural (NG) -> NATURALGAS continuo
      if (upper.includes('(NG)') || upper.includes('GAS') || upper.includes('NATGAS') || upper.includes('NG1!')) {
        return 'CAPITALCOM:NATURALGAS';
      }
      // Cobre (HG) -> Cobre XCUUSD continuo
      if (upper.includes('(HG)') || upper.includes('COBRE') || upper.includes('COPPER') || upper.includes('HG1!')) {
        return 'CAPITALCOM:XCUUSD';
      }
      // Bonos del Tesoro 30 Años (ZB) -> TLT (iShares 20+ Year Treasury Bond)
      if (upper.includes('(ZB)') || upper.includes('BONOS') || upper.includes('TREASURY') || upper.includes('ZB1!')) {
        return 'NASDAQ:TLT';
      }
      // Euro FX (6E) -> EUR/USD
      if (upper.includes('(6E)') || upper.includes('EURO FX') || upper.includes('6E1!')) {
        return 'FX:EURUSD';
      }
      // Yen Japonés FX (6J) -> USD/JPY
      if (upper.includes('(6J)') || upper.includes('YEN') || upper.includes('6J1!')) {
        return 'FX:USDJPY';
      }

      // Si tiene ticker entre paréntesis
      const match = asset.match(/\(([^)]+)\)/);
      if (match) {
        const t = match[1].toUpperCase().trim();
        if (t === 'ES' || t === 'MES') return 'CAPITALCOM:US500';
        if (t === 'NQ' || t === 'MNQ') return 'CAPITALCOM:US100';
        if (t === 'YM' || t === 'MYM') return 'CAPITALCOM:US30';
        if (t === 'RTY' || t === 'M2K') return 'CAPITALCOM:US2000';
        if (t === 'CL' || t === 'MCL') return 'TVC:USOIL';
        if (t === 'GC' || t === 'MGC') return 'TVC:GOLD';
        if (t === 'SI') return 'TVC:SILVER';
        if (t === 'NG') return 'CAPITALCOM:NATURALGAS';
        if (t === 'HG') return 'CAPITALCOM:XCUUSD';
        if (t === 'ZB') return 'NASDAQ:TLT';
        if (t === '6E') return 'FX:EURUSD';
        if (t === '6J') return 'FX:USDJPY';
      }

      return 'CAPITALCOM:US500';
    }
    return cleanAsset;
  }

  renderChart(asset: string, retryCount = 0): void {
    if (!asset) return;
    
    setTimeout(() => {
      if (typeof (window as any).TradingView === 'undefined') {
        if (retryCount < 6) {
          this.renderChart(asset, retryCount + 1);
        }
        return;
      }

      const container = document.getElementById('tradingview_chart');
      if (container) {
        container.innerHTML = '';
      }

      const tvSymbol = this.formatSymbolForTV(asset, this.currentTrade.market_type);
      
      // Determinar rango e intervalo dinámico según la fecha exacta de la operación
      let chartRange: string | undefined = undefined;
      let chartInterval = "15";
      if (this.currentTrade?.entry_date) {
        const tradeTime = new Date(this.currentTrade.entry_date).getTime();
        if (!isNaN(tradeTime)) {
          const daysAgo = Math.max(0, (Date.now() - tradeTime) / (1000 * 60 * 60 * 24));
          if (daysAgo > 365) {
            chartRange = "ALL";
            chartInterval = "D";
          } else if (daysAgo > 180) {
            chartRange = "12M";
            chartInterval = "D";
          } else if (daysAgo > 90) {
            chartRange = "6M";
            chartInterval = "240";
          } else if (daysAgo > 30) {
            chartRange = "3M";
            chartInterval = "60";
          } else if (daysAgo > 7) {
            chartRange = "1M";
            chartInterval = "30";
          } else if (daysAgo > 1) {
            chartRange = "5D";
            chartInterval = "15";
          } else {
            chartRange = "1D";
            chartInterval = "5";
          }
        }
      }

      const widgetConfig: any = {
        "width": "100%",
        "height": 450,
        "symbol": tvSymbol,
        "interval": chartInterval,
        "timezone": "America/New_York",
        "theme": "dark",
        "style": "1",
        "locale": "es",
        "enable_publishing": false,
        "allow_symbol_change": true,
        "backgroundColor": "#1a1f2e",
        "gridColor": "#2a3142",
        "hide_top_toolbar": false,
        "hide_side_toolbar": false, // Activa barra lateral con Long/Short Position y líneas
        "withdateranges": true,
        "hide_legend": false,
        "save_image": false,
        "container_id": "tradingview_chart"
      };

      if (chartRange) {
        widgetConfig["range"] = chartRange;
      }

      try {
        new (window as any).TradingView.widget(widgetConfig);
      } catch (err) {
        console.error('Error instantiating TradingView widget:', err);
      }
    }, 200);
  }

  loadTrades(): void {
    if (!this.selectedAccountId) {
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.tradeService.getTrades(this.selectedAccountId).subscribe({
      next: (data) => {
        // Ordenar cronológicamente descendente por fecha de operación
        this.trades = (data || []).sort((a: any, b: any) => 
          new Date(b.entry_date || b.createdAt).getTime() - new Date(a.entry_date || a.createdAt).getTime()
        );
        this.applyFilter(this.currentFilter);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching trades', err);
        this.isLoading = false;
      }
    });
  }

  applyFilter(filter: string): void {
    this.currentFilter = filter;
    if (filter === 'Todos') {
      this.filteredTrades = [...this.trades];
    } else {
      this.filteredTrades = this.trades.filter(trade => trade.market_type === filter);
    }
  }

  openAddForm(): void {
    this.isEditing = false;
    this.currentTrade = this.getEmptyTrade();
    this.currentTrade.entry_date = this.formatDateTimeForInput(new Date());
    this.currentTrade.exit_date = null;
    if (this.currentTrade.market_type === 'Binarias') {
      this.currentTrade.stop_loss = null;
      this.currentTrade.take_profit = null;
      this.currentTrade.payout_percentage = 85;
      this.currentTrade.risk_percentage = 1.0;
      const initialVol = this.riskAmount;
      this.currentTrade.volume = initialVol > 0 ? parseFloat(initialVol.toFixed(2)) : 1.0;
    }
    this.showForm = true;
    this.renderChart(this.currentTrade.asset);
    this.fetchCurrentPrice(this.currentTrade.asset, this.currentTrade.market_type, 'entry_price', false);
    setTimeout(() => {
      document.getElementById('tradeFormCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  openEditForm(trade: any): void {
    this.isEditing = true;
    this.currentTrade = { ...trade };
    this.currentTrade.entry_date = this.formatDateTimeForInput(trade.entry_date || trade.createdAt) || this.formatDateTimeForInput(new Date());
    this.currentTrade.exit_date = this.formatDateTimeForInput(trade.exit_date);
    if (!this.currentTrade.trading_style && this.tradingStyles.length > 0) {
      this.currentTrade.trading_style = this.tradingStyles[0];
    }
    if (!this.currentTrade.instrument_type && this.instrumentTypes.length > 0) {
      this.currentTrade.instrument_type = this.instrumentTypes[0];
    }
    if (this.currentTrade.market_type === 'Binarias') {
      if (!this.currentTrade.payout_percentage) {
        this.currentTrade.payout_percentage = 85;
      }
      if (!this.currentTrade.duration && this.durations.length > 0) {
        this.currentTrade.duration = this.durations[0];
      }
      this.currentTrade.stop_loss = null;
      this.currentTrade.take_profit = null;
    }
    this.showForm = true;
    this.renderChart(this.currentTrade.asset);
    setTimeout(() => {
      document.getElementById('tradeFormCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  cancelForm(): void {
    this.showForm = false;
    this.currentTrade = this.getEmptyTrade();
  }

  toggleConfluence(tag: string): void {
    const current = this.currentTrade.confluences ? this.currentTrade.confluences.split(',').map((s: string) => s.trim()).filter((s: string) => s.length > 0) : [];
    const idx = current.indexOf(tag);
    if (idx > -1) {
      current.splice(idx, 1);
    } else {
      current.push(tag);
    }
    this.currentTrade.confluences = current.join(', ');
  }

  hasConfluence(tag: string): boolean {
    if (!this.currentTrade.confluences) return false;
    return this.currentTrade.confluences.split(',').map((s: string) => s.trim()).includes(tag);
  }

  getConfluencesArray(confluencesStr?: string): string[] {
    if (!confluencesStr) return [];
    return confluencesStr.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }

  getEmotionClass(emotion?: string): string {
    if (!emotion) return 'emotion-default';
    switch (emotion.toLowerCase().trim()) {
      case 'calma':
      case 'disciplina':
        return 'emotion-calma';
      case 'fomo':
      case 'venganza':
        return 'emotion-fomo';
      case 'miedo':
      case 'ansiedad':
        return 'emotion-miedo';
      case 'euforia':
      case 'codicia':
        return 'emotion-euforia';
      default:
        return 'emotion-default';
    }
  }

  setRisk(pct: number): void {
    this.currentTrade.risk_percentage = pct;
    this.onRiskOrPriceChange();
  }

  get riskLevel(): 'low' | 'moderate' | 'high' {
    const r = this.currentTrade.risk_percentage || 0;
    if (r <= 1.5) return 'low';
    if (r <= 2.5) return 'moderate';
    return 'high';
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        this.currentTrade.screenshot = reader.result as string;
        this.toastService.success('Captura de pantalla adjuntada');
      };
      reader.readAsDataURL(file);
    }
  }

  onPasteImage(event: ClipboardEvent): void {
    const items = event.clipboardData?.items;
    if (items) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            const reader = new FileReader();
            reader.onload = () => {
              this.currentTrade.screenshot = reader.result as string;
              this.toastService.success('¡Imagen pegada desde el portapapeles!');
            };
            reader.readAsDataURL(blob);
            event.preventDefault();
            break;
          }
        }
      }
    }
  }

  removeScreenshot(): void {
    this.currentTrade.screenshot = null;
    this.toastService.info('Captura eliminada');
  }

  openScreenshot(imgUrl: string): void {
    this.activeScreenshotModal = imgUrl;
  }

  exportToCSV(): void {
    if (!this.filteredTrades || this.filteredTrades.length === 0) {
      this.toastService.warning('No hay operaciones para exportar en esta vista');
      return;
    }

    const headers = ['ID', 'Fecha Entrada', 'Fecha Salida', 'Mercado', 'Activo', 'Tipo', 'Estado', 'Volumen', 'Precio Entrada', 'Precio Salida', 'Stop Loss', 'Take Profit', 'PnL ($)', 'Emocion', 'Confluencias', 'Notas'];
    const rows = this.filteredTrades.map(t => [
      t.id_trade,
      t.entry_date ? new Date(t.entry_date).toLocaleString() : (t.createdAt ? new Date(t.createdAt).toLocaleString() : ''),
      t.exit_date ? new Date(t.exit_date).toLocaleString() : 'Abierta',
      `"${t.market_type || ''}"`,
      `"${t.asset || ''}"`,
      t.trade_type || '',
      t.status || '',
      t.volume || '',
      t.entry_price || '',
      t.exit_price || '',
      t.stop_loss || '',
      t.take_profit || '',
      t.pnl !== null ? t.pnl : '',
      `"${t.emotion_state || ''}"`,
      `"${t.confluences || ''}"`,
      `"${(t.notes || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const accName = this.selectedAccount ? this.selectedAccount.name.replace(/\s+/g, '_') : 'portfolio';
    link.setAttribute('download', `bitacora_trading_${accName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    this.toastService.success('Bitácora exportada a CSV exitosamente');
  }

  printReport(): void {
    this.toastService.info('Generando informe ejecutivo de trading...');
    setTimeout(() => {
      window.print();
    }, 300);
  }

  saveTrade(): void {
    this.currentTrade.accountId = this.selectedAccountId;
    if (this.currentTrade.market_type === 'Binarias') {
      this.currentTrade.stop_loss = null;
      this.currentTrade.take_profit = null;
      if (!this.currentTrade.payout_percentage) {
        this.currentTrade.payout_percentage = 85;
      }
      if (!this.currentTrade.volume || this.currentTrade.volume <= 0) {
        this.currentTrade.volume = 1.0;
      }
    }
    if (this.currentTrade.entry_price != null && this.currentTrade.exit_price != null) {
      this.autoCalculatePnL();
    }
    if (this.isEditing) {
      this.tradeService.updateTrade(this.currentTrade.id_trade, this.currentTrade).subscribe({
        next: () => {
          this.loadTrades();
          this.showForm = false;
          this.toastService.success('Operación actualizada con éxito');
        },
        error: (err) => {
          console.error('Error updating trade', err);
          this.toastService.error('Error al actualizar operación');
        }
      });
    } else {
      this.tradeService.addTrade(this.currentTrade).subscribe({
        next: () => {
          this.loadTrades();
          this.showForm = false;
          this.toastService.success('¡Operación registrada con éxito en tu bitácora!');
        },
        error: (err) => {
          console.error('Error adding trade', err);
          this.toastService.error('Error al registrar operación');
        }
      });
    }
  }

  deleteTrade(id: number): void {
    if (confirm('¿Estás seguro de que deseas eliminar este registro?')) {
      this.tradeService.deleteTrade(id).subscribe({
        next: () => {
          this.loadTrades();
          this.toastService.info('Operación eliminada de la bitácora');
        },
        error: (err) => {
          console.error('Error deleting trade', err);
          this.toastService.error('Error al eliminar operación');
        }
      });
    }
  }
}
