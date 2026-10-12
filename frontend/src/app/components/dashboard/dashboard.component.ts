import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TradeService } from '../../services/trade.service';
import { AccountService } from '../../services/account.service';
import { ToastService } from '../../services/toast.service';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartType, ChartData, ChartEvent } from 'chart.js';
import { CalendarHeatmapComponent } from '../calendar-heatmap/calendar-heatmap.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BaseChartDirective, CalendarHeatmapComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
  accounts: any[] = [];
  selectedAccountId: number | null = null;
  selectedAccount: any = null;

  allTrades: any[] = [];
  filteredTrades: any[] = [];
  isLoading = true;

  // Filtros disponibles
  availableAssets: string[] = [];
  availableEmotions: string[] = [];

  // Filtros seleccionados
  filterAsset: string = 'Todos';
  filterEmotion: string = 'Todas';

  metrics: any = {
    initialCapital: 0,
    currentCapital: 0,
    totalPnL: 0,
    roiPercentage: '0.00',
    winRate: '0.00',
    profitFactor: '0.00',
    maxDrawdown: '0.00',
    winningCount: 0,
    losingCount: 0,
    breakevenCount: 0,
    openCount: 0,
    totalCount: 0,
    grossProfit: 0,
    grossLoss: 0,
    avgWin: 0,
    avgLoss: 0,
    payoffRatio: '1.00'
  };

  // --- CHARTS CONFIG ---
  public lineChartData: ChartConfiguration['data'] = { datasets: [], labels: [] };
  public lineChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    elements: { line: { tension: 0.4 } },
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
    }
  };

  public assetChartData: ChartData<'doughnut'> = { datasets: [], labels: [] };
  public assetChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: '#94a3b8' } }
    },
    cutout: '70%'
  };

  public emotionChartData: ChartData<'bar'> = { datasets: [], labels: [] };
  public emotionChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#94a3b8' } },
      y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
    }
  };

  public radarChartData: ChartData<'radar'> = { datasets: [], labels: [] };
  public radarChartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false }
    },
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
        grid: { color: 'rgba(255, 255, 255, 0.08)' },
        pointLabels: { color: '#94a3b8', font: { size: 10, weight: '500' } },
        ticks: { display: false, backdropColor: 'transparent' },
        suggestedMin: 0,
        suggestedMax: 100
      }
    }
  };

  aiInsights = {
    psychology: '',
    risk: '',
    bestStrategy: '',
    actionableAdvice: ''
  };

  // --- AUDITOR INTELIGENTE IA (NEURAL TRADING COACH) ---
  aiPsychologyReport: any = null;
  isLoadingAiReport: boolean = false;
  activeAuditorTab: 'resumen' | 'sesgos' | 'protocolos' = 'resumen';
  topStrategy: { name: string, pnl: number } | null = null;
  slAdherencePct: number = 0;
  riskAdherencePct: number = 0;

  defaultAiSummary: string = 'Auditoría neural en progreso. El motor de inteligencia artificial analiza continuamente tu historial de ejecución para cuantificar tus patrones de rentabilidad y mitigar sesgos conductuales.';

  defaultBiases: any[] = [
    {
      name: 'Trading por Venganza (Revenge)',
      severity: 0,
      costUSD: 0,
      detected: false,
      tip: 'Aplica una pausa obligatoria de 20 minutos tras cualquier Stop Loss para disipar la frustración.'
    },
    {
      name: 'FOMO (Entradas Impulsivas / Sin SL)',
      severity: 0,
      costUSD: 0,
      detected: false,
      tip: 'Si el precio ya despegó, no persigas velas. Espera pacientemente el retroceso técnico.'
    },
    {
      name: 'Efecto Disposición (Aversión al Riesgo)',
      severity: 0,
      costUSD: 0,
      detected: false,
      tip: 'Permite que el precio alcance tu Take Profit planificado; no cierres manualmente por miedo.'
    },
    {
      name: 'Sobreconfianza en Rachas Ganadoras',
      severity: 0,
      costUSD: 0,
      detected: false,
      tip: 'Mantén un lotaje fijo idéntico independientemente de cuántas operaciones seguidas ganes.'
    }
  ];

  defaultPrescriptions: string[] = [
    '🛡️ <strong>Regla del Enfriamiento:</strong> Cierra el gráfico y aléjate de la pantalla mínimo 20 minutos tras tocar un Stop Loss. No permitas que el dolor nuble tu análisis probabilístico.',
    '📐 <strong>Regla del Gatillo Técnico:</strong> Exige un mínimo de 2 confluencias verificables antes de pulsar comprar o vender. Cero entradas de mercado por impulso.',
    '🎯 <strong>Ratio Asimétrico Favorable:</strong> No aceptes trades con ratio riesgo/beneficio inferior a 1:1.5. Mover a Break Even al alcanzar 1:1 protege tu psicología.',
    '🧘 <strong>Enfoque en Proceso:</strong> Evalúa tu sesión por tu porcentaje de disciplina operativa, no por el dinero diario. La rentabilidad es la consecuencia de la maestría mental.'
  ];

  constructor(
    private tradeService: TradeService,
    private accountService: AccountService,
    public toastService: ToastService
  ) {}

  ngOnInit(): void {
    this.loadAccounts();
  }

  loadAccounts(): void {
    this.isLoading = true;
    this.accountService.getAccounts().subscribe({
      next: (data) => {
        this.accounts = data || [];
        if (this.accounts.length > 0) {
          this.selectedAccountId = this.accounts[0].id_account;
          this.selectedAccount = this.accounts[0];
          this.loadTrades();
        } else {
          this.selectedAccountId = null;
          this.selectedAccount = null;
          this.allTrades = [];
          this.filteredTrades = [];
          this.calculateMetrics();
          this.updateCharts();
          this.isLoading = false;
        }
      },
      error: (err) => {
        console.error('Error fetching accounts:', err);
        this.isLoading = false;
      }
    });
  }

  onAccountChange(event: any): void {
    this.selectedAccountId = parseInt(event.target.value, 10);
    this.selectedAccount = this.accounts.find(a => a.id_account === this.selectedAccountId);
    
    // Reset filters
    this.filterAsset = 'Todos';
    this.filterEmotion = 'Todas';
    this.loadTrades();
  }

  loadTrades(): void {
    if (!this.selectedAccountId) {
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.tradeService.getTrades(this.selectedAccountId).subscribe({
      next: (trades) => {
        // Ordenar por fecha ascendente para los gráficos de tiempo
        this.allTrades = (trades || []).sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        
        this.extractFilters();
        this.applyFilters();
        this.loadAiPsychologyReport();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching trades:', err);
        this.isLoading = false;
      }
    });
  }

  loadAiPsychologyReport(showToast: boolean = false): void {
    if (!this.selectedAccountId) return;
    this.isLoadingAiReport = true;
    if (showToast) {
      this.toastService.info('📊 Sincronizando operaciones y actualizando auditoría...');
      this.tradeService.getTrades(this.selectedAccountId).subscribe({
        next: (trades) => {
          this.allTrades = trades.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
          this.extractFilters();
          this.applyFilters();
          this.fetchAiPsychologyReport(true);
        },
        error: (err) => {
          console.error('Error refreshing trades during re-audit:', err);
          this.fetchAiPsychologyReport(true);
        }
      });
    } else {
      this.fetchAiPsychologyReport(false);
    }
  }

  fetchAiPsychologyReport(showToast: boolean): void {
    if (!this.selectedAccountId) {
      this.isLoadingAiReport = false;
      return;
    }
    this.tradeService.getPsychologicalAnalysis(this.selectedAccountId).subscribe({
      next: (data) => {
        this.aiPsychologyReport = data;
        this.isLoadingAiReport = false;
        if (showToast) {
          if (data.isAiPowered) {
            this.toastService.success(`🤖 Auditoría generada con IA Real (${data.engine}) exitosamente.`);
          } else {
            this.toastService.success(`📊 Auditoría actualizada con ${data.engine || 'Motor Cuantitativo & Conductual'}.`);
          }
        }
      },
      error: (err) => {
        console.error('Error fetching psychology report:', err);
        this.isLoadingAiReport = false;
        if (showToast) {
          this.toastService.error('Error al actualizar auditoría.');
        }
      }
    });
  }

  extractFilters(): void {
    const assets = new Set<string>();
    const emotions = new Set<string>();
    this.allTrades.forEach(t => {
      if (t.asset) assets.add(t.asset);
      if (t.emotion_state) emotions.add(t.emotion_state);
    });
    this.availableAssets = Array.from(assets);
    this.availableEmotions = Array.from(emotions);
  }

  onFilterChange(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    this.filteredTrades = this.allTrades.filter(t => {
      const matchAsset = this.filterAsset === 'Todos' || t.asset === this.filterAsset;
      const matchEmotion = this.filterEmotion === 'Todas' || t.emotion_state === this.filterEmotion;
      return matchAsset && matchEmotion;
    });

    this.calculateMetrics();
    this.updateCharts();
  }

  calculateMetrics(): void {
    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;
    let openTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalPnL = 0;
    const winAmounts: number[] = [];
    const lossAmounts: number[] = [];

    const initialCapital = this.selectedAccount ? parseFloat(this.selectedAccount.balance) : 10000;
    let currentCapital = initialCapital;
    let maxCapital = initialCapital;
    let maxDrawdown = 0;

    this.filteredTrades.forEach(trade => {
      if (trade.pnl !== null && trade.pnl !== undefined && !isNaN(parseFloat(trade.pnl))) {
        const pnl = parseFloat(trade.pnl);
        totalPnL += pnl;
        currentCapital += pnl;

        if (pnl > 0) {
          winningTrades++;
          grossProfit += pnl;
          winAmounts.push(pnl);
        } else if (pnl < 0) {
          losingTrades++;
          const absLoss = Math.abs(pnl);
          grossLoss += absLoss;
          lossAmounts.push(absLoss);
        } else {
          breakevenTrades++;
        }

        if (currentCapital > maxCapital) maxCapital = currentCapital;
        const drawdown = maxCapital > 0 ? ((maxCapital - currentCapital) / maxCapital) * 100 : 0;
        if (drawdown > maxDrawdown) maxDrawdown = drawdown;
      } else {
        openTrades++;
      }
    });

    const totalClosed = winningTrades + losingTrades + breakevenTrades;
    const winRate = totalClosed > 0 ? (winningTrades / totalClosed) * 100 : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99 : 0);
    const roiPercentage = initialCapital > 0 ? (totalPnL / initialCapital) * 100 : 0;
    const avgWin = winAmounts.length > 0 ? (winAmounts.reduce((a, b) => a + b, 0) / winAmounts.length) : 0;
    const avgLoss = lossAmounts.length > 0 ? (lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length) : 0;
    const payoffRatio = avgLoss > 0 ? (avgWin / avgLoss) : (avgWin > 0 ? avgWin : 1);

    this.metrics = {
      initialCapital: initialCapital,
      currentCapital: currentCapital,
      totalPnL: totalPnL,
      roiPercentage: roiPercentage.toFixed(2),
      winRate: winRate.toFixed(1),
      profitFactor: profitFactor >= 99 ? '99.00' : profitFactor.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2),
      winningCount: winningTrades,
      losingCount: losingTrades,
      breakevenCount: breakevenTrades,
      openCount: openTrades,
      totalCount: this.filteredTrades.length,
      grossProfit: grossProfit,
      grossLoss: grossLoss,
      avgWin: avgWin,
      avgLoss: avgLoss,
      payoffRatio: payoffRatio.toFixed(2)
    };
  }

  updateCharts(): void {
    this.updateLineChart();
    this.updateAssetChart();
    this.updateEmotionChart();
    this.updateRadarChartAndAI();
  }

  updateRadarChartAndAI(): void {
    const total = this.filteredTrades.length;
    if (total === 0) {
      this.slAdherencePct = 100;
      this.riskAdherencePct = 100;
      this.topStrategy = null;
      this.radarChartData = {
        labels: ['Control Emocional', 'Disciplina SL', 'Gestión de Riesgo', 'Paciencia', 'Consistencia'],
        datasets: [{
          data: [100, 100, 100, 100, 100],
          label: 'Puntuación (%)',
          backgroundColor: 'rgba(16, 185, 129, 0.25)',
          borderColor: '#10b981',
          pointBackgroundColor: '#10b981'
        }]
      };
      this.aiInsights = {
        psychology: 'Estado mental al 100%: Cuenta limpia y lista para operar sin sesgos emocionales.',
        risk: 'Parámetro recomendado: define un riesgo máximo del 1% al 2.5% por operación.',
        bestStrategy: 'Registra tus operaciones con confluencias técnicas para identificar tu edge estadístico.',
        actionableAdvice: 'Regla de Oro: Inicias con 100% de disciplina. Presérvala ejecutando siempre con Stop Loss.'
      };
      return;
    }

    // 1. Control emocional: penalizar solo emociones reactivas negativas (FOMO, Venganza, Ira, Frustración)
    const negativeTrades = this.filteredTrades.filter(t => ['FOMO', 'Venganza', 'Ira', 'Frustración', 'Desquite'].includes(t.emotion_state)).length;
    const emotionalScore = Math.max(10, Math.min(100, Math.round(((total - negativeTrades) / total) * 100)));

    // 2. Disciplina SL: trades con stop_loss configurado
    const slTrades = this.filteredTrades.filter(t => t.stop_loss !== null && t.stop_loss !== undefined && parseFloat(t.stop_loss) > 0).length;
    const slScore = Math.min(100, Math.round((slTrades / total) * 100));
    this.slAdherencePct = slScore;

    // 3. Gestión de riesgo: trades con riesgo <= 2.5%
    const safeRiskTrades = this.filteredTrades.filter(t => (t.risk_percentage || 1) <= 2.5).length;
    const riskScore = Math.min(100, Math.round((safeRiskTrades / total) * 100));
    this.riskAdherencePct = riskScore;

    // 4. Paciencia: trades cerrados planificados
    const closed = this.filteredTrades.filter(t => t.pnl !== null).length;
    const patienceScore = closed > 0 ? Math.min(100, Math.round((closed / total) * 80) + 20) : 100;

    // 5. Consistencia: Win rate y PnL neto
    const winRateNum = parseFloat(this.metrics.winRate) || 0;
    const totalPnLNum = parseFloat(this.metrics.totalPnL) || 0;
    let consistencyScore = Math.min(100, Math.round(winRateNum * 1.05));
    if (totalPnLNum > 0 && winRateNum >= 65) {
      consistencyScore = Math.max(90, consistencyScore);
    }

    this.radarChartData = {
      labels: ['Control Emocional', 'Disciplina SL', 'Gestión Riesgo', 'Paciencia', 'Consistencia'],
      datasets: [{
        data: [emotionalScore, slScore, riskScore, patienceScore, consistencyScore],
        label: 'Puntuación (%)',
        backgroundColor: 'rgba(99, 102, 241, 0.25)',
        borderColor: '#818cf8',
        pointBackgroundColor: '#818cf8',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: '#818cf8'
      }]
    };

    // Calculate topStrategy
    const confPnl: { [key: string]: number } = {};
    this.filteredTrades.forEach(t => {
      if (t.confluences && t.pnl !== null) {
        t.confluences.split(',').forEach((c: string) => {
          const tag = c.trim();
          if (tag) {
            confPnl[tag] = (confPnl[tag] || 0) + parseFloat(t.pnl);
          }
        });
      }
    });

    const entries = Object.entries(confPnl);
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1]);
      const best = entries[0];
      if (best[1] > 0) {
        this.topStrategy = { name: best[0], pnl: best[1] };
      } else {
        this.topStrategy = null;
      }
    } else {
      this.topStrategy = null;
    }

    this.generateAIInsights(emotionalScore, slScore, riskScore);
  }

  generateAIInsights(emotionalScore: number, slScore: number, riskScore: number): void {
    const totalPnLNum = parseFloat(this.metrics.totalPnL) || 0;
    const winRateNum = parseFloat(this.metrics.winRate) || 0;
    const losingCount = this.filteredTrades.filter(t => parseFloat(t.pnl) < 0).length;

    // Psicología
    if (totalPnLNum > 0 && losingCount <= 1) {
      this.aiInsights.psychology = 'Excelente serenidad mental: Tu operativa muestra alta convicción técnica y aceptas las pérdidas controladas sin reactividad.';
    } else if (emotionalScore >= 75) {
      this.aiInsights.psychology = 'Excelente autocontrol mental: La gran mayoría de tus operaciones se ejecutan bajo estados de Calma y Confianza.';
    } else {
      this.aiInsights.psychology = 'Detectamos presencia de impulsividad o revancha. Respeta una pausa obligatoria de 20 minutos tras una pérdida.';
    }

    // Riesgo
    if (riskScore >= 75) {
      this.aiInsights.risk = 'Gestión de capital óptima: mantienes el riesgo por trade dentro de los parámetros recomendados (&le; 2%).';
    } else {
      this.aiInsights.risk = 'Alerta de sobreapalancamiento: algunas operaciones arriesgan más de lo debido, lo cual amplifica tu Max Drawdown.';
    }

    // Estrategia confluencias
    const confPnl: { [key: string]: number } = {};
    this.filteredTrades.forEach(t => {
      if (t.confluences && t.pnl !== null) {
        t.confluences.split(',').forEach((c: string) => {
          const tag = c.trim();
          if (tag) {
            confPnl[tag] = (confPnl[tag] || 0) + parseFloat(t.pnl);
          }
        });
      }
    });

    const entries = Object.entries(confPnl);
    if (entries.length > 0) {
      entries.sort((a, b) => b[1] - a[1]);
      const best = entries[0];
      if (best[1] > 0) {
        this.aiInsights.bestStrategy = `Tu setup técnico más ganador es "#${best[0]}" con un PnL positivo neto de +$${best[1].toFixed(2)}.`;
      } else {
        this.aiInsights.bestStrategy = 'Tus confluencias actuales requieren revisión y optimización de entradas y salidas.';
      }
    } else {
      this.aiInsights.bestStrategy = 'Etiqueta confluencias al registrar operaciones para auditar qué patrón técnico te da mayor ventaja estadística.';
    }

    // Regla de Oro
    if (totalPnLNum > 0 && winRateNum >= 65) {
      this.aiInsights.actionableAdvice = 'Regla de Oro: Tu ventaja estadística está demostrada (+USD). Mantén tu riesgo fijo y deja correr la probabilidad a tu favor.';
    } else if (slScore < 70) {
      this.aiInsights.actionableAdvice = 'Regla de Oro: Coloca siempre tu Stop Loss desde el momento de entrar. Cortar pérdidas rápido es el secreto de la rentabilidad.';
    } else if (parseFloat(this.metrics.profitFactor) >= 1.4) {
      this.aiInsights.actionableAdvice = 'Regla de Oro: Tu ventaja estadística está demostrada. Sé disciplinado, no aumentes el riesgo de golpe.';
    } else {
      this.aiInsights.actionableAdvice = 'Regla de Oro: Prioriza setups con ratio Riesgo/Beneficio mínimo 1:2 para multiplicar tu curva de capital.';
    }
  }

  printReport(): void {
    this.toastService.info('Abriendo vista de impresión / PDF...');
    setTimeout(() => {
      window.print();
    }, 250);
  }

  updateLineChart(): void {
    let cap = this.selectedAccount ? parseFloat(this.selectedAccount.balance) : 10000;
    const capData = [cap];
    const labels = ['Inicio'];

    this.filteredTrades.forEach((t, i) => {
      if (t.pnl !== null) {
        cap += parseFloat(t.pnl);
        capData.push(cap);
        labels.push(`Op ${i + 1}`);
      }
    });

    this.lineChartData = {
      labels,
      datasets: [
        {
          data: capData,
          label: 'Capital ($)',
          backgroundColor: 'rgba(37, 99, 235, 0.1)',
          borderColor: '#3B82F6',
          pointBackgroundColor: '#3B82F6',
          pointBorderColor: '#fff',
          pointRadius: 4,
          pointHoverRadius: 6,
          fill: 'origin',
          tension: 0.3
        }
      ]
    };
  }

  updateAssetChart(): void {
    const assetCounts: any = {};
    this.filteredTrades.forEach(t => {
      if (!t.asset) return;
      assetCounts[t.asset] = (assetCounts[t.asset] || 0) + 1;
    });

    const labels = Object.keys(assetCounts);
    const data = Object.values(assetCounts) as number[];

    this.assetChartData = {
      labels,
      datasets: [{
        data,
        backgroundColor: [
          '#3B82F6', '#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#6366F1'
        ],
        borderWidth: 0,
        hoverOffset: 4
      }]
    };
  }

  updateEmotionChart(): void {
    const emotionPnL: any = {};
    this.filteredTrades.forEach(t => {
      if (!t.emotion_state || t.pnl === null) return;
      emotionPnL[t.emotion_state] = (emotionPnL[t.emotion_state] || 0) + parseFloat(t.pnl);
    });

    const labels = Object.keys(emotionPnL);
    const data = Object.values(emotionPnL) as number[];
    const backgroundColors = data.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.8)' : 'rgba(239, 68, 68, 0.8)');

    this.emotionChartData = {
      labels,
      datasets: [{
        label: 'PnL Neto ($)',
        data,
        backgroundColor: backgroundColors,
        borderRadius: 4
      }]
    };
  }
}
