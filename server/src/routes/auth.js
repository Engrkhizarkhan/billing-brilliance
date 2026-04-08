const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { loginValidation } = require('../middleware/validate');
const authController = require('../controllers/authController');

router.post('/login', loginValidation, handleValidation, authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authenticate, authController.logout);
router.get('/profile', authenticate, authController.getProfile);
router.put('/change-password', authenticate, authController.changePassword);

module.exports = router;
