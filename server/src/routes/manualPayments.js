const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const { authenticate, authorize, tenantScope, requireLiveTenant } = require('../middleware/auth');
const { handleValidation } = require('../middleware/handleValidation');
const manualPaymentController = require('../controllers/manualPaymentController');

router.use(authenticate);
router.post('/inquiry', authorize('admin'),
  body('consumerNumber').trim().matches(/^\d{1,24}$/).withMessage('Consumer number must contain 1-24 digits'),
  handleValidation, manualPaymentController.inquirePayment);
router.use(tenantScope);
router.use(requireLiveTenant);

const requireFinancePermission = (req, res, next) => {
  const allowed = req.user.role === 'admin' || req.user.role === 'org'
    || (req.user.role === 'school' && ['admin', 'finance'].includes(req.user.school_access_role));
  if (!allowed) return res.status(403).json({ error: 'Finance permission is required', code: 'INSUFFICIENT_PERMISSION' });
  next();
};

router.post('/record', requireFinancePermission, manualPaymentController.recordPayment);
router.post('/reverse', requireFinancePermission, manualPaymentController.reversePayment);

module.exports = router;
