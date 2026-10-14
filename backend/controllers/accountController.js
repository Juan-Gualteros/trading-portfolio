const TradingAccount = require('../models/TradingAccount');

const getAccounts = async (req, res) => {
  try {
    const accounts = await TradingAccount.findAll({ 
      where: { userId: req.user.id },
      order: [
        ['is_default', 'DESC'],
        ['id_account', 'ASC']
      ]
    });
    res.json(accounts);
  } catch (error) {
    console.error('Error in getAccounts:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const addAccount = async (req, res) => {
  try {
    const { name, market_type, balance, is_default } = req.body;
    
    const count = await TradingAccount.count({ where: { userId: req.user.id } });
    const shouldBeDefault = count === 0 || is_default === true || is_default === 'true' || is_default === 1;

    if (shouldBeDefault && count > 0) {
      await TradingAccount.update({ is_default: false }, { where: { userId: req.user.id } });
    }

    const account = await TradingAccount.create({
      userId: req.user.id,
      name,
      market_type,
      balance,
      is_default: shouldBeDefault
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
    const { name, market_type, balance, is_default } = req.body;

    const account = await TradingAccount.findOne({ where: { id_account: accountId, userId: req.user.id } });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    account.name = name || account.name;
    account.market_type = market_type || account.market_type;
    account.balance = balance !== undefined ? balance : account.balance;

    if (is_default === true || is_default === 'true' || is_default === 1) {
      await TradingAccount.update({ is_default: false }, { where: { userId: req.user.id } });
      account.is_default = true;
    } else if (is_default === false || is_default === 'false' || is_default === 0) {
      account.is_default = false;
    }

    await account.save();
    res.json(account);
  } catch (error) {
    console.error('Error in updateAccount:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const setDefaultAccount = async (req, res) => {
  try {
    const accountId = req.params.id;
    const account = await TradingAccount.findOne({ where: { id_account: accountId, userId: req.user.id } });
    if (!account) {
      return res.status(404).json({ message: 'Account not found' });
    }

    // Quitar marca de principal a todas las demás cuentas del usuario
    await TradingAccount.update({ is_default: false }, { where: { userId: req.user.id } });

    // Asignar esta cuenta como principal
    account.is_default = true;
    await account.save();

    res.json({ message: 'Cuenta establecida como principal exitosamente.', account });
  } catch (error) {
    console.error('Error in setDefaultAccount:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteAccount = async (req, res) => {
  try {
    const accountId = req.params.id;
    const targetAccount = await TradingAccount.findOne({ where: { id_account: accountId, userId: req.user.id } });
    if (!targetAccount) {
      return res.status(404).json({ message: 'Account not found' });
    }

    const wasDefault = targetAccount.is_default;
    await targetAccount.destroy();

    // Si se eliminó la cuenta principal, promover la primera cuenta restante como principal
    if (wasDefault) {
      const remainingAccount = await TradingAccount.findOne({ 
        where: { userId: req.user.id },
        order: [['id_account', 'ASC']]
      });
      if (remainingAccount) {
        remainingAccount.is_default = true;
        await remainingAccount.save();
      }
    }

    res.json({ message: 'Account deleted' });
  } catch (error) {
    console.error('Error in deleteAccount:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getAccounts,
  addAccount,
  updateAccount,
  setDefaultAccount,
  deleteAccount
};
