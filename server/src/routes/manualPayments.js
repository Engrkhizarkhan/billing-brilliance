const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticate, authorize, tenantScope, requireLiveTenant } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const manualPaymentController = require('../controllers/manualPaymentController');

router.use(authenticate);
router.post('/inquiry', authorize('admin'),
  body('consumerNumber').trim().matches(/^\d{1,24}$/).withMessage('Consumer number must contain 1-24 digits'),
  handleValidation, manualPaymentController.inquirePayment);
router.use(tenantScope);
router.use(requireLiveTenant);

router.post('/record', authorize('admin'), manualPaymentController.recordPayment);
router.post('/reverse', authorize('admin'), manualPaymentController.reversePayment);

module.exports = router;
