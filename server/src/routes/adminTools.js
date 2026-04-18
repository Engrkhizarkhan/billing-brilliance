/**
 * adminTools.js — Admin-only developer / maintenance tools
 *
 * Mounted at: /api/admin
 * All routes require authenticate + authorize('admin').
 *
 * Endpoints:
 *   POST /api/admin/tools/verify-hash  — compare a bcrypt hash against a plaintext string
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticate, authorize } = require('../middleware/auth');
const { auditLog } = require('../middleware/auditLog');
const logger = require('../config/logger');

router.use(authenticate, authorize('admin'));

/**
 * POST /api/admin/tools/verify-hash
 * Body: { hash: string, plaintext: string }
 * Returns: { data: { match: boolean } }
 *
 * Security note: plaintext is never logged or stored.
 */
router.post('/tools/verify-hash', async (req, res) => {
  try {
    const { hash, plaintext } = req.body;

    if (!hash || typeof hash !== 'string' || !plaintext || typeof plaintext !== 'string') {
      return res.status(400).json({ error: 'hash and plaintext are required strings' });
    }

    // Basic sanity check — bcrypt hashes start with $2a$, $2b$, or $2y$
    if (!hash.trim().match(/^\$2[aby]\$/)) {
      return res.status(400).json({ error: 'Provided value does not look like a bcrypt hash' });
    }

    const match = await bcrypt.compare(plaintext, hash.trim());

    await auditLog(req, 'verify_hash', 'admin_tool', 'hash_verify', `Admin verified a bcrypt hash (match: ${match})`);
    logger.info(`Admin ${req.user.email} verified a hash (match: ${match})`);

    return res.json({ data: { match } });
  } catch (err) {
    logger.error('verify-hash error:', err);
    return res.status(500).json({ error: 'Hash verification failed' });
  }
});

module.exports = router;
