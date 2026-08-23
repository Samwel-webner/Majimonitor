const express = require('express');
const router = express.Router();
const parameterController = require('../controllers/parameterController');

router.get('/', parameterController.listParameters);

module.exports = router;
