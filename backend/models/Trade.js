const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Trade = sequelize.define('Trade', {
  id_trade: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  accountId: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  entry_price: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  exit_price: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: true,
  },
  volume: {
    type: DataTypes.DECIMAL(18, 8),
    allowNull: false,
  },
  emotion_state: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  market_type: {
    type: DataTypes.ENUM('Forex', 'Cryptos', 'Futuros', 'Acciones', 'Binarias'),
    allowNull: false,
    defaultValue: 'Cryptos'
  },
  asset: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  duration: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  trading_style: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  instrument_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'Abierta',
  },
  stop_loss: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  take_profit: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  risk_percentage: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  payout_percentage: {
    type: DataTypes.FLOAT,
    allowNull: true,
    defaultValue: 85,
  },
  pnl: {
    type: DataTypes.FLOAT,
    allowNull: true,
  },
  trade_type: {
    type: DataTypes.ENUM('LONG', 'SHORT'),
    allowNull: false,
  },
  screenshot: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  confluences: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  entry_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  exit_date: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  timestamps: true,
});

module.exports = Trade;
