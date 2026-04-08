const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { paginationValidation, idParam } = require('../middleware/validate');
const { tenantScope } = require('../middleware/auth');
const invoiceController = require('../controllers/invoiceController');

router.use(authenticate);
router.use(tenantScope);

router.get('/', paginationValidation, handleValidation, invoiceController.fetchInvoices);
router.post('/generate', invoiceController.generateInvoicesFromAssignments);
router.get('/:id', idParam, handleValidation, invoiceController.getInvoice);
router.post('/', invoiceController.createInvoice);
router.put('/:id/status', idParam, handleValidation, invoiceController.updateInvoiceStatus);

module.exports = router;
