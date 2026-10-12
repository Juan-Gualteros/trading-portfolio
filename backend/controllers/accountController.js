const TradingAccount = require('../models/TradingAccount');

const getAccounts = async (req, res) => {
  try {
    const accounts = await TradingAccount.findAll({ where: { userId: req.user.id } });
    res.json(accounts);
  } catch (error) {
    console.error('Error in getAccounts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const addAccount = async (req, res) => {
  try {
    const { name, market_type, balance } = req.body;
    
    const account = await TradingAccount.create({
      userId: req.user.id,
      name,
      market_type,
      balance
    });
    
    res.status(201).json(account);
  } catch (error) {
    console.error('Error in addAccount:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateAccount = async (req, res) => {
  try {
    const accountId = req.params.id;
    const { name, market_type, balance } = req.body;

    const account = await TradingAccount.findOne({ where: { id_account: accountId, userId: req.user.id } });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    account.name = name || account.name;
    account.market_type = market_type || account.market_type;
    account.balance = balance !== undefined ? balance : account.balance;

    await account.save();
    res.json(account);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const accountId = req.params.id;
    const deleted = await TradingAccount.destroy({ where: { id_account: accountId, userId: req.user.id } });
    if (deleted) {
      res.json({ message: 'Account deleted' });
    } else {
      res.status(404).json({ message: 'Account not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAccounts,
  addAccount,
  updateAccount,
  deleteAccount
};
