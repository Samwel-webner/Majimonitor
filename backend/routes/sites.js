const express = require('express');
const router = express.Router();
const siteController = require('../controllers/siteController');
const readingController = require('../controllers/readingController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.get('/', siteController.listSites);
router.get('/:id', siteController.getSite);
router.post('/', requireAuth, requireAdmin, siteController.createSite);
router.put('/:id', requireAuth, requireAdmin, siteController.updateSite);
router.delete('/:id', requireAuth, requireAdmin, siteController.deleteSite);
router.get('/:siteId/readings/latest', readingController.getLatestForSite);
router.get('/:siteId/readings/history', readingController.getHistoryForSite);
router.get('/:siteId/readings/export', readingController.exportReadingsCSV);

module.exports = router;