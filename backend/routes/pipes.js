const express = require('express');
const router = express.Router();
const pipeController = require('../controllers/pipeController');

router.get('/', pipeController.listPipes);

module.exports = router;