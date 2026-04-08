const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { createPaymentValidation, paymentCallbackValidation } = require('../middleware/validate');
const { tenantScope } = require('../middleware/auth');
const eteaPaymentController = require('../controllers/eteaPaymentController');

// Public health check
router.get('/health', eteaPaymentController.healthCheck);

// Payment endpoints (API key auth is handled inside the controller - assertSecurity)
router.post('/payments/create', authenticate, tenantScope, createPaymentValidation, handleValidation, eteaPaymentController.createPayment);
router.get('/payments/:applicationId', authenticate, eteaPaymentController.getPaymentStatus);

// Callback endpoint (webhook - uses its own security validation)
router.post('/payment/callback', paymentCallbackValidation, handleValidation, eteaPaymentController.processPaymentCallback);

// Admin endpoints
router.get('/stats', authenticate, tenantScope, eteaPaymentController.getStats);
router.get('/payments', authenticate, tenantScope, eteaPaymentController.listPayments);
router.get('/payment-notifications', authenticate, tenantScope, eteaPaymentController.listNotifications);
router.post('/payments/expire', authenticate, eteaPaymentController.expireOverduePayments);

module.exports = router;
