/**
 * quantitativeEngine.js
 * Motor Cuantitativo y de Finanzas Conductuales
 * Trading Portfolio & Risk Analytics Engine
 */

// Multiplicadores oficiales de futuros CME / NYMEX
const FUTURES_MULTIPLIERS = {
  'MES': 5,
  'ES': 50,
  'MNQ': 2,
  'NQ': 20,
  'MYM': 0.5,
  'YM': 5,
  'M2K': 5,
  'RTY': 50,
  'MCL': 100,
  'CL': 1000,
  'MGC': 10,
  'GC': 100,
  'SI': 5000,
  'NG': 10000,
  'HG': 25000,
  'ZB': 1000,
  '6E': 125000,
  '6J': 125000
};

// Tasas FX de referencia interbancaria (USD base)
const DEFAULT_FX_RATES = {
  'USD': 1.0,
  'JPY': 158.2,
  'CHF': 0.892,
  'CAD': 1.425,
  'MXN': 19.5,
  'ZAR': 18.2,
  'TRY': 34.2,
  'SEK': 10.6,
  'NOK': 10.85,
  'GBP': 1.323,
  'EUR': 1.12,
  'AUD': 0.6988,
  'NZD': 0.605
};

/**
 * Cálculo universal de PnL en USD según mercado y tipo de activo
 */
function calculatePnLInUSD(trade) {
  if (trade.pnl !== null && trade.pnl !== undefined && !isNaN(parseFloat(trade.pnl))) {
    return parseFloat(parseFloat(trade.pnl).toFixed(2));
  }
  if (trade.entry_price == null || trade.exit_price == null || !trade.volume) {
    return null;
  }
  const entry = parseFloat(trade.entry_price);
  const exit = parseFloat(trade.exit_price);
  const volume = parseFloat(trade.volume);
  if (isNaN(entry) || isNaN(exit) || isNaN(volume) || volume <= 0) {
    return null;
  }

  const direction = trade.trade_type === 'LONG' ? 1 : -1;
  const diff = exit - entry;
  const market = trade.market_type || 'General';
  const asset = (trade.asset || '').toUpperCase().trim();

  // 1. Binarias
  if (market === 'Binarias') {
    const rawPayout = trade.payout_percentage !== undefined && trade.payout_percentage !== null
      ? parseFloat(trade.payout_percentage)
      : 85;
    const payout = (rawPayout > 0 ? rawPayout : 85) / 100;
    const eff = diff * direction;
    if (eff > 0.00000001) return parseFloat((volume * payout).toFixed(2));
    if (eff < -0.00000001) return -parseFloat(volume.toFixed(2));
    return 0;
  }

  // 2. Cryptos & Acciones
  if (market === 'Cryptos' || market === 'Acciones') {
    if (asset.endsWith('/BTC') || asset.endsWith('BTC')) {
      return parseFloat((diff * volume * direction * 65000).toFixed(2));
    }
    return parseFloat((diff * volume * direction).toFixed(2));
  }

  // 3. Futuros (Multiplicadores Oficiales CME / NYMEX)
  if (market === 'Futuros') {
    let mult = 1;
    for (const [key, val] of Object.entries(FUTURES_MULTIPLIERS)) {
      if (asset.includes(`(${key})`) || asset.includes(key) || asset === key || asset.startsWith(`${key}1!`)) {
        mult = val;
        break;
      }
    }
    if (mult === 1) {
      if (asset.includes('MICRO S&P')) mult = 5;
      else if (asset.includes('S&P')) mult = 50;
      else if (asset.includes('MICRO NASDAQ')) mult = 2;
      else if (asset.includes('NASDAQ')) mult = 20;
      else if (asset.includes('MICRO DOW')) mult = 0.5;
      else if (asset.includes('DOW')) mult = 5;
      else if (asset.includes('MICRO RUSSELL')) mult = 5;
      else if (asset.includes('RUSSELL')) mult = 50;
      else if (asset.includes('MICRO PETR') || asset.includes('MICRO OIL') || asset.includes('MICRO CRUDE')) mult = 100;
      else if (asset.includes('PETR') || asset.includes('USOIL')) mult = 1000;
      else if (asset.includes('MICRO ORO') || asset.includes('MICRO GOLD')) mult = 10;
      else if (asset.includes('ORO') || asset.includes('GOLD') || asset.includes('XAU')) mult = 100;
      else if (asset.includes('PLATA') || asset.includes('XAG')) mult = 5000;
    }
    return parseFloat((diff * volume * mult * direction).toFixed(2));
  }

  // 4. Forex
  if (market === 'Forex') {
    if (asset.includes('XAU') || asset.includes('GOLD') || asset.includes('ORO')) {
      return parseFloat((diff * volume * 100 * direction).toFixed(2));
    }
    if (asset.includes('XAG') || asset.includes('SILVER') || asset.includes('PLATA')) {
      return parseFloat((diff * volume * 5000 * direction).toFixed(2));
    }

    const rawQuote = diff * volume * 100000 * direction;
    let base = '', quote = '';
    if (asset.includes('/')) {
      const parts = asset.split(' ')[0].split('/');
      base = parts[0].trim();
      quote = parts[1] ? parts[1].trim() : '';
    } else {
      const clean = asset.replace(/[^A-Z]/g, '');
      if (clean.length === 6) {
        base = clean.substring(0, 3);
        quote = clean.substring(3, 6);
      }
    }

    if (quote === 'USD') return parseFloat(rawQuote.toFixed(2));
    if (base === 'USD') {
      const rate = exit > 0 ? exit : entry;
      return rate > 0 ? parseFloat((rawQuote / rate).toFixed(2)) : parseFloat(rawQuote.toFixed(2));
    }

    if (quote && DEFAULT_FX_RATES[quote]) {
      const direct = ['GBP', 'EUR', 'AUD', 'NZD'].includes(quote);
      const inUSD = direct ? (rawQuote * DEFAULT_FX_RATES[quote]) : (rawQuote / DEFAULT_FX_RATES[quote]);
      return parseFloat(inUSD.toFixed(2));
    }

    if (asset.includes('JPY')) return parseFloat((rawQuote / 152.0).toFixed(2));
    if (asset.includes('GBP')) return parseFloat((rawQuote * 1.28).toFixed(2));
    if (asset.includes('EUR')) return parseFloat((rawQuote * 1.08).toFixed(2));
    return parseFloat(rawQuote.toFixed(2));
  }

  return parseFloat((diff * volume * direction).toFixed(2));
}

/**
 * Calcula el riesgo financiero real asumido en USD (R) para una operación
 */
function calculateTradeRiskUSD(trade, accountBalance = 10000) {
  const entry = parseFloat(trade.entry_price);
  const sl = parseFloat(trade.stop_loss);
  const volume = parseFloat(trade.volume) || 1;
  const market = trade.market_type || 'General';
  const asset = (trade.asset || '').toUpperCase().trim();

  // Si tiene Stop Loss definido
  if (!isNaN(entry) && !isNaN(sl) && sl > 0) {
    const diff = Math.abs(entry - sl);
    if (diff > 0) {
      if (market === 'Binarias') {
        return parseFloat(volume.toFixed(2));
      }
      if (market === 'Cryptos' || market === 'Acciones') {
        return parseFloat((diff * volume).toFixed(2));
      }
      if (market === 'Futuros') {
        let mult = 1;
        for (const [key, val] of Object.entries(FUTURES_MULTIPLIERS)) {
          if (asset.includes(`(${key})`) || asset.includes(key) || asset === key || asset.startsWith(`${key}1!`)) {
            mult = val;
            break;
          }
        }
        if (mult === 1) {
          if (asset.includes('MES') || asset.includes('MICRO S&P')) mult = 5;
          else if (asset.includes('ES') || asset.includes('S&P')) mult = 50;
          else if (asset.includes('MNQ') || asset.includes('MICRO NASDAQ')) mult = 2;
          else if (asset.includes('NQ') || asset.includes('NASDAQ')) mult = 20;
          else if (asset.includes('MGC') || asset.includes('MICRO ORO')) mult = 10;
          else if (asset.includes('GC') || asset.includes('ORO')) mult = 100;
          else if (asset.includes('MCL') || asset.includes('MICRO PETR')) mult = 100;
          else if (asset.includes('CL') || asset.includes('PETR')) mult = 1000;
        }
        return parseFloat((diff * volume * mult).toFixed(2));
      }
      if (market === 'Forex') {
        if (asset.includes('XAU') || asset.includes('GOLD')) {
          return parseFloat((diff * volume * 100).toFixed(2));
        }
        let quote = '';
        if (asset.includes('/')) {
          quote = asset.split('/')[1]?.split(' ')[0]?.trim() || '';
        } else {
          const clean = asset.replace(/[^A-Z]/g, '');
          if (clean.length === 6) quote = clean.substring(3, 6);
        }
        let quoteMultiplier = 1;
        if (quote && DEFAULT_FX_RATES[quote]) {
          const direct = ['GBP', 'EUR', 'AUD', 'NZD'].includes(quote);
          quoteMultiplier = direct ? DEFAULT_FX_RATES[quote] : (1 / DEFAULT_FX_RATES[quote]);
        }
        const rawRisk = diff * volume * 100000 * quoteMultiplier;
        return parseFloat(rawRisk.toFixed(2));
      }
      return parseFloat((diff * volume).toFixed(2));
    }
  }

  // Si no tiene Stop Loss pero especificó risk_percentage
  if (trade.risk_percentage && !isNaN(parseFloat(trade.risk_percentage))) {
    const pct = parseFloat(trade.risk_percentage);
    const balance = accountBalance > 0 ? accountBalance : 10000;
    return parseFloat(((balance * pct) / 100).toFixed(2));
  }

  // Fallback: 1% del balance de la cuenta o mínimo $100
  const fallback = accountBalance > 0 ? accountBalance * 0.01 : 100;
  return parseFloat(fallback.toFixed(2));
}

/**
 * Calcula el múltiplo R (R-Multiple) de una operación
 * R = PnL / Risk_USD
 */
function calculateRMultiple(trade, accountBalance = 10000) {
  const pnl = calculatePnLInUSD(trade);
  if (pnl === null || isNaN(pnl)) return null;

  const riskUSD = calculateTradeRiskUSD(trade, accountBalance);
  if (riskUSD <= 0) return 0;

  const r = pnl / riskUSD;
  return parseFloat(r.toFixed(2));
}

/**
 * Calcula la Expectanza Matemática ($E$) y Expectanza en $R$
 * E_USD = (Win Rate * Avg Win) - (Loss Rate * Avg Loss)
 * E_R = (Win Rate * Avg R_Win) - (Loss Rate * |Avg R_Loss|)
 */
function calculateExpectancy(trades, accountBalance = 10000) {
  let closedCount = 0;
  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let winAmounts = [];
  let lossAmounts = [];
  let winRList = [];
  let lossRList = [];
  let allRMultiples = [];

  const buckets = {
    'lt_minus_2R': 0, // < -2.0R
    'minus_2R_to_minus_1R': 0, // [-2.0R, -1.0R)
    'minus_1R_to_0R': 0, // [-1.0R, 0R)
    'breakeven_0R': 0, // 0R
    '0R_to_1R': 0, // (0R, 1.0R]
    '1R_to_2R': 0, // (1.0R, 2.0R]
    '2R_to_3R': 0, // (2.0R, 3.0R]
    'gt_3R': 0 // > 3.0R
  };

  trades.forEach(t => {
    const pnl = calculatePnLInUSD(t);
    if (pnl !== null && !isNaN(pnl)) {
      closedCount++;
      const r = calculateRMultiple(t, accountBalance);
      if (r !== null) {
        allRMultiples.push(r);
        if (r < -2.0) buckets.lt_minus_2R++;
        else if (r < -1.0) buckets.minus_2R_to_minus_1R++;
        else if (r < 0) buckets.minus_1R_to_0R++;
        else if (r === 0) buckets.breakeven_0R++;
        else if (r <= 1.0) buckets['0R_to_1R']++;
        else if (r <= 2.0) buckets['1R_to_2R']++;
        else if (r <= 3.0) buckets['2R_to_3R']++;
        else buckets.gt_3R++;
      }

      if (pnl > 0) {
        winCount++;
        winAmounts.push(pnl);
        if (r !== null) winRList.push(r);
      } else if (pnl < 0) {
        lossCount++;
        const absLoss = Math.abs(pnl);
        lossAmounts.push(absLoss);
        if (r !== null) lossRList.push(Math.abs(r));
      } else {
        breakevenCount++;
      }
    }
  });

  const winRate = closedCount > 0 ? (winCount / closedCount) : 0;
  const lossRate = closedCount > 0 ? (lossCount / closedCount) : 0;

  const avgWin = winAmounts.length > 0 ? (winAmounts.reduce((a, b) => a + b, 0) / winAmounts.length) : 0;
  const avgLoss = lossAmounts.length > 0 ? (lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length) : 0;

  const avgWinR = winRList.length > 0 ? (winRList.reduce((a, b) => a + b, 0) / winRList.length) : 0;
  const avgLossR = lossRList.length > 0 ? (lossRList.reduce((a, b) => a + b, 0) / lossRList.length) : 0;

  // Expectanza Nominal ($ USD)
  const expectancyUSD = (winRate * avgWin) - (lossRate * avgLoss);
  // Expectanza Normalizada en Unidades de Riesgo (R)
  const expectancyR = (winRate * avgWinR) - (lossRate * avgLossR);

  // Calificación institucional
  let qualityLabel = 'Neutral / Sin Ventaja';
  if (expectancyR > 0.5) qualityLabel = 'Ventaja Institucional Sobresaliente (Elite Edge)';
  else if (expectancyR > 0.25) qualityLabel = 'Ventaja Estadística Sólida (High Edge)';
  else if (expectancyR > 0) qualityLabel = 'Ventaja Leve (Marginal Edge)';
  else if (expectancyR < 0) qualityLabel = 'Expectanza Negativa (Fuga de Capital)';

  return {
    closedTrades: closedCount,
    winRatePct: parseFloat((winRate * 100).toFixed(1)),
    lossRatePct: parseFloat((lossRate * 100).toFixed(1)),
    avgWinUSD: parseFloat(avgWin.toFixed(2)),
    avgLossUSD: parseFloat(avgLoss.toFixed(2)),
    avgWinR: parseFloat(avgWinR.toFixed(2)),
    avgLossR: parseFloat(avgLossR.toFixed(2)),
    expectancyUSD: parseFloat(expectancyUSD.toFixed(2)),
    expectancyR: parseFloat(expectancyR.toFixed(2)),
    qualityLabel,
    rDistribution: buckets,
    allRMultiples
  };
}

/**
 * Matriz Empírica de Correlación Emoción vs. PnL
 * Cruce estadístico formal para validar hipótesis de psicología financiera
 */
function calculateEmotionMatrix(trades) {
  const groups = {};

  trades.forEach(t => {
    const emo = t.emotion_state || 'Calma';
    if (!groups[emo]) {
      groups[emo] = {
        emotion: emo,
        total: 0,
        wins: 0,
        losses: 0,
        breakevens: 0,
        winAmounts: [],
        lossAmounts: [],
        totalPnL: 0,
        noSLCount: 0,
        revengeCount: 0
      };
    }
    const g = groups[emo];
    g.total++;

    const pnl = calculatePnLInUSD(t);
    if (pnl !== null && !isNaN(pnl)) {
      g.totalPnL += pnl;
      if (pnl > 0) {
        g.wins++;
        g.winAmounts.push(pnl);
      } else if (pnl < 0) {
        g.losses++;
        g.lossAmounts.push(Math.abs(pnl));
      } else {
        g.breakevens++;
      }
    }

    if (!t.stop_loss || parseFloat(t.stop_loss) <= 0) {
      g.noSLCount++;
    }
  });

  const matrix = Object.values(groups).map(g => {
    const closed = g.wins + g.losses + g.breakevens;
    const winRate = closed > 0 ? (g.wins / closed) * 100 : 0;
    const avgWin = g.winAmounts.length > 0 ? (g.winAmounts.reduce((a, b) => a + b, 0) / g.winAmounts.length) : 0;
    const avgLoss = g.lossAmounts.length > 0 ? (g.lossAmounts.reduce((a, b) => a + b, 0) / g.lossAmounts.length) : 0;
    const avgPnL = closed > 0 ? (g.totalPnL / closed) : 0;
    const grossLoss = g.lossAmounts.reduce((a, b) => a + b, 0);
    const grossProfit = g.winAmounts.reduce((a, b) => a + b, 0);
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99 : 0);

    return {
      emotion: g.emotion,
      tradesCount: g.total,
      closedTrades: closed,
      winRate: parseFloat(winRate.toFixed(1)),
      totalPnL: parseFloat(g.totalPnL.toFixed(2)),
      avgPnL: parseFloat(avgPnL.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      profitFactor: parseFloat((profitFactor >= 99 ? 99 : profitFactor).toFixed(2)),
      indisciplineRate: parseFloat(((g.noSLCount / g.total) * 100).toFixed(1))
    };
  }).sort((a, b) => b.totalPnL - a.totalPnL);

  // Comparativa contra estado basal 'Calma' o 'Confianza'
  const benchmark = matrix.find(m => m.emotion === 'Calma') || matrix.find(m => m.emotion === 'Confianza') || matrix[0];
  const comparativeInsights = [];

  matrix.forEach(m => {
    if (benchmark && m.emotion !== benchmark.emotion) {
      const winRateDrop = benchmark.winRate - m.winRate;
      const lossMultiplier = benchmark.avgLoss > 0 ? (m.avgLoss / benchmark.avgLoss) : 1;

      if (winRateDrop > 15 || lossMultiplier > 1.3 || m.totalPnL < 0) {
        let msg = `Bajo la emoción '${m.emotion}', tu efectividad es de ${m.winRate}% (frente a ${benchmark.winRate}% en '${benchmark.emotion}').`;
        if (lossMultiplier > 1.2) {
          msg += ` Tu pérdida promedio es ${lossMultiplier.toFixed(1)}x mayor.`;
        }
        if (m.totalPnL < 0) {
          msg += ` Acumula una fuga neta de -$${Math.abs(m.totalPnL).toFixed(2)} USD.`;
        }
        comparativeInsights.push({
          emotion: m.emotion,
          insight: msg,
          lossMultiplier: parseFloat(lossMultiplier.toFixed(2)),
          winRateDrop: parseFloat(winRateDrop.toFixed(1)),
          impact: m.totalPnL < 0 ? 'Negativo' : 'Moderado'
        });
      }
    }
  });

  return {
    matrix,
    benchmarkEmotion: benchmark ? benchmark.emotion : 'N/A',
    comparativeInsights
  };
}

/**
 * Desglose de Rendimiento por Sesión y Franja Horaria
 * Sesión Londres: 03:00 - 11:00 EST (08:00 - 16:00 UTC)
 * Sesión Nueva York: 08:00 - 17:00 EST (13:00 - 22:00 UTC)
 * Sesión Asia / Tokio: 19:00 - 03:00 EST (00:00 - 08:00 UTC)
 */
function calculateSessionBreakdown(trades) {
  const sessions = {
    'Londres': { name: 'Londres (03:00 - 11:00 EST)', code: 'LON', trades: 0, wins: 0, losses: 0, pnl: 0, noSL: 0 },
    'Nueva York': { name: 'Nueva York (08:00 - 17:00 EST)', code: 'NY', trades: 0, wins: 0, losses: 0, pnl: 0, noSL: 0 },
    'Asia': { name: 'Asia / Tokio (19:00 - 03:00 EST)', code: 'ASIA', trades: 0, wins: 0, losses: 0, pnl: 0, noSL: 0 },
    'Fuera de Sesión': { name: 'Fuera de Sesión / Nocturna', code: 'OFF', trades: 0, wins: 0, losses: 0, pnl: 0, noSL: 0 }
  };

  const hourlyMap = Array.from({ length: 24 }, (_, i) => ({
    hourEST: i,
    label: `${i.toString().padStart(2, '0')}:00 EST`,
    trades: 0,
    wins: 0,
    losses: 0,
    pnl: 0
  }));

  let post2PMLosses = 0;
  let totalLosses = 0;

  trades.forEach(t => {
    const date = new Date(t.createdAt || Date.now());
    // Convertir a EST (UTC - 5)
    const utcHours = date.getUTCHours();
    const estHours = (utcHours - 5 + 24) % 24;

    const pnl = calculatePnLInUSD(t);
    const hasPnl = pnl !== null && !isNaN(pnl);
    const isWin = hasPnl && pnl > 0;
    const isLoss = hasPnl && pnl < 0;
    const hasNoSL = !t.stop_loss || parseFloat(t.stop_loss) <= 0;

    if (isLoss) {
      totalLosses += Math.abs(pnl);
      if (estHours >= 14) {
        post2PMLosses += Math.abs(pnl);
      }
    }

    // Clasificación de sesiones (considerando overlaps)
    let assignedSession = 'Fuera de Sesión';
    if (estHours >= 8 && estHours < 17) {
      assignedSession = 'Nueva York';
    } else if (estHours >= 3 && estHours < 11) {
      assignedSession = 'Londres';
    } else if (estHours >= 19 || estHours < 3) {
      assignedSession = 'Asia';
    }

    const s = sessions[assignedSession];
    s.trades++;
    if (hasPnl) s.pnl += pnl;
    if (isWin) s.wins++;
    if (isLoss) s.losses++;
    if (hasNoSL) s.noSL++;

    // Hourly map
    const h = hourlyMap[estHours];
    h.trades++;
    if (hasPnl) h.pnl += pnl;
    if (isWin) h.wins++;
    if (isLoss) h.losses++;
  });

  const sessionList = Object.values(sessions).map(s => {
    const closed = s.wins + s.losses;
    const winRate = closed > 0 ? (s.wins / closed) * 100 : 0;
    return {
      sessionName: s.name,
      code: s.code,
      tradesCount: s.trades,
      winRate: parseFloat(winRate.toFixed(1)),
      totalPnL: parseFloat(s.pnl.toFixed(2)),
      avgPnL: s.trades > 0 ? parseFloat((s.pnl / s.trades).toFixed(2)) : 0,
      indisciplineCount: s.noSL
    };
  });

  // Detección de fatiga operativa
  const fatigueAlerts = [];
  const post2PMPct = totalLosses > 0 ? (post2PMLosses / totalLosses) * 100 : 0;
  if (post2PMPct > 40 && totalLosses > 0) {
    fatigueAlerts.push({
      type: 'FATIGA_HORARIA',
      severity: post2PMPct > 70 ? 'CRITICA' : 'MODERADA',
      message: `Fatiga operativa detectada: Tus operaciones después de las 2:00 PM EST acumulan el ${post2PMPct.toFixed(0)}% de tus pérdidas totales. Recomendación: Bloquear operativa vespertina.`
    });
  }

  // Mejor y peor sesión
  const sortedSessions = [...sessionList].filter(s => s.tradesCount > 0).sort((a, b) => b.totalPnL - a.totalPnL);
  const bestSession = sortedSessions[0] || null;
  const worstSession = sortedSessions.length > 1 ? sortedSessions[sortedSessions.length - 1] : null;

  return {
    sessions: sessionList,
    hourlyDistribution: hourlyMap.map(h => ({
      hourEST: h.hourEST,
      label: h.label,
      trades: h.trades,
      pnl: parseFloat(h.pnl.toFixed(2)),
      winRate: (h.wins + h.losses) > 0 ? parseFloat(((h.wins / (h.wins + h.losses)) * 100).toFixed(1)) : 0
    })),
    bestSession,
    worstSession,
    fatigueAlerts
  };
}

/**
 * Simulador de Monte Carlo & Riesgo de Ruina (Risk of Ruin)
 * 1,000 curvas proyectadas por bootstrapping con remuestreo aleatorio
 */
function runMonteCarloSimulation(trades, initialBalance = 10000, numSimulations = 1000, horizonTrades = 100) {
  const pnlList = [];
  trades.forEach(t => {
    const pnl = calculatePnLInUSD(t);
    if (pnl !== null && !isNaN(pnl)) {
      pnlList.push(pnl);
    }
  });

  const baseCapital = initialBalance > 0 ? initialBalance : 10000;

  // Si hay muy pocos datos, devolver proyección determinística
  if (pnlList.length < 3) {
    const steps = Array.from({ length: horizonTrades + 1 }, (_, i) => ({
      tradeIndex: i,
      p5: baseCapital,
      p50: baseCapital,
      p95: baseCapital
    }));
    return {
      numSimulations,
      horizonTrades,
      initialBalance: baseCapital,
      riskOfRuinPct: 0,
      maxDrawdownP95Pct: 0,
      expectedFinalCapital: baseCapital,
      projectedEquityCurves: steps,
      sampleTrajectories: [
        { name: 'Trayectoria 1', data: Array(horizonTrades + 1).fill(baseCapital) },
        { name: 'Trayectoria 2', data: Array(horizonTrades + 1).fill(baseCapital) }
      ],
      analyticRiskOfRuin: 0,
      interpretation: 'Se requieren al menos 3 operaciones cerradas para ejecutar el remuestreo de Monte Carlo.'
    };
  }

  // Ruin condition: drawdown >= 35% de capital inicial o balance <= 0
  const ruinThreshold = baseCapital * 0.65;
  let ruinedCount = 0;
  const maxDrawdowns = [];
  const finalBalances = [];

  // Almacenar valores por paso para calcular percentiles en cada trade [0..horizonTrades]
  const stepValues = Array.from({ length: horizonTrades + 1 }, () => []);
  for (let s = 0; s <= horizonTrades; s++) {
    stepValues[s].push(baseCapital);
  }

  // Guardar 5 trayectorias de ejemplo para visualizar en el gráfico
  const sampleTrajectories = Array.from({ length: 5 }, (_, i) => ({
    name: `Simulación #${i + 1}`,
    data: [baseCapital]
  }));

  // Algoritmo Bootstrap Monte Carlo
  for (let sim = 0; sim < numSimulations; sim++) {
    let currentBalance = baseCapital;
    let peakBalance = baseCapital;
    let maxDD = 0;
    let hasRuined = false;

    for (let step = 1; step <= horizonTrades; step++) {
      // Muestreo aleatorio con reemplazo
      const randomIndex = Math.floor(Math.random() * pnlList.length);
      const sampledPnL = pnlList[randomIndex];
      currentBalance += sampledPnL;

      if (currentBalance > peakBalance) {
        peakBalance = currentBalance;
      }

      const dd = peakBalance > 0 ? ((peakBalance - currentBalance) / peakBalance) * 100 : 100;
      if (dd > maxDD) maxDD = dd;

      if (currentBalance <= ruinThreshold) {
        hasRuined = true;
      }

      stepValues[step].push(currentBalance);

      if (sim < 5) {
        sampleTrajectories[sim].data.push(parseFloat(currentBalance.toFixed(2)));
      }
    }

    if (hasRuined) ruinedCount++;
    maxDrawdowns.push(maxDD);
    finalBalances.push(currentBalance);
  }

  // Calcular percentiles por paso (p5, p50, p95)
  const projectedEquityCurves = stepValues.map((arr, index) => {
    arr.sort((a, b) => a - b);
    const p5 = arr[Math.floor(arr.length * 0.05)];
    const p50 = arr[Math.floor(arr.length * 0.50)];
    const p95 = arr[Math.floor(arr.length * 0.95)];
    return {
      tradeIndex: index,
      p5: parseFloat(p5.toFixed(2)),
      p50: parseFloat(p50.toFixed(2)),
      p95: parseFloat(p95.toFixed(2))
    };
  });

  maxDrawdowns.sort((a, b) => a - b);
  finalBalances.sort((a, b) => a - b);

  const riskOfRuinPct = parseFloat(((ruinedCount / numSimulations) * 100).toFixed(2));
  const maxDrawdownP95Pct = parseFloat((maxDrawdowns[Math.floor(maxDrawdowns.length * 0.95)]).toFixed(2));
  const expectedFinalCapital = parseFloat((finalBalances[Math.floor(finalBalances.length * 0.50)]).toFixed(2));

  // Fórmula analítica aproximada de Ralph Vince / Perry Kaufman:
  // RoR = ((1 - A) / (1 + A))^U donde A es la ventaja normalizada y U son unidades de riesgo
  const wins = pnlList.filter(p => p > 0);
  const losses = pnlList.filter(p => p < 0);
  const winRate = pnlList.length > 0 ? (wins.length / pnlList.length) : 0;
  const avgWin = wins.length > 0 ? (wins.reduce((a, b) => a + b, 0) / wins.length) : 1;
  const avgLoss = losses.length > 0 ? (Math.abs(losses.reduce((a, b) => a + b, 0)) / losses.length) : 1;
  const payoff = avgLoss > 0 ? (avgWin / avgLoss) : 1;
  const edge = (winRate * payoff) - (1 - winRate);
  let analyticRoR = 0;
  if (edge > 0) {
    const normEdge = Math.min(0.9, edge / (payoff + 1));
    const units = baseCapital / (avgLoss > 0 ? avgLoss : 100);
    const base = (1 - normEdge) / (1 + normEdge);
    analyticRoR = Math.max(0, Math.min(100, Math.pow(base, Math.min(units, 20)) * 100));
  } else {
    analyticRoR = 100;
  }

  let interpretation = '';
  if (riskOfRuinPct === 0) {
    interpretation = 'Riesgo de Ruina Matemático Prácticamente Nulo (0.00%). Tu distribución histórica muestra robustez para soportar rachas negativas sin comprometer el capital de la cuenta.';
  } else if (riskOfRuinPct < 5) {
    interpretation = `Riesgo de Ruina Bajo (${riskOfRuinPct}%). Tu ventaja estadística protege la cuenta ante varianzas adversas dentro del estándar de prop firms.`;
  } else if (riskOfRuinPct < 20) {
    interpretation = `Riesgo de Ruina Moderado (${riskOfRuinPct}%). Existe posibilidad de un drawdown severo del 35% en 100 operaciones; se aconseja reducir el riesgo por trade a $\\le 1.5\\%$.`;
  } else {
    interpretation = `Riesgo de Ruina Crítico (${riskOfRuinPct}%). Tu sistema actual presenta una probabilidad matemática elevada de quiebre bajo rachas desfavorables. Es urgente limitar el apalancamiento y estandarizar Stop Loss.`;
  }

  return {
    numSimulations,
    horizonTrades,
    initialBalance: baseCapital,
    riskOfRuinPct,
    maxDrawdownP95Pct,
    expectedFinalCapital,
    projectedEquityCurves,
    sampleTrajectories,
    analyticRiskOfRuin: parseFloat(analyticRoR.toFixed(2)),
    interpretation
  };
}

module.exports = {
  FUTURES_MULTIPLIERS,
  DEFAULT_FX_RATES,
  calculatePnLInUSD,
  calculateTradeRiskUSD,
  calculateRMultiple,
  calculateExpectancy,
  calculateEmotionMatrix,
  calculateSessionBreakdown,
  runMonteCarloSimulation
};
