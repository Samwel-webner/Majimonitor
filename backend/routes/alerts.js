const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');
const { requireAuth } = require('../middleware/authMiddleware');

router.get('/', alertController.listAlerts);
router.patch('/:id', requireAuth, alertController.updateAlert);
router.get('/export', alertController.exportAlertsCSV);
router.get('/trend', alertController.getAlertTrend);
router.get('/by-date', alertController.getAlertsByDate);

module.exports = router;