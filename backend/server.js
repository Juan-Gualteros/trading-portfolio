const express = require('express');
const cors = require('cors');
require('dotenv').config();

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const sequelize = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const accountRoutes = require('./routes/accountRoutes');

// Import models to ensure they are registered with Sequelize
require('./models/User');
require('./models/TradingAccount');
require('./models/Trade');

const app = express();

// Seguridad con Helmet (permitiendo CSP para recursos locales y cross-origin)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Rate Limiters para protección de fuerza bruta y abuso de API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.' }
});

const authLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de inicio de sesión. Por seguridad, intente en 15 minutos.' }
});

const detectEmotionLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 45,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Límite de solicitudes de análisis de emoción alcanzado. Por favor espere un momento.' }
});

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/api', apiLimiter);

app.use('/api/auth/login', authLoginLimiter);
app.use('/api/trades/detect-emotion', detectEmotionLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/trades', tradeRoutes);
app.use('/api/accounts', accountRoutes);

// Endpoint Ticker en Vivo con fallback y cache inteligente
const tickerCache = {
  data: [
    { symbol: 'BTC/USDT', name: 'Bitcoin', price: 68450.00, change: 2.35, market: 'Cryptos' },
    { symbol: 'ETH/USDT', name: 'Ethereum', price: 3540.20, change: 1.80, market: 'Cryptos' },
    { symbol: 'EUR/USD', name: 'Euro / Dólar', price: 1.0862, change: -0.12, market: 'Forex' },
    { symbol: 'GBP/USD', name: 'Libra / Dólar', price: 1.2740, change: 0.28, market: 'Forex' },
    { symbol: 'S&P 500', name: 'S&P 500', price: 5125.60, change: 0.64, market: 'Futuros' },
    { symbol: 'NASDAQ', name: 'Nasdaq 100', price: 18320.15, change: 0.95, market: 'Futuros' },
    { symbol: 'XAU/USD', name: 'Oro (Gold)', price: 2364.50, change: 0.85, market: 'Futuros' },
    { symbol: 'AAPL', name: 'Apple Inc.', price: 185.90, change: -0.34, market: 'Acciones' },
    { symbol: 'NVDA', name: 'Nvidia Corp.', price: 920.40, change: 3.12, market: 'Acciones' }
  ],
  lastFetch: 0
};

app.get('/api/market-ticker', async (req, res) => {
  const now = Date.now();
  // Refrescar cada 60 segundos si es posible
  if (now - tickerCache.lastFetch > 60000) {
    try {
      const symbolsToFetch = [
        { key: 'BTC/USDT', yKey: 'BTC-USD' },
        { key: 'ETH/USDT', yKey: 'ETH-USD' },
        { key: 'EUR/USD', yKey: 'EURUSD=X' },
        { key: 'S&P 500', yKey: 'ES=F' },
        { key: 'AAPL', yKey: 'AAPL' },
        { key: 'XAU/USD', yKey: 'GC=F' }
      ];

      for (const item of symbolsToFetch) {
        try {
          const resp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${item.yKey}?interval=1d`, { signal: AbortSignal.timeout(2000) });
          const json = await resp.json();
          if (json.chart && json.chart.result && json.chart.result[0]) {
            const meta = json.chart.result[0].meta;
            const price = meta.regularMarketPrice;
            const prevClose = meta.chartPreviousClose || price;
            const change = prevClose ? Number((((price - prevClose) / prevClose) * 100).toFixed(2)) : 0;
            const target = tickerCache.data.find(t => t.symbol === item.key);
            if (target && price) {
              target.price = price;
              target.change = change;
            }
          }
        } catch (_) {}
      }
      tickerCache.lastFetch = now;
    } catch (_) {}
  }
  
  res.json(tickerCache.data);
});

// Cache de tasas de cambio Forex interbancarias (BCE / European Central Bank & Interbank Spot Feed - Estilo Myfxbook)
const fxRatesCache = {
  rates: {
    'USD': 1.0,
    'AUD': 0.6982,
    'EUR': 1.1206,
    'GBP': 1.3220,
    'NZD': 0.5612,
    'JPY': 158.25,
    'CAD': 1.4226,
    'CHF': 0.8310,
    'MXN': 19.50,
    'ZAR': 18.20,
    'TRY': 34.20,
    'SEK': 10.60,
    'NOK': 10.85
  },
  lastFetch: 0,
  provider: 'Banco Central Europeo (BCE) / Interbancario'
};

app.get('/api/fx-rates', async (req, res) => {
  const now = Date.now();
  if (now - fxRatesCache.lastFetch > 120000) {
    try {
      // 1. Fuente Primaria: Banco Central Europeo (Frankfurter API)
      const resp = await fetch('https://api.frankfurter.app/latest?from=USD', { signal: AbortSignal.timeout(3000) });
      if (resp.ok) {
        const data = await resp.json();
        if (data.rates) {
          if (data.rates.AUD) fxRatesCache.rates['AUD'] = Number((1 / data.rates.AUD).toFixed(5));
          if (data.rates.EUR) fxRatesCache.rates['EUR'] = Number((1 / data.rates.EUR).toFixed(5));
          if (data.rates.GBP) fxRatesCache.rates['GBP'] = Number((1 / data.rates.GBP).toFixed(5));
          if (data.rates.NZD) fxRatesCache.rates['NZD'] = Number((1 / data.rates.NZD).toFixed(5));
          if (data.rates.JPY) fxRatesCache.rates['JPY'] = Number(data.rates.JPY.toFixed(4));
          if (data.rates.CAD) fxRatesCache.rates['CAD'] = Number(data.rates.CAD.toFixed(4));
          if (data.rates.CHF) fxRatesCache.rates['CHF'] = Number(data.rates.CHF.toFixed(4));
          if (data.rates.MXN) fxRatesCache.rates['MXN'] = Number(data.rates.MXN.toFixed(4));
          if (data.rates.ZAR) fxRatesCache.rates['ZAR'] = Number(data.rates.ZAR.toFixed(4));
          if (data.rates.TRY) fxRatesCache.rates['TRY'] = Number(data.rates.TRY.toFixed(4));
          if (data.rates.SEK) fxRatesCache.rates['SEK'] = Number(data.rates.SEK.toFixed(4));
          if (data.rates.NOK) fxRatesCache.rates['NOK'] = Number(data.rates.NOK.toFixed(4));
          fxRatesCache.provider = 'Banco Central Europeo (BCE - Oficial)';
          fxRatesCache.lastFetch = now;
        }
      }
    } catch (_) {
      try {
        // 2. Fuente Secundaria: Open Exchange Interbank API (Fallback oficial)
        const resp2 = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(3000) });
        if (resp2.ok) {
          const data2 = await resp2.json();
          if (data2.rates) {
            if (data2.rates.AUD) fxRatesCache.rates['AUD'] = Number((1 / data2.rates.AUD).toFixed(5));
            if (data2.rates.EUR) fxRatesCache.rates['EUR'] = Number((1 / data2.rates.EUR).toFixed(5));
            if (data2.rates.GBP) fxRatesCache.rates['GBP'] = Number((1 / data2.rates.GBP).toFixed(5));
            if (data2.rates.NZD) fxRatesCache.rates['NZD'] = Number((1 / data2.rates.NZD).toFixed(5));
            if (data2.rates.JPY) fxRatesCache.rates['JPY'] = Number(data2.rates.JPY.toFixed(4));
            if (data2.rates.CAD) fxRatesCache.rates['CAD'] = Number(data2.rates.CAD.toFixed(4));
            if (data2.rates.CHF) fxRatesCache.rates['CHF'] = Number(data2.rates.CHF.toFixed(4));
            fxRatesCache.provider = 'Open Exchange Interbank';
            fxRatesCache.lastFetch = now;
          }
        }
      } catch (_) {}
    }
  }
  res.json({ rates: fxRatesCache.rates, provider: fxRatesCache.provider, lastUpdated: new Date(fxRatesCache.lastFetch || Date.now()).toISOString() });
});

// Función para consultar cotización exacta de TradingView Scanner (coincide con la gráfica)
async function fetchTradingViewPrice(symbol, market) {
  try {
    let endpoint = 'forex';
    let tickers = [];
    const clean = symbol.split(' (')[0].replace('/', '').replace('(OTC)', '').trim().toUpperCase();

    if (market === 'Forex' || market === 'Binarias') {
      endpoint = 'forex';
      tickers = ['FX:' + clean, 'FX_IDC:' + clean, 'OANDA:' + clean];
    } else if (market === 'Cryptos') {
      endpoint = 'crypto';
      let pair = clean;
      if (!pair.endsWith('USDT') && !pair.endsWith('USD')) pair += 'USDT';
      tickers = ['BINANCE:' + pair];
    } else if (market === 'Acciones') {
      endpoint = 'america';
      tickers = ['NASDAQ:' + clean, 'NYSE:' + clean];
    } else if (market === 'Futuros') {
      endpoint = 'futures';
      const match = symbol.match(/\(([^)]+)\)/);
      const code = match ? match[1].trim() : symbol.split(' ')[0].trim();
      tickers = ['CME_MINI:' + code + '1!', 'COMEX:' + code + '1!', 'NYMEX:' + code + '1!'];
    }

    if (tickers.length === 0) return null;

    const res = await fetch('https://scanner.tradingview.com/' + endpoint + '/scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({ symbols: { tickers }, columns: ['close'] }),
      signal: AbortSignal.timeout(4000)
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (data.data && data.data.length > 0 && data.data[0].d?.[0]) {
      return { price: data.data[0].d[0], symbol: data.data[0].s, provider: 'TradingView' };
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Endpoint Proxy para obtener precios en vivo (prioriza TradingView para coincidencia idéntica)
app.get('/api/price', async (req, res) => {
  const { symbol, market } = req.query;
  if (!symbol) {
    return res.status(400).json({ error: 'Símbolo requerido' });
  }

  try {
    // 1. Intentar primero con TradingView Scanner para que el precio coincida exactamente con la gráfica
    const tvData = await fetchTradingViewPrice(symbol, market);
    if (tvData && tvData.price !== null && tvData.price !== undefined) {
      return res.json(tvData);
    }

    // 2. Fallback secundario a Yahoo Finance si TradingView Scanner no devuelve datos
    let querySymbol = symbol.trim();
    
    // Adaptar símbolos para Yahoo Finance
    if (market === 'Forex' || market === 'Binarias') {
      // "EUR/USD" o "EUR/USD (OTC)" -> "EURUSD=X"
      const clean = symbol.split(' (')[0].replace('/', '').trim().toUpperCase();
      querySymbol = clean + '=X';
    } else if (market === 'Futuros') {
      // "S&P 500 (ES)" -> "ES=F"
      const match = symbol.match(/\(([^)]+)\)/);
      querySymbol = match ? match[1].trim() + '=F' : symbol.split(' ')[0].trim() + '=F';
    } else if (market === 'Acciones') {
      // "AAPL (Apple)" -> "AAPL"
      querySymbol = symbol.split(' ')[0].trim().toUpperCase();
    } else if (market === 'Cryptos') {
      // "BTC/USDT", "BTCUSDT", "BTC" -> "BTC-USD"
      let clean = symbol.split(' (')[0].trim().toUpperCase();
      if (clean.includes('/')) {
        clean = clean.split('/')[0];
      } else if (clean.endsWith('USDT')) {
        clean = clean.replace('USDT', '');
      } else if (clean.endsWith('USD')) {
        clean = clean.replace('USD', '');
      }
      querySymbol = `${clean}-USD`;
    }

    // Usar fetch nativo (Node 18+) con User-Agent y timeout de 6 segundos
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(querySymbol)}?interval=1m`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(6000)
    });

    if (!response.ok) {
      return res.status(response.status).json({ error: `Proveedor devolvió estado ${response.status}` });
    }

    const data = await response.json();
    
    if (data.chart && data.chart.result && data.chart.result.length > 0) {
      const meta = data.chart.result[0].meta;
      const price = meta.regularMarketPrice ?? meta.chartPreviousClose ?? meta.previousClose;
      if (price !== undefined && price !== null) {
        return res.json({ price, symbol: querySymbol, provider: 'YahooFinance' });
      }
    }
    
    return res.status(404).json({ error: `Precio no encontrado para ${querySymbol}` });
  } catch (error) {
    console.error('Error proxying price:', error.message);
    res.status(500).json({ error: 'Error del servidor al obtener precio', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;

sequelize.sync().then(() => {
  console.log('Database connected and synced');
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to sync database:', err);
});
