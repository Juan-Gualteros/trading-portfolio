const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const User = require('./User');

const TradingAccount = sequelize.define('TradingAccount', {
  id_account: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: User,
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Mi Cuenta'
  },
  market_type: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'General'
  },
  balance: {
    type: DataTypes.FLOAT,
    defaultValue: 10000
  },
  is_default: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  timestamps: true,
});

module.exports = TradingAccount;
