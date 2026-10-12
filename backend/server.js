const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const tradeRoutes = require('./routes/tradeRoutes');
const accountRoutes = require('./routes/accountRoutes');

// Import models to ensure they are registered with Sequelize
require('./models/User');
require('./models/TradingAccount');
require('./models/Trade');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

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

// Endpoint Proxy para obtener precios en vivo (evita CORS del frontend)
app.get('/api/price', async (req, res) => {
  const { symbol, market } = req.query;
  try {
    let querySymbol = symbol;
    
    // Adaptar símbolos para Yahoo Finance
    if (market === 'Forex' || market === 'Binarias') {
      // "EUR/USD" -> "EURUSD=X"
      querySymbol = symbol.split(' (')[0].replace('/', '') + '=X';
    } else if (market === 'Futuros') {
      // "S&P 500 (ES)" -> "ES=F"
      const match = symbol.match(/\(([^)]+)\)/);
      querySymbol = match ? match[1] + '=F' : symbol.split(' ')[0] + '=F';
    } else if (market === 'Acciones') {
      // "AAPL (Apple)" -> "AAPL"
      querySymbol = symbol.split(' ')[0];
    } else if (market === 'Cryptos') {
      // "BTC/USDT" -> "BTC-USD"
      querySymbol = symbol.split(' (')[0].replace('/', '-');
    }

    // Usar fetch nativo (Node 18+)
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${querySymbol}?interval=1m`, { signal: AbortSignal.timeout(3000) });
    const data = await response.json();
    
    if (data.chart && data.chart.result && data.chart.result.length > 0) {
      const price = data.chart.result[0].meta.regularMarketPrice;
      return res.json({ price });
    } else {
      return res.status(404).json({ error: 'Precio no encontrado' });
    }
  } catch (error) {
    console.error('Error proxying price:', error);
    res.status(500).json({ error: 'Error del servidor' });
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
