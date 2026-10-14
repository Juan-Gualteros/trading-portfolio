const express = require('express');
const router = express.Router();
const { 
  getTrades, 
  addTrade, 
  updateTrade, 
  deleteTrade, 
  getMetrics,
  getPsychologicalAnalysis,
  detectEmotion,
  getQuantitativeAnalysis,
  importTradesCSV
} = require('../controllers/tradeController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/quantitative-analysis', getQuantitativeAnalysis);
router.post('/import-csv', importTradesCSV);
router.get('/psychological-analysis', getPsychologicalAnalysis);
router.post('/detect-emotion', detectEmotion);
router.get('/metrics', getMetrics);

router.get('/', getTrades);
router.post('/', addTrade);
router.put('/:id', updateTrade);
router.delete('/:id', deleteTrade);

module.exports = router;
