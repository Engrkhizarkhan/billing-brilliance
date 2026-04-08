const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { paginationValidation, idParam } = require('../middleware/validate');
const tenantController = require('../controllers/tenantController');

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', paginationValidation, handleValidation, tenantController.fetchTenants);
router.get('/:id', idParam, handleValidation, tenantController.getTenant);
router.post('/', tenantController.createTenant);
router.put('/:id', idParam, handleValidation, tenantController.updateTenant);
router.put('/:id/status', idParam, handleValidation, tenantController.updateTenantStatus);
router.post('/:id/regenerate-api-key', idParam, handleValidation, tenantController.regenerateTenantApiKey);

module.exports = router;
