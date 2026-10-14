const {
  calculatePnLInUSD,
  calculateTradeRiskUSD,
  calculateRMultiple,
  calculateExpectancy,
  calculateEmotionMatrix,
  calculateSessionBreakdown,
  runMonteCarloSimulation
} = require('../utils/quantitativeEngine');

describe('Suite de Pruebas Unitarias - Motor Cuantitativo y Conductual', () => {

  describe('1. Validación de calculatePnLInUSD en Múltiples Mercados', () => {
    test('Futuros CME - E-mini S&P 500 (ES) multiplicador x50', () => {
      const tradeLong = {
        market_type: 'Futuros',
        asset: 'S&P 500 (ES)',
        trade_type: 'LONG',
        entry_price: 5000,
        exit_price: 5010,
        volume: 2
      };
      // (5010 - 5000) * 2 * 50 = +1000 USD
      expect(calculatePnLInUSD(tradeLong)).toBe(1000);

      const tradeShort = {
        market_type: 'Futuros',
        asset: 'ES',
        trade_type: 'SHORT',
        entry_price: 5010,
        exit_price: 5000,
        volume: 1
      };
      // (5000 - 5010) * 1 * 50 * -1 = +500 USD
      expect(calculatePnLInUSD(tradeShort)).toBe(500);
    });

    test('Futuros CME - Micro E-mini Nasdaq (MNQ) multiplicador x2', () => {
      const trade = {
        market_type: 'Futuros',
        asset: 'MNQ',
        trade_type: 'LONG',
        entry_price: 18000,
        exit_price: 18050,
        volume: 3
      };
      // 50 pts * 3 ctr * 2 = 300 USD
      expect(calculatePnLInUSD(trade)).toBe(300);
    });

    test('Futuros NYMEX - Petróleo Crudo (CL) multiplicador x1000', () => {
      const trade = {
        market_type: 'Futuros',
        asset: 'Petróleo (CL)',
        trade_type: 'LONG',
        entry_price: 80.00,
        exit_price: 81.50,
        volume: 1
      };
      // 1.50 * 1 * 1000 = 1500 USD
      expect(calculatePnLInUSD(trade)).toBe(1500);
    });

    test('Forex - Par EUR/USD (1 lote estándar = 100,000 unidades)', () => {
      const trade = {
        market_type: 'Forex',
        asset: 'EUR/USD',
        trade_type: 'LONG',
        entry_price: 1.0800,
        exit_price: 1.0850,
        volume: 1
      };
      // 0.0050 * 1 * 100000 = 500 USD (50 pips)
      expect(calculatePnLInUSD(trade)).toBe(500);
    });

    test('Forex - Par USD/JPY con conversión de tipo de cambio', () => {
      const trade = {
        market_type: 'Forex',
        asset: 'USD/JPY',
        trade_type: 'LONG',
        entry_price: 155.00,
        exit_price: 156.00,
        volume: 1
      };
      // 1.00 * 1 * 100000 = 100,000 JPY. Dividido por tasa ~156 = ~641.03 USD
      const pnl = calculatePnLInUSD(trade);
      expect(pnl).toBeGreaterThan(600);
      expect(pnl).toBeLessThan(700);
    });

    test('Cryptos y Acciones - BTC/USDT y AAPL', () => {
      const cryptoTrade = {
        market_type: 'Cryptos',
        asset: 'BTC/USDT',
        trade_type: 'LONG',
        entry_price: 60000,
        exit_price: 63000,
        volume: 0.5
      };
      // 3000 * 0.5 = 1500 USD
      expect(calculatePnLInUSD(cryptoTrade)).toBe(1500);

      const stockTrade = {
        market_type: 'Acciones',
        asset: 'AAPL',
        trade_type: 'SHORT',
        entry_price: 180,
        exit_price: 175,
        volume: 100
      };
      // (175 - 180) * 100 * -1 = +500 USD
      expect(calculatePnLInUSD(stockTrade)).toBe(500);
    });

    test('Opciones Binarias con Payout del 85%', () => {
      const winBinary = {
        market_type: 'Binarias',
        asset: 'EUR/USD',
        trade_type: 'LONG',
        entry_price: 1.0800,
        exit_price: 1.0805,
        volume: 100,
        payout_percentage: 85
      };
      // Gana 85% de $100 = $85
      expect(calculatePnLInUSD(winBinary)).toBe(85);

      const lossBinary = {
        market_type: 'Binarias',
        asset: 'EUR/USD',
        trade_type: 'LONG',
        entry_price: 1.0800,
        exit_price: 1.0795,
        volume: 100,
        payout_percentage: 85
      };
      // Pierde la inversión = -$100
      expect(calculatePnLInUSD(lossBinary)).toBe(-100);
    });
  });

  describe('2. Expectanza Matemática ($E$) y Múltiplos R', () => {
    const mockTrades = [
      {
        market_type: 'Forex', asset: 'EUR/USD', trade_type: 'LONG',
        entry_price: 1.0800, stop_loss: 1.0780, exit_price: 1.0860, volume: 1
      }, // Risk: 20 pips = $200. PnL: 60 pips = +$600. R = +3.0R
      {
        market_type: 'Forex', asset: 'EUR/USD', trade_type: 'LONG',
        entry_price: 1.0800, stop_loss: 1.0780, exit_price: 1.0780, volume: 1
      }, // Risk: 20 pips = $200. PnL: -20 pips = -$200. R = -1.0R
      {
        market_type: 'Forex', asset: 'EUR/USD', trade_type: 'LONG',
        entry_price: 1.0800, stop_loss: 1.0780, exit_price: 1.0840, volume: 1
      }  // Risk: 20 pips = $200. PnL: 40 pips = +$400. R = +2.0R
    ];

    test('Cálculo correcto de R-Multiple para trade individual', () => {
      const r = calculateRMultiple(mockTrades[0], 10000);
      expect(r).toBe(3);
    });

    test('Expectanza matemática positiva con ventaja estadística', () => {
      const exp = calculateExpectancy(mockTrades, 10000);
      expect(exp.closedTrades).toBe(3);
      expect(exp.winRatePct).toBeCloseTo(66.7, 1);
      expect(exp.expectancyUSD).toBeGreaterThan(0);
      expect(exp.expectancyR).toBeGreaterThan(0.5);
      expect(exp.qualityLabel).toContain('Elite Edge');
    });
  });

  describe('3. Matriz Empírica de Correlación Emoción vs. PnL', () => {
    const emotionTrades = [
      { emotion_state: 'Calma', pnl: 500, stop_loss: 100 },
      { emotion_state: 'Calma', pnl: 300, stop_loss: 100 },
      { emotion_state: 'Calma', pnl: -150, stop_loss: 100 },
      { emotion_state: 'FOMO', pnl: -600, stop_loss: null },
      { emotion_state: 'FOMO', pnl: -400, stop_loss: null },
      { emotion_state: 'FOMO', pnl: 100, stop_loss: null }
    ];

    test('Genera estadísticas cruzadas y detecta degradación de Win Rate bajo FOMO', () => {
      const res = calculateEmotionMatrix(emotionTrades);
      expect(res.matrix.length).toBe(2);
      
      const calma = res.matrix.find(m => m.emotion === 'Calma');
      const fomo = res.matrix.find(m => m.emotion === 'FOMO');
      
      expect(calma.totalPnL).toBe(650);
      expect(fomo.totalPnL).toBe(-900);
      expect(calma.winRate).toBeGreaterThan(fomo.winRate);
      expect(res.comparativeInsights.length).toBeGreaterThan(0);
      expect(res.comparativeInsights[0].insight).toContain('FOMO');
    });
  });

  describe('4. Desglose de Rendimiento por Sesión y Fatiga Horaria', () => {
    test('Clasifica correctamente las sesiones globales y detecta fatiga vespertina', () => {
      const sessionTrades = [
        // 09:00 EST (Nueva York) -> UTC 14:00
        { createdAt: '2026-03-15T14:00:00Z', pnl: 400, stop_loss: 50 },
        // 10:00 EST (Nueva York) -> UTC 15:00
        { createdAt: '2026-03-15T15:00:00Z', pnl: 200, stop_loss: 50 },
        // 15:00 EST (Post 2 PM) -> UTC 20:00 - Pérdida severa
        { createdAt: '2026-03-15T20:00:00Z', pnl: -500, stop_loss: null },
        // 16:00 EST (Post 2 PM) -> UTC 21:00 - Pérdida severa
        { createdAt: '2026-03-15T21:00:00Z', pnl: -300, stop_loss: null }
      ];

      const res = calculateSessionBreakdown(sessionTrades);
      expect(res.sessions.length).toBe(4);
      expect(res.fatigueAlerts.length).toBeGreaterThan(0);
      expect(res.fatigueAlerts[0].message).toContain('después de las 2:00 PM EST');
    });
  });

  describe('5. Simulador de Monte Carlo y Riesgo de Ruina', () => {
    test('Genera 1,000 curvas proyectadas y calcula métricas de ruina', () => {
      const trades = [
        { pnl: 250 }, { pnl: -100 }, { pnl: 300 }, { pnl: -150 }, { pnl: 400 }
      ];
      const mc = runMonteCarloSimulation(trades, 10000, 500, 50);
      
      expect(mc.numSimulations).toBe(500);
      expect(mc.projectedEquityCurves.length).toBe(51);
      expect(mc.sampleTrajectories.length).toBe(5);
      expect(typeof mc.riskOfRuinPct).toBe('number');
      expect(mc.riskOfRuinPct).toBeLessThanOrEqual(100);
      expect(mc.interpretation).toBeDefined();
    });
  });

});
