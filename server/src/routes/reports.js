const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { tenantScope } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

router.use(authenticate);

router.get('/dashboard', tenantScope, reportController.getDashboardStats);
router.get('/collection-trend', tenantScope, reportController.getCollectionTrend);
router.get('/platform-summary', authorize('admin'), reportController.getPlatformSummary);

module.exports = router;
