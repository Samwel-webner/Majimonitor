const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { requireAuth, requireAdmin } = require('../middleware/authMiddleware');

router.post('/register', requireAuth, requireAdmin, authController.register);
router.post('/login', authController.login);
router.get('/users', requireAuth, requireAdmin, authController.listUsers);
router.delete('/users/:id', requireAuth, requireAdmin, authController.deleteUser);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.patch('/change-password', requireAuth, authController.changePassword);

module.exports = router;