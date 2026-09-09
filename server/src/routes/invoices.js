const express = require('express');
const router = express.Router();
const { authenticate, authorize, authorizeSchoolRole } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { paginationValidation, idParam } = require('../middleware/validate');
const { tenantScope, requireLiveTenant } = require('../middleware/auth');
const invoiceController = require('../controllers/invoiceController');

router.use(authenticate);
router.use(authorize('admin', 'school'));
router.use(tenantScope);

router.get('/', paginationValidation, handleValidation, invoiceController.fetchInvoices);
router.post('/generate', authorizeSchoolRole('admin', 'finance'), requireLiveTenant, invoiceController.generateInvoicesFromAssignments);
router.get('/:id', idParam, handleValidation, invoiceController.getInvoice);
router.post('/', authorizeSchoolRole('admin', 'finance'), requireLiveTenant, invoiceController.createInvoice);
router.put('/:id/status', authorizeSchoolRole('admin', 'finance'), idParam, handleValidation, invoiceController.updateInvoiceStatus);
router.delete('/:id', authorizeSchoolRole('admin'), idParam, handleValidation, invoiceController.deleteInvoice);

module.exports = router;
