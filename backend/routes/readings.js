const express = require('express');
const router = express.Router();
const readingController = require('../controllers/readingController');

// Sensor data comes in here - simulator now, real hardware later
router.post('/', readingController.submitReading);

router.get('/:siteId/readings/history', readingController.getHistoryForSite);

module.exports = router;
