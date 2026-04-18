const express = require('express');
const router = express.Router();
const { authenticate, apiKeyAuth, authenticateOrApiKey, authorizeSchoolRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { billInquiryValidation, billPaymentValidation } = require('../middleware/validate');
const { tenantScope } = require('../middleware/auth');
const billingController = require('../controllers/billingController');

// Bill inquiry — read-only; allowed by external API key or any authenticated user
router.post('/inquiry', authenticateOrApiKey, billInquiryValidation, handleValidation, billingController.billInquiry);
// Bill payment write — require school admin or finance role when called by an internal user
router.post('/payment', authenticateOrApiKey, authorizeSchoolRole('admin', 'finance'), billPaymentValidation, handleValidation, billingController.postBillPayment);

// 1LINK FetchBundle shape (admin sandbox)
router.post('/fetchbundle', authenticate, tenantScope, billingController.fetchBundles);

// Bundles require authentication
router.get('/bundles', authenticate, tenantScope, billingController.fetchBundles);

module.exports = router;
