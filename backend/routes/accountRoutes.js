const express = require('express');
const router = express.Router();
const { getAccounts, addAccount, updateAccount, deleteAccount } = require('../controllers/accountController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', getAccounts);
router.post('/', addAccount);
router.put('/:id', updateAccount);
router.delete('/:id', deleteAccount);

module.exports = router;
