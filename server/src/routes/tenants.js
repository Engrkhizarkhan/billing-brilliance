const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const { paginationValidation, idParam } = require('../middleware/validate');
const tenantController = require('../controllers/tenantController');
const rateLimit = require('express-rate-limit');

const privilegedActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many privileged-action attempts. Try again later.', code: 'PRIVILEGED_ACTION_RATE_LIMITED' },
});

router.use(authenticate);
router.use(authorize('admin'));

router.get('/', paginationValidation, handleValidation, tenantController.fetchTenants);
router.get('/:id', idParam, handleValidation, tenantController.getTenant);
router.post('/', tenantController.createTenant);
router.put('/:id', idParam, handleValidation, tenantController.updateTenant);
router.put('/:id/status', idParam, handleValidation, tenantController.updateTenantStatus);
router.patch('/:id/status', idParam, handleValidation, tenantController.updateTenantStatus);
router.patch('/:id/lifecycle', privilegedActionLimiter, idParam, handleValidation, tenantController.updateTenantLifecycle);
router.post('/:id/provision-sandbox', privilegedActionLimiter, idParam, handleValidation, tenantController.provisionTenantSandbox);
router.post('/:id/reveal-api-key', privilegedActionLimiter, idParam, handleValidation, tenantController.revealTenantApiKey);
router.post('/:id/regenerate-api-key', privilegedActionLimiter, idParam, handleValidation, tenantController.regenerateTenantApiKey);
router.post('/:id/offboard', privilegedActionLimiter, idParam, handleValidation, tenantController.offboardTenant);

module.exports = router;
