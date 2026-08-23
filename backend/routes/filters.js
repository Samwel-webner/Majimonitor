const express = require('express');
const router = express.Router();
const filterController = require('../controllers/filterController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.get('/', filterController.listFilters);
router.post('/', requireAuth, requireAdmin, filterController.createFilter);
router.patch('/:id/service', requireAuth, filterController.markServiced);
router.delete('/:id', requireAuth, requireAdmin, filterController.deleteFilter);

module.exports = router;