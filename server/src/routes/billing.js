const express = require('express');
const router = express.Router();
const { authenticate, apiKeyAuth, authenticateOrApiKey } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { billInquiryValidation, billPaymentValidation } = require('../middleware/validate');
const { tenantScope } = require('../middleware/auth');
const billingController = require('../controllers/billingController');

// Bill inquiry and payment can be called by external systems via API key
// or by authenticated internal users
router.post('/inquiry', authenticateOrApiKey, billInquiryValidation, handleValidation, billingController.billInquiry);
router.post('/payment', authenticateOrApiKey, billPaymentValidation, handleValidation, billingController.postBillPayment);

// 1LINK FetchBundle shape (admin sandbox)
router.post('/fetchbundle', authenticate, tenantScope, billingController.fetchBundles);

// Bundles require authentication
router.get('/bundles', authenticate, tenantScope, billingController.fetchBundles);

module.exports = router;
