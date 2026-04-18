const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { createPaymentValidation, paymentCallbackValidation } = require('../middleware/validate');
const { tenantScope } = require('../middleware/auth');
const orgPaymentController = require('../controllers/orgPaymentController');

// Public health check
router.get('/health', orgPaymentController.healthCheck);

// Payment endpoints (API key auth is handled inside the controller - assertSecurity)
router.post('/payments/create', authenticate, tenantScope, createPaymentValidation, handleValidation, orgPaymentController.createPayment);
router.get('/payments/:applicationId', authenticate, orgPaymentController.getPaymentStatus);

// Callback endpoint (webhook - uses its own security validation)
router.post('/payment/callback', paymentCallbackValidation, handleValidation, orgPaymentController.processPaymentCallback);

// Admin endpoints
router.get('/stats', authenticate, tenantScope, orgPaymentController.getStats);
router.get('/payments', authenticate, tenantScope, orgPaymentController.listPayments);
router.get('/payment-notifications', authenticate, tenantScope, orgPaymentController.listNotifications);
router.post('/payments/expire', authenticate, orgPaymentController.expireOverduePayments);

module.exports = router;
