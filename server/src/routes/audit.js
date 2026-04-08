const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const auditController = require('../controllers/auditController');

router.use(authenticate);

router.get('/', auditController.fetchAuditLogs);

module.exports = router;
