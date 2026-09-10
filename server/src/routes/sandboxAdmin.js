const express = require('express');
const controller = require('../controllers/sandboxAdminController');
const rateLimit = require('express-rate-limit');

const router = express.Router();
router.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));
router.post('/tenants/provision', controller.provision);
router.post('/tenants/:id/purge', controller.purge);

module.exports = router;
