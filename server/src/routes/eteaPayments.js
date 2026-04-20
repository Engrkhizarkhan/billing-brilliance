const express = require('express');
const router = express.Router();
const { authenticate, authenticateOrApiKey } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { createPaymentValidation, paymentCallbackValidation } = require('../middleware/validate');
const { tenantScope } = require('../middleware/auth');
const orgPaymentController = require('../controllers/eteaPaymentController');

// Public health check
router.get('/health', orgPaymentController.healthCheck);

// Payment endpoints — accept both JWT (dashboard) and X-API-Key (external integrations)
router.post('/payments/create', authenticateOrApiKey, tenantScope, createPaymentValidation, handleValidation, orgPaymentController.createPayment);
router.get('/payments/:applicationId', authenticateOrApiKey, orgPaymentController.getPaymentStatus);

// Callback endpoint (webhook - uses its own security validation)
router.post('/payment/callback', paymentCallbackValidation, handleValidation, orgPaymentController.processPaymentCallback);

// Admin endpoints
router.get('/stats', authenticate, tenantScope, orgPaymentController.getStats);
router.get('/payments', authenticate, tenantScope, orgPaymentController.listPayments);
router.get('/payment-notifications', authenticate, tenantScope, orgPaymentController.listNotifications);
router.post('/payments/expire', authenticate, orgPaymentController.expireOverduePayments);

module.exports = router;
