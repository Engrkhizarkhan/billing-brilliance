const express = require('express');
const router = express.Router();
const { authenticateOrApiKey, authorizeSchoolRole, requireLiveTenant } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { billInquiryValidation, billPaymentValidation } = require('../middleware/validate');
const billingController = require('../controllers/billingController');

// Bill inquiry — read-only; allowed by external API key or any authenticated user
router.post('/inquiry', authenticateOrApiKey, requireLiveTenant, billInquiryValidation, handleValidation, billingController.billInquiry);
// Bill payment write — require school admin or finance role when called by an internal user
router.post('/payment', authenticateOrApiKey, requireLiveTenant, authorizeSchoolRole('admin', 'finance'), billPaymentValidation, handleValidation, billingController.postBillPayment);

module.exports = router;
