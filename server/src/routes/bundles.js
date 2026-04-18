/**
 * bundles.js — Admin CRUD routes for bundles
 *
 * Mounted at: /api/bundles
 * Auth: JWT (admin role only)
 */

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const bundleController = require('../controllers/bundleController');

router.use(authenticate);

// Only admin may manage bundles
router.use((req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required', code: 'FORBIDDEN' });
  }
  next();
});

// PCID API key management (declared before /:id to avoid route conflict)
router.get('/pcid-keys', bundleController.getPcidKeys);
router.post('/pcid-keys/:pcid/regenerate', bundleController.regeneratePcidKey);
router.put('/pcid-keys/:pcid/biller', bundleController.linkPcidBiller);

router.get('/', bundleController.fetchBundles);
router.get('/:id', bundleController.getBundle);
router.post('/', bundleController.createBundle);
router.put('/:id', bundleController.updateBundle);
router.delete('/:id', bundleController.deleteBundle);

module.exports = router;
