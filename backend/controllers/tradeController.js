const Trade = require('../models/Trade');
const TradingAccount = require('../models/TradingAccount');

const getTrades = async (req, res) => {
  try {
    const { accountId } = req.query;
    const whereClause = { userId: req.user.id };
    if (accountId) {
      whereClause.accountId = accountId;
    }
    const trades = await Trade.findAll({ where: whereClause });
    res.json(trades);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Función universal para calcular PnL en dólares según mercado y activo
const calculatePnLInUSD = (trade) => {
  if (trade.pnl !== null && trade.pnl !== undefined && !isNaN(parseFloat(trade.pnl))) {
    return parseFloat(trade.pnl);
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
    if (asset.includes('MES') || asset.includes('MICRO S&P')) mult = 5;
    else if (asset.includes('(ES)') || asset.includes('S&P') || asset === 'ES' || asset.startsWith('ES1!')) mult = 50;
    else if (asset.includes('MNQ') || asset.includes('MICRO NASDAQ')) mult = 2;
    else if (asset.includes('(NQ)') || asset.includes('NASDAQ') || asset === 'NQ' || asset.startsWith('NQ1!')) mult = 20;
    else if (asset.includes('MYM') || asset.includes('MICRO DOW')) mult = 0.5;
    else if (asset.includes('(YM)') || asset.includes('DOW') || asset === 'YM' || asset.startsWith('YM1!')) mult = 5;
    else if (asset.includes('M2K') || asset.includes('MICRO RUSSELL')) mult = 5;
    else if (asset.includes('(RTY)') || asset.includes('RUSSELL') || asset === 'RTY') mult = 50;
    else if (asset.includes('MCL') || asset.includes('MICRO PETR') || asset.includes('MICRO OIL') || asset.includes('MICRO CRUDE')) mult = 100;
    else if (asset.includes('(CL)') || asset.includes('PETR') || asset === 'CL' || asset.includes('USOIL')) mult = 1000;
    else if (asset.includes('MGC') || asset.includes('MICRO ORO') || asset.includes('MICRO GOLD')) mult = 10;
    else if (asset.includes('(GC)') || asset.includes('ORO') || asset.includes('GOLD') || asset === 'GC' || asset.includes('XAU')) mult = 100;
    else if (asset.includes('(SI)') || asset.includes('PLATA') || asset === 'SI' || asset.includes('XAG')) mult = 5000;
    else if (asset.includes('(NG)') || asset === 'NG') mult = 10000;
    else if (asset.includes('(HG)') || asset === 'HG') mult = 25000;
    else if (asset.includes('(ZB)') || asset === 'ZB') mult = 1000;
    else if (asset.includes('(6E)') || asset === '6E') mult = 125000;
    else if (asset.includes('(6J)') || asset === '6J') mult = 125000;
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

    const fxRates = {
      'JPY': 158.2, 'CHF': 0.892, 'CAD': 1.425, 'MXN': 19.5, 'ZAR': 18.2, 'TRY': 34.2,
      'SEK': 10.6, 'NOK': 10.85, 'GBP': 1.323, 'EUR': 1.12, 'AUD': 0.6988, 'NZD': 0.605
    };
    if (quote && fxRates[quote]) {
      const direct = ['GBP', 'EUR', 'AUD', 'NZD'].includes(quote);
      const inUSD = direct ? (rawQuote * fxRates[quote]) : (rawQuote / fxRates[quote]);
      return parseFloat(inUSD.toFixed(2));
    }

    if (asset.includes('JPY')) return parseFloat((rawQuote / 152.0).toFixed(2));
    if (asset.includes('GBP')) return parseFloat((rawQuote * 1.28).toFixed(2));
    if (asset.includes('EUR')) return parseFloat((rawQuote * 1.08).toFixed(2));
    return parseFloat(rawQuote.toFixed(2));
  }

  return parseFloat((diff * volume * direction).toFixed(2));
};

const addTrade = async (req, res) => {
  try {
    const { accountId, entry_price, exit_price, volume, emotion_state, trade_type, market_type, asset, duration, trading_style, instrument_type, status, stop_loss, take_profit, risk_percentage, payout_percentage, pnl, screenshot, confluences, notes } = req.body;
    
    if (!accountId) {
      return res.status(400).json({ message: 'Se requiere especificar la cuenta de trading (accountId)' });
    }

    // Auto-calcular PnL si no viene especificado
    let calculatedPnl = pnl;
    if (calculatedPnl === null || calculatedPnl === undefined || calculatedPnl === '') {
      calculatedPnl = calculatePnLInUSD({ entry_price, exit_price, volume, trade_type, market_type, asset, payout_percentage });
    }

    let calculatedStatus = status || 'Abierta';
    if ((calculatedStatus === 'Abierta' || !calculatedStatus) && calculatedPnl !== null && calculatedPnl !== undefined) {
      if (calculatedPnl > 0) calculatedStatus = 'Ganada';
      else if (calculatedPnl < 0) calculatedStatus = 'Perdida';
      else if (calculatedPnl === 0) calculatedStatus = 'Empate';
    }

    const trade = await Trade.create({
      userId: req.user.id,
      accountId,
      entry_price,
      exit_price,
      volume,
      emotion_state,
      trade_type,
      market_type,
      asset,
      duration,
      trading_style,
      instrument_type,
      status: calculatedStatus,
      stop_loss,
      take_profit,
      risk_percentage,
      payout_percentage: payout_percentage !== undefined ? payout_percentage : 85,
      pnl: calculatedPnl,
      screenshot,
      confluences,
      notes
    });
    
    res.status(201).json(trade);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateTrade = async (req, res) => {
  try {
    const tradeId = req.params.id;
    const { entry_price, exit_price, volume, emotion_state, trade_type, market_type, asset, duration, trading_style, instrument_type, status, stop_loss, take_profit, risk_percentage, payout_percentage, pnl, screenshot, confluences, notes } = req.body;

    const trade = await Trade.findOne({ where: { id_trade: tradeId, userId: req.user.id } });
    if (!trade) {
      return res.status(404).json({ message: 'Trade not found' });
    }

    trade.entry_price = entry_price !== undefined ? entry_price : trade.entry_price;
    trade.exit_price = exit_price !== undefined ? exit_price : trade.exit_price;
    trade.volume = volume !== undefined ? volume : trade.volume;
    trade.emotion_state = emotion_state || trade.emotion_state;
    trade.trade_type = trade_type || trade.trade_type;
    trade.market_type = market_type || trade.market_type;
    trade.asset = asset || trade.asset;
    trade.duration = duration !== undefined ? duration : trade.duration;
    trade.trading_style = trading_style !== undefined ? trading_style : trade.trading_style;
    trade.instrument_type = instrument_type !== undefined ? instrument_type : trade.instrument_type;
    if (status !== undefined) trade.status = status;
    trade.stop_loss = stop_loss !== undefined ? stop_loss : trade.stop_loss;
    trade.take_profit = take_profit !== undefined ? take_profit : trade.take_profit;
    trade.risk_percentage = risk_percentage !== undefined ? risk_percentage : trade.risk_percentage;
    if (payout_percentage !== undefined) trade.payout_percentage = payout_percentage;
    if (pnl !== undefined && pnl !== null && pnl !== '') {
      trade.pnl = pnl;
    } else if (trade.exit_price != null) {
      trade.pnl = calculatePnLInUSD(trade);
    }

    if (trade.pnl !== null && trade.pnl !== undefined) {
      if (trade.pnl > 0) trade.status = 'Ganada';
      else if (trade.pnl < 0) trade.status = 'Perdida';
      else if (trade.pnl === 0) trade.status = 'Empate';
    }

    if (screenshot !== undefined) trade.screenshot = screenshot;
    if (confluences !== undefined) trade.confluences = confluences;
    if (notes !== undefined) trade.notes = notes;

    await trade.save();
    res.json(trade);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteTrade = async (req, res) => {
  try {
    const tradeId = req.params.id;
    const deleted = await Trade.destroy({ where: { id_trade: tradeId, userId: req.user.id } });
    if (deleted) {
      res.json({ message: 'Trade deleted' });
    } else {
      res.status(404).json({ message: 'Trade not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Integración con Google Gemini AI (si process.env.GEMINI_API_KEY está configurado en el entorno)
async function generateGeminiCoaching(data) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const prompt = `Actúa como un Auditor Senior de Trading y Psicología Financiera.
Analiza la siguiente información verídica y cuantitativa de la cuenta del trader:
- Cuenta: ${data.accountName} (${data.marketType})
- Balance Inicial: $${data.initialBalance} USD
- Capital Actual: $${data.currentBalance} USD (PnL Neto: ${data.netPnL >= 0 ? '+' : ''}$${data.netPnL} USD, ROI: ${data.roi}%)
- Operaciones Registradas: ${data.totalTrades} (Ganadas: ${data.winningTrades}, Perdidas: ${data.losingTrades}, Win Rate: ${data.winRate}%, Profit Factor: ${data.profitFactor})
- Índice de Disciplina Calculado: ${data.disciplineScore}/100
- Fuga de Capital por Indisciplina: -$${data.undisciplinedLoss} USD
- Arquetipo Cuantitativo Detectado: "${data.archetypeTitle}" (${data.archetypeSubtitle})
- Sesgos Detectados: ${data.biasesNotes}

Instrucciones:
1. Genera una síntesis narrativa profesional (summary) de 2 a 3 párrafos concisos (puedes usar etiquetas <strong> para resaltar datos clave), evaluando con rigor si el trader tiene ventaja estadística o fallas conductuales.
2. Genera 4 prescripciones tácticas (prescriptions) ejecutables (1 oración cada una, comenzando con un emoji relevante).

Responde estrictamente en formato JSON válido con las llaves "summary" y "prescriptions":
{
  "summary": "...",
  "prescriptions": ["...", "...", "...", "..."]
}`;

    const modelsToTry = ['gemini-3.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-1.5-flash'];
    for (const model of modelsToTry) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json" }
          })
        });

        if (res.ok) {
          const json = await res.json();
          const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            console.log(`[IA Audit] Gemini response received successfully using model: ${model}`);
            const parsed = JSON.parse(text);
            parsed.modelUsed = model;
            return parsed;
          }
        }
      } catch (innerErr) {
        console.warn(`[IA Audit] Model ${model} failed, trying next:`, innerErr.message);
      }
    }
  } catch (err) {
    console.warn('Gemini API call skipped or failed:', err.message);
  }
  return null;
}

const getMetrics = async (req, res) => {
  try {
    const { accountId } = req.query;
    const whereClause = { userId: req.user.id };
    let account = null;
    if (accountId) {
      whereClause.accountId = accountId;
      account = await TradingAccount.findOne({ where: { id_account: accountId, userId: req.user.id } });
    }
    const trades = await Trade.findAll({ 
      where: whereClause,
      order: [['createdAt', 'ASC']]
    });
    
    let totalTrades = trades.length;
    let closedTrades = 0;
    let openTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;
    let grossProfit = 0;
    let grossLoss = 0;
    let totalPnL = 0;
    
    const initialCapital = account ? parseFloat(account.balance) : 10000;
    let currentCapital = initialCapital;
    let maxCapital = initialCapital;
    let maxDrawdown = 0;
    let winAmounts = [];
    let lossAmounts = [];

    trades.forEach(trade => {
      const profitLoss = calculatePnLInUSD(trade);

      if (profitLoss !== null && !isNaN(profitLoss)) {
        closedTrades++;
        totalPnL += profitLoss;
        currentCapital += profitLoss;

        if (profitLoss > 0) {
          winningTrades++;
          grossProfit += profitLoss;
          winAmounts.push(profitLoss);
        } else if (profitLoss < 0) {
          losingTrades++;
          const absLoss = Math.abs(profitLoss);
          grossLoss += absLoss;
          lossAmounts.push(absLoss);
        } else {
          breakevenTrades++;
        }

        if (currentCapital > maxCapital) {
          maxCapital = currentCapital;
        }

        const drawdown = maxCapital > 0 ? ((maxCapital - currentCapital) / maxCapital) * 100 : 0;
        if (drawdown > maxDrawdown) {
          maxDrawdown = drawdown;
        }
      } else {
        openTrades++;
      }
    });

    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99 : 0);
    const avgWin = winAmounts.length > 0 ? (winAmounts.reduce((a, b) => a + b, 0) / winAmounts.length) : 0;
    const avgLoss = lossAmounts.length > 0 ? (lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length) : 0;
    const payoffRatio = avgLoss > 0 ? (avgWin / avgLoss) : (avgWin > 0 ? avgWin : 1);
    const roiPercentage = initialCapital > 0 ? (totalPnL / initialCapital) * 100 : 0;

    res.json({
      account: account ? {
        id_account: account.id_account,
        name: account.name,
        market_type: account.market_type,
        initialBalance: initialCapital
      } : null,
      totalTrades,
      closedTrades,
      openTrades,
      winningTrades,
      losingTrades,
      breakevenTrades,
      initialCapital: parseFloat(initialCapital.toFixed(2)),
      currentCapital: parseFloat(currentCapital.toFixed(2)),
      totalPnL: parseFloat(totalPnL.toFixed(2)),
      roiPercentage: parseFloat(roiPercentage.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      grossLoss: parseFloat(grossLoss.toFixed(2)),
      avgWin: parseFloat(avgWin.toFixed(2)),
      avgLoss: parseFloat(avgLoss.toFixed(2)),
      payoffRatio: parseFloat(payoffRatio.toFixed(2)),
      winRate: winRate.toFixed(1),
      profitFactor: profitFactor >= 99 ? '99.00' : profitFactor.toFixed(2),
      maxDrawdown: maxDrawdown.toFixed(2)
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getPsychologicalAnalysis = async (req, res) => {
  try {
    const { accountId } = req.query;
    const whereClause = { userId: req.user.id };
    let account = null;
    if (accountId) {
      whereClause.accountId = accountId;
      account = await TradingAccount.findOne({ where: { id_account: accountId, userId: req.user.id } });
    }
    const trades = await Trade.findAll({ 
      where: whereClause,
      order: [['createdAt', 'ASC']]
    });

    const initialCapital = account ? parseFloat(account.balance) : 10000;

    if (trades.length === 0) {
      return res.json({
        hasData: true,
        isInitial: true,
        isAiPowered: false,
        engine: 'Motor Cuantitativo & Finanzas Conductuales',
        accountInfo: account ? {
          id_account: account.id_account,
          name: account.name,
          market_type: account.market_type,
          initialBalance: initialCapital,
          currentBalance: initialCapital,
          netPnL: 0,
          roiPercentage: 0
        } : null,
        tradesSummary: {
          totalTrades: 0,
          closedTrades: 0,
          openTrades: 0,
          winningTrades: 0,
          losingTrades: 0,
          breakevenTrades: 0,
          winRate: 0,
          profitFactor: 0
        },
        archetype: {
          title: 'Estratega Disciplinado',
          emoji: '⛩️',
          subtitle: 'Disciplina inicial intacta (100% de cumplimiento)',
          description: `Tu cuenta ${account ? `"${account.name}"` : ''} inicia con una hoja en blanco y 100% de disciplina mental. Tu capital ($${initialCapital.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD) está blindado y tus reglas listas para ejecutar. Mantén este estándar impecable colocando Stop Loss técnico y respetando el riesgo por operación desde tu primer trade.`
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
          },
          {
            name: 'Sobreconfianza en Rachas Ganadoras',
            severity: 0,
            costUSD: 0,
            detected: false,
            tip: 'Mantén un tamaño de posición consistente independientemente de cuántas operaciones seguidas ganes.'
          }
        ],
        financialImpact: {
          disciplinedPnL: 0,
          undisciplinedLoss: 0,
          potentialSavings: 0
        },
        emotionStats: [],
        prescriptions: [
          '⛩️ <strong>Disciplina Inicial al 100%:</strong> Inicias con el índice de disciplina perfecto. Tu objetivo profesional es protegerlo trade a trade.',
          '🛡️ <strong>Regla del Stop Loss Técnico:</strong> Toda orden debe ingresar al mercado con su nivel de invalidación definido previamente.',
          '📐 <strong>Filtro de Confluencias:</strong> Espera pacientemente que el precio visite tu zona operativa clave.',
          '🧘 <strong>Aceptación Probabilística:</strong> Evalúa tu jornada por el porcentaje de disciplina operativa, no por el dinero diario.'
        ],
        aiSummary: `Bienvenido al <strong>Auditor Cuantitativo y de Psicología Operativa</strong>. La cuenta ${account ? `<strong>"${account.name}"</strong>` : ''} inicia con un índice de disciplina mental del <strong>100/100</strong> y $0.00 de fuga de capital. Tu ventaja estadística se forja respetando tu plan desde la primera operación.`
      });
    }

    let totalTrades = trades.length;
    let closedTrades = 0;
    let openTrades = 0;
    let winningTrades = 0;
    let losingTrades = 0;
    let breakevenTrades = 0;

    let slSetCount = 0;
    let safeRiskCount = 0;
    let confluencesCount = 0;

    let revengeTradesCount = 0;
    let revengeLossTotal = 0;
    let fomoTradesCount = 0;
    let fomoLossTotal = 0;
    let overconfidenceTradesCount = 0;

    let grossProfit = 0;
    let grossLoss = 0;
    let netPnL = 0;
    let disciplinedPnL = 0;
    let undisciplinedLoss = 0;

    let winAmounts = [];
    let lossAmounts = [];
    let emotionCounts = {};

    for (let i = 0; i < trades.length; i++) {
      const current = trades[i];
      const pnl = calculatePnLInUSD(current);

      if (pnl !== null && !isNaN(pnl)) {
        closedTrades++;
        netPnL += pnl;
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
      } else {
        openTrades++;
      }

      // Registro de emociones
      const emo = current.emotion_state || 'Calma';
      if (!emotionCounts[emo]) {
        emotionCounts[emo] = { count: 0, wins: 0, pnl: 0 };
      }
      emotionCounts[emo].count++;
      if (pnl !== null && !isNaN(pnl)) {
        if (pnl > 0) emotionCounts[emo].wins++;
        emotionCounts[emo].pnl += pnl;
      }

      // 1. Verificación de Stop Loss
      const hasSL = (current.stop_loss !== null && current.stop_loss !== undefined && parseFloat(current.stop_loss) > 0);
      if (hasSL) {
        slSetCount++;
      } else {
        fomoTradesCount++;
        if (pnl !== null && pnl < 0) {
          fomoLossTotal += Math.abs(pnl);
        }
      }

      // 2. Gestión de Riesgo (institucional: <= 2.5%)
      const risk = (current.risk_percentage !== null && current.risk_percentage !== undefined && !isNaN(parseFloat(current.risk_percentage)))
        ? parseFloat(current.risk_percentage)
        : 1.0;
      const isSafeRisk = (risk <= 2.5);
      if (isSafeRisk) {
        safeRiskCount++;
      }

      // 3. Confluencias registradas
      if (current.confluences && current.confluences.trim().length > 0) {
        confluencesCount++;
      }

      // 4. Detección Inteligente de Revenge Trading (Venganza)
      let isRevenge = false;
      if (i > 0) {
        const prev = trades[i - 1];
        const prevPnl = calculatePnLInUSD(prev);
        if (prevPnl !== null && prevPnl < 0) {
          const timeDiffMinutes = (new Date(current.createdAt).getTime() - new Date(prev.createdAt).getTime()) / (1000 * 60);
          const volumeIncreased = current.volume && prev.volume && (parseFloat(current.volume) > parseFloat(prev.volume) * 1.25);
          const isNegativeEmo = ['FOMO', 'Venganza', 'Ira', 'Frustración', 'Desquite'].includes(emo);

          if (timeDiffMinutes >= 0 && timeDiffMinutes < 20 && (volumeIncreased || !isSafeRisk || !hasSL || isNegativeEmo)) {
            isRevenge = true;
            revengeTradesCount++;
            if (pnl !== null && pnl < 0) {
              revengeLossTotal += Math.abs(pnl);
            }
          }
        }
      }

      // 5. Sobreconfianza en rachas
      if (i >= 2) {
        const prev1Pnl = calculatePnLInUSD(trades[i - 1]);
        const prev2Pnl = calculatePnLInUSD(trades[i - 2]);
        if (prev1Pnl !== null && prev1Pnl > 0 && prev2Pnl !== null && prev2Pnl > 0) {
          if (!isSafeRisk || (trades[i - 1].volume && parseFloat(current.volume) > parseFloat(trades[i - 1].volume) * 1.4)) {
            overconfidenceTradesCount++;
          }
        }
      }

      // 6. Contabilización de Fuga de Capital por Indisciplina (USD)
      if (pnl !== null && !isNaN(pnl)) {
        if (pnl < 0) {
          if (!hasSL || !isSafeRisk || isRevenge) {
            undisciplinedLoss += Math.abs(pnl);
          } else {
            disciplinedPnL += pnl;
          }
        } else {
          disciplinedPnL += pnl;
        }
      }
    }

    const winRate = closedTrades > 0 ? (winningTrades / closedTrades) * 100 : 0;
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss) : (grossProfit > 0 ? 99 : 1);
    const avgWin = winAmounts.length > 0 ? (winAmounts.reduce((a, b) => a + b, 0) / winAmounts.length) : 0;
    const avgLoss = lossAmounts.length > 0 ? (lossAmounts.reduce((a, b) => a + b, 0) / lossAmounts.length) : 0;
    const dispositionRatio = avgLoss > 0 ? (avgWin / avgLoss) : 1;
    const currentCapital = initialCapital + netPnL;
    const roi = initialCapital > 0 ? (netPnL / initialCapital) * 100 : 0;

    const isSuperPositive = (netPnL > 0 && (winRate >= 65 || losingTrades <= 1 || profitFactor >= 2.0));

    // Cálculo Ponderado de Disciplina Mental (0 - 100)
    const slPct = totalTrades > 0 ? (slSetCount / totalTrades) : 1.0;
    const slPoints = slPct * 40;

    const riskPct = totalTrades > 0 ? (safeRiskCount / totalTrades) : 1.0;
    const riskPoints = riskPct * 35;

    const revengeRatio = totalTrades > 0 ? (revengeTradesCount / totalTrades) : 0;
    const emotionalPoints = Math.max(0, 15 - (revengeRatio * 30));

    const confRatio = totalTrades > 0 ? (confluencesCount / totalTrades) : 1.0;
    let planPoints = confRatio * 10;
    if (isSuperPositive && planPoints < 8) {
      planPoints = 10;
    }

    let calculatedDiscipline = Math.round(slPoints + riskPoints + emotionalPoints + planPoints);
    if (slSetCount === totalTrades && safeRiskCount === totalTrades && revengeTradesCount === 0) {
      calculatedDiscipline = 100;
    }
    const disciplineScore = Math.max(10, Math.min(100, calculatedDiscipline));

    // Determinar Arquetipo Psicológico
    let archetype = {
      title: 'Operador Metódico en Desarrollo',
      emoji: '🧘',
      subtitle: 'Trading estructurado con base técnica sólida',
      description: 'Muestras consistencia en la ejecución y gestión de riesgo, con un enfoque disciplinado hacia la maestría a largo plazo.'
    };

    if (isSuperPositive) {
      archetype = {
        title: 'El Francotirador de Alta Precisión',
        emoji: '🎯',
        subtitle: `Alta ventaja estadística institucional (${winRate.toFixed(0)}% Win Rate)`,
        description: `Muestras una lectura de mercado quirúrgica con balance neto de +$${netPnL.toFixed(2)} USD. ` +
          (losingTrades <= 1 
            ? `Tu única pérdida es simplemente varianza estadística normal y controlada por tu Stop Loss.` 
            : `Tus pérdidas están rigurosamente contenidas dentro de tu plan de riesgo.`)
      };
    } else if (revengeTradesCount >= 2 && revengeLossTotal > 0) {
      archetype = {
        title: 'El Gladiador Reactivo',
        emoji: '⚔️',
        subtitle: 'Vulnerable a tomar represalias contra el mercado tras una pérdida',
        description: 'Tu mayor enemigo no es el mercado sino la frustración post-pérdida. Tiendes a entrar deprisa o aumentar el lotaje para recuperar lo perdido de inmediato.'
      };
    } else if (fomoTradesCount >= Math.max(2, totalTrades * 0.4) || (slSetCount < totalTrades * 0.6)) {
      archetype = {
        title: 'El Cazador Impulsivo',
        emoji: '🦅',
        subtitle: 'Impulsado por el miedo a perder oportunidades (FOMO / Sin SL)',
        description: 'Posees agilidad para encontrar movimientos, pero te precipitas entrando sin confirmaciones técnicas o descuidando el Stop Loss por temor a que el precio se escape sin ti.'
      };
    } else if (!isSuperPositive && dispositionRatio < 0.7 && lossAmounts.length >= 3 && netPnL < 0) {
      archetype = {
        title: 'El Protector Cauteloso',
        emoji: '🛡️',
        subtitle: 'Aversión asimétrica al riesgo: corta ganancias prematuramente',
        description: 'Proteges tu capital con Stop Loss, pero la ansiedad te hace cerrar operaciones ganadoras antes de tiempo mientras dejas correr las pérdidas completas.'
      };
    } else if (overconfidenceTradesCount >= 2 && netPnL < 0) {
      archetype = {
        title: 'El Navegante Eufórico',
        emoji: '🚀',
        subtitle: 'Vulnerable a relajar el riesgo tras ganar operaciones',
        description: 'Tras victorias consecutivas relajas las reglas de lotaje, lo que suele devolver los beneficios acumulados en un solo trade.'
      };
    } else if (disciplineScore >= 80) {
      archetype = {
        title: 'El Estratega Zen',
        emoji: '⛩️',
        subtitle: 'Mentalidad institucional fría y probabilística',
        description: 'Ejecutas con serenidad, respetas tu plan de capital y aceptas las pérdidas normales como el costo natural del negocio del trading.'
      };
    }

    // Sesgos Cognitivos Cuantificados (%)
    const biases = [
      {
        name: 'Trading por Venganza (Revenge)',
        severity: totalTrades > 0 ? Math.min(100, Math.round((revengeTradesCount / totalTrades) * 100)) : 0,
        costUSD: parseFloat(revengeLossTotal.toFixed(2)),
        detected: revengeTradesCount > 0 && revengeLossTotal > 0,
        tip: (revengeTradesCount > 0 && revengeLossTotal > 0)
          ? 'Aplica una pausa obligatoria de 20 minutos tras cualquier Stop Loss.' 
          : 'Excelente temple. Mantienes la calma y evitas represalias emocionales contra el mercado.'
      },
      {
        name: 'FOMO (Entradas Impulsivas / Sin SL)',
        severity: totalTrades > 0 ? Math.min(100, Math.round((fomoTradesCount / totalTrades) * 100)) : 0,
        costUSD: parseFloat(fomoLossTotal.toFixed(2)),
        detected: fomoTradesCount > 0 && fomoLossTotal > 0,
        tip: (fomoTradesCount > 0 && fomoLossTotal > 0)
          ? 'Si el precio ya despegó, no persigas. Entra siempre con Stop Loss técnico.' 
          : 'Cero entradas sin protección. Tu rigor con el Stop Loss es óptimo.'
      },
      {
        name: 'Efecto Disposición (Aversión al Riesgo)',
        severity: (isSuperPositive || lossAmounts.length <= 1) 
          ? 0 
          : Math.min(100, Math.round(dispositionRatio < 1 ? (1 - dispositionRatio) * 100 : 10)),
        costUSD: 0,
        detected: (!isSuperPositive && lossAmounts.length >= 3 && dispositionRatio < 0.7),
        tip: (isSuperPositive || lossAmounts.length <= 1)
          ? 'Tus ratios son saludables y la cuenta avanza en terreno positivo. Deja correr tus Take Profits.'
          : 'Permite que el precio alcance tu Take Profit técnico; no cierres manualmente por miedo a perder lo ganado.'
      },
      {
        name: 'Sobreconfianza en Rachas',
        severity: totalTrades > 0 ? Math.min(100, Math.round((overconfidenceTradesCount / totalTrades) * 100)) : 0,
        costUSD: 0,
        detected: overconfidenceTradesCount > 0 && !isSuperPositive,
        tip: 'Mantén un lotaje fijo idéntico independientemente de cuántas operaciones seguidas ganes.'
      }
    ];

    // Prescripciones Psicológicas y Conductuales
    const prescriptions = [];
    if (isSuperPositive) {
      prescriptions.push(`🎯 <strong>Edge Estadístico Comprobado:</strong> Tu sistema genera valor (+${netPnL.toFixed(2)} USD). La consistencia reside en no modificar las reglas cuando ganas.`);
      prescriptions.push(losingTrades <= 1 
        ? '🧘 <strong>Pérdidas como Costo Operativo:</strong> Tu pérdida individual es matemáticamente normal. En el trading profesional, tener un 10-25% de pérdidas es un estándar de élite institucional.'
        : '🛡️ <strong>Preservación de Ganancias:</strong> Protege tus beneficios acumulados manteniendo el riesgo strictly &le; 2% por trade.');
      prescriptions.push('🛡️ <strong>Blindaje contra la Euforia:</strong> En rachas ganadoras, resiste la tentación de sobreapalancarte creyendo que el mercado no puede fallar.');
      prescriptions.push('⛩️ <strong>Enfoque en Proceso:</strong> Evalúa tu sesión por tu porcentaje de disciplina operativa. El dinero es la consecuencia natural de la maestría mental.');
    } else {
      if (revengeTradesCount > 0) {
        prescriptions.push('🛡️ <strong>Regla del Enfriamiento:</strong> Cierra el gráfico y aléjate de la pantalla mínimo 20 minutos tras tocar un Stop Loss.');
      }
      if (fomoTradesCount > 0) {
        prescriptions.push('📐 <strong>Regla del Gatillo Técnico:</strong> Exige un mínimo de 2 confluencias verificables antes de pulsar comprar o vender.');
      }
      if (dispositionRatio < 0.7 && lossAmounts.length >= 2) {
        prescriptions.push('🎯 <strong>Ratio Asimétrico Favorable:</strong> No aceptes trades con ratio inferior a 1:1.5. Mover a Break Even en 1:1 protege la psicología.');
      }
      prescriptions.push('🧘 <strong>Enfoque en Proceso:</strong> Evalúa tu sesión por tu porcentaje de disciplina operativa, no por el dinero diario.');
    }

    let aiSummary = '';
    let isAiPowered = false;
    let engine = 'Motor Cuantitativo & Finanzas Conductuales';

    // Generación de IA Real si process.env.GEMINI_API_KEY está configurado
    const geminiResult = await generateGeminiCoaching({
      accountName: account?.name || 'General',
      marketType: account?.market_type || 'General',
      initialBalance: initialCapital.toFixed(2),
      currentBalance: currentCapital.toFixed(2),
      netPnL: netPnL.toFixed(2),
      roi: roi.toFixed(2),
      totalTrades,
      winningTrades,
      losingTrades,
      winRate: winRate.toFixed(1),
      profitFactor: profitFactor.toFixed(2),
      disciplineScore,
      undisciplinedLoss: undisciplinedLoss.toFixed(2),
      archetypeTitle: archetype.title,
      archetypeSubtitle: archetype.subtitle,
      biasesNotes: biases.map(b => `${b.name}: ${b.severity}% severidad`).join(', ')
    });

    if (geminiResult && geminiResult.summary && Array.isArray(geminiResult.prescriptions)) {
      aiSummary = geminiResult.summary;
      prescriptions.length = 0;
      prescriptions.push(...geminiResult.prescriptions);
      isAiPowered = true;
      engine = `Google Gemini AI (${geminiResult.modelUsed || 'Generativa'})`;
    } else {
      // Síntesis Cuantitativa Heurística estructurada y honesta
      if (isSuperPositive) {
        aiSummary = `Auditoría cuantitativa de la cuenta <strong>"${account?.name || 'Principal'}"</strong> sobre <strong>${totalTrades}</strong> operaciones ejecutadas. ` +
          `La cuenta presenta un balance de <strong>$${currentCapital.toFixed(2)} USD</strong> (PnL neto: <strong>${netPnL >= 0 ? '+' : ''}$${netPnL.toFixed(2)} USD</strong> | ROI: <strong>${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%</strong>) ` +
          `con una efectividad del <strong>${winRate.toFixed(1)}%</strong> (${winningTrades} ganadas, ${losingTrades} perdidas, Factor de Beneficio: <strong>${profitFactor >= 99 ? '99.00' : profitFactor.toFixed(2)}</strong>). ` +
          (losingTrades === 1 
            ? `La única pérdida registrada fue asumida con Stop Loss técnico como parte del costo operativo natural de tu ventaja probabilística. ` 
            : (losingTrades === 0 
              ? `¡Racha perfecta con cero pérdidas en el historial! ` 
              : `Tus pérdidas están controladas dentro de los márgenes previstos de riesgo. `)) +
          `Tu índice de disciplina operativa es de <strong>${disciplineScore}/100</strong>. ` +
          (undisciplinedLoss === 0 
            ? `<strong>Cero fuga de capital por indisciplina</strong>: mantén este estándar de ejecución sistemática para sostener el crecimiento a largo plazo.` 
            : `Se detectó una fuga menor de <strong>-$${undisciplinedLoss.toFixed(2)} USD</strong> en operaciones fuera de plan que puedes pulir fácilmente.`);
      } else {
        aiSummary = `Auditoría cuantitativa de la cuenta <strong>"${account?.name || 'Principal'}"</strong> sobre <strong>${totalTrades}</strong> operaciones registradas. ` +
          `Tu perfil operativo predominante es <strong>"${archetype.title}"</strong> (${archetype.subtitle}). ` +
          `La cuenta registra un balance de <strong>$${currentCapital.toFixed(2)} USD</strong> (PnL neto: <strong>${netPnL >= 0 ? '+' : ''}$${netPnL.toFixed(2)} USD</strong> | ROI: <strong>${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%</strong>) con Win Rate del <strong>${winRate.toFixed(1)}%</strong>. ` +
          `Tu índice de disciplina mental es de <strong>${disciplineScore}/100</strong>. ` +
          (undisciplinedLoss > 0 
            ? `Se ha cuantificado una fuga monetaria de aproximadamente <strong>-$${undisciplinedLoss.toFixed(2)} USD</strong> atribuible a entradas sin Stop Loss o exceso de apalancamiento fuera de plan. ` 
            : `No se registran fugas de capital por indisciplina; tus pérdidas han respetado el plan de riesgo. `) +
          `Alineando tus entradas estrictamente con tus confluencias técnicas comprobadas, tu rentabilidad se consolidará de manera consistente.`;
      }
    }

    res.json({
      hasData: true,
      isAiPowered,
      engine,
      accountInfo: {
        id_account: account?.id_account || null,
        name: account?.name || 'Cuenta General',
        market_type: account?.market_type || 'General',
        initialBalance: initialCapital,
        currentBalance: parseFloat(currentCapital.toFixed(2)),
        netPnL: parseFloat(netPnL.toFixed(2)),
        roiPercentage: parseFloat(roi.toFixed(2))
      },
      tradesSummary: {
        totalTrades,
        closedTrades,
        openTrades,
        winningTrades,
        losingTrades,
        breakevenTrades,
        winRate: parseFloat(winRate.toFixed(1)),
        profitFactor: parseFloat((profitFactor >= 99 ? 99 : profitFactor).toFixed(2)),
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        grossLoss: parseFloat(grossLoss.toFixed(2))
      },
      archetype,
      disciplineScore,
      biases,
      financialImpact: {
        disciplinedPnL: parseFloat(disciplinedPnL.toFixed(2)),
        undisciplinedLoss: parseFloat(undisciplinedLoss.toFixed(2)),
        potentialSavings: parseFloat(undisciplinedLoss.toFixed(2))
      },
      emotionStats: Object.keys(emotionCounts).map(k => ({
        emotion: k,
        count: emotionCounts[k].count,
        winRate: (emotionCounts[k].wins / emotionCounts[k].count) * 100,
        pnl: parseFloat(emotionCounts[k].pnl.toFixed(2))
      })).sort((a, b) => b.pnl - a.pnl),
      prescriptions,
      aiSummary
    });
  } catch (error) {
    console.error('Error in psychological analysis:', error);
    res.status(500).json({ message: 'Error analyzing psychology', error: error.message });
  }
};

const detectEmotion = async (req, res) => {
  try {
    const { trade_type, market_type, asset, stop_loss, risk_percentage, confluences, notes, accountId } = req.body;
    
    const whereClause = { userId: req.user.id };
    if (accountId) whereClause.accountId = accountId;
    
    const lastTrade = await Trade.findOne({
      where: whereClause,
      order: [['createdAt', 'DESC']]
    });

    let detected = 'Calma';
    let confidence = 85;
    let reasons = [];
    let engine = 'Motor Heurístico y Conductual';

    const notesLower = (notes || '').toLowerCase();

    // 1. Detección en notas por análisis de texto de palabras clave conductuales
    if (notesLower.includes('fomo') || notesLower.includes('escapa') || notesLower.includes('tarde') || notesLower.includes('apresurad') || notesLower.includes('perder')) {
      detected = 'FOMO';
      confidence = 92;
      reasons.push('Tus notas contienen expresiones de urgencia o temor a perder el movimiento.');
    } else if (notesLower.includes('recuperar') || notesLower.includes('venganza') || notesLower.includes('rabia') || notesLower.includes('enojo') || notesLower.includes('desquite')) {
      detected = 'FOMO';
      confidence = 94;
      reasons.push('Detección de frustración o intención de recuperar pérdidas.');
    } else if (notesLower.includes('miedo') || notesLower.includes('duda') || notesLower.includes('insegur') || notesLower.includes('asust')) {
      detected = 'Miedo';
      confidence = 90;
      reasons.push('Mencionas inseguridad o temor ante el riesgo de la operación.');
    } else if (notesLower.includes('seguro') || notesLower.includes('perfecto') || notesLower.includes('ganada') || notesLower.includes('facil')) {
      detected = 'Confianza';
      confidence = 88;
      reasons.push('Expresas alta certidumbre técnica en la entrada.');
    }

    // 2. Detección por contexto de la última operación
    if (lastTrade) {
      const lastPnl = calculatePnLInUSD(lastTrade);
      const minutesSinceLast = (Date.now() - new Date(lastTrade.createdAt).getTime()) / (1000 * 60);

      if (lastPnl !== null && lastPnl < 0 && minutesSinceLast < 25) {
        detected = 'FOMO';
        confidence = 90;
        reasons.push(`Operación iniciada apenas ${Math.round(minutesSinceLast)} min después de un Stop Loss.`);
      }
    }

    // 3. Detección por parámetros técnicos del trade
    if (!stop_loss || stop_loss <= 0) {
      if (detected !== 'FOMO') {
        detected = 'FOMO';
        confidence = 85;
      }
      reasons.push('Entrada sin Stop Loss definido (señal de impulsividad o negación del riesgo).');
    }

    const risk = parseFloat(risk_percentage) || 1;
    if (risk > 2.5) {
      detected = 'Codicia';
      confidence = 89;
      reasons.push(`Riesgo elevado (${risk}%), superando el límite prudente del 2%.`);
    }

    // Si tiene confluencias sólidas y riesgo prudente
    if (confluences && confluences.split(',').length >= 2 && risk <= 1.5 && stop_loss > 0) {
      detected = reasons.length === 0 ? 'Calma' : detected;
      if (reasons.length === 0) {
        reasons.push('Plan estructurado: múltiples confluencias técnicas y gestión de riesgo conservadora.');
      }
    }

    if (reasons.length === 0) {
      reasons.push('Parámetros dentro del promedio operativo estándar.');
    }

    res.json({
      emotion: detected,
      confidence,
      reason: reasons.join(' '),
      engine
    });
  } catch (error) {
    console.error('Error detecting emotion:', error);
    res.status(500).json({ message: 'Error detecting emotion', error: error.message });
  }
};

module.exports = {
  getTrades,
  addTrade,
  updateTrade,
  deleteTrade,
  getMetrics,
  getPsychologicalAnalysis,
  detectEmotion
};
