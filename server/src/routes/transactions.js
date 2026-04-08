const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { tenantScope } = require('../middleware/auth');
const transactionController = require('../controllers/transactionController');
const paymentController = require('../controllers/paymentController');

router.use(authenticate);
router.use(tenantScope);

router.get('/transactions', transactionController.fetchTransactions);
router.get('/transactions/:id', transactionController.getTransaction);
router.get('/payment-history', paymentController.fetchPaymentHistory);

module.exports = router;
