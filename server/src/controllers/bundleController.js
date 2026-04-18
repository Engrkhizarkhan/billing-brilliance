/**
 * bundleController.js
 *
 * Handles:
 *  - Admin CRUD for bundles (GET / POST / PUT / DELETE /api/bundles)
 *  - 1LINK FetchBundle endpoint  POST /v1/Transaction/Fetchbundle
 */

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { AppError } = require('../middleware/errorHandler');
const logger = require('../config/logger');

// ── Admin CRUD ───────────────────────────────────────────────────────────────

const fetchBundles = async (req, res, next) => {
  try {
    const { pcid, status, search, page = 1, pageSize = 25 } = req.query;
    const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);

    let where = 'WHERE deleted_at IS NULL';
    const params = [];

    if (pcid) { where += ' AND pcid = ?'; params.push(pcid.trim().toUpperCase()); }
    if (status) { where += ' AND status = ?'; params.push(status); }
    if (search) {
      where += ' AND (bundle_name LIKE ? OR description LIKE ? OR bundle_id LIKE ? OR pcid LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM bundles ${where}`, params
    );
    const [rows] = await pool.query(
      `SELECT * FROM bundles ${where} ORDER BY pcid, bundle_name LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize, 10), offset]
    );

    res.json({
      data: rows,
      meta: {
        page: parseInt(page, 10),
        pageSize: parseInt(pageSize, 10),
        total: countRows[0].total,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getBundle = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM bundles WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Bundle not found', 404);
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const createBundle = async (req, res, next) => {
  try {
    const {
      pcid, billerName, bundleId, bundleName,
      description, expiryDate, amount, tag, status = 'active',
    } = req.body;

    if (!pcid || !billerName || !bundleId || !bundleName || amount === undefined || amount === '') {
      throw new AppError('pcid, billerName, bundleId, bundleName, and amount are required', 400);
    }
    if (tag && tag.length > 2000) {
      throw new AppError('tag exceeds max length of 2000 characters', 400);
    }

    const cleanPcid  = pcid.trim().toUpperCase();
    const cleanBundleId = bundleId.trim().slice(0, 20);

    // Check for a soft-deleted row with the same (pcid, bundle_id) and restore it
    const [deleted] = await pool.query(
      'SELECT id FROM bundles WHERE pcid = ? AND bundle_id = ? AND deleted_at IS NOT NULL',
      [cleanPcid, cleanBundleId]
    );

    let rowId;
    if (deleted.length > 0) {
      // Restore the row with fresh data
      rowId = deleted[0].id;
      await pool.query(
        `UPDATE bundles
            SET biller_name  = ?,
                bundle_name  = ?,
                description  = ?,
                expiry_date  = ?,
                amount       = ?,
                tag          = ?,
                status       = ?,
                deleted_at   = NULL,
                updated_at   = NOW()
          WHERE id = ?`,
        [
          billerName.trim().slice(0, 30),
          bundleName.trim().slice(0, 100),
          description || null,
          expiryDate || null,
          String(amount),
          tag || null,
          status,
          rowId,
        ]
      );
    } else {
      // Check for an active duplicate before inserting (gives a clear error)
      const [active] = await pool.query(
        'SELECT id FROM bundles WHERE pcid = ? AND bundle_id = ? AND deleted_at IS NULL',
        [cleanPcid, cleanBundleId]
      );
      if (active.length > 0) {
        throw new AppError(
          `Bundle ID "${cleanBundleId}" already exists for PCID "${cleanPcid}". Choose a different Bundle ID.`,
          409
        );
      }

      rowId = uuidv4();
      await pool.query(
        `INSERT INTO bundles
           (id, pcid, biller_name, bundle_id, bundle_name, description, expiry_date, amount, tag, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          rowId,
          cleanPcid,
          billerName.trim().slice(0, 30),
          cleanBundleId,
          bundleName.trim().slice(0, 100),
          description || null,
          expiryDate || null,
          String(amount),
          tag || null,
          status,
        ]
      );
    }

    const pcidKey = uuidv4().replace(/-/g, '') + uuidv4().replace(/-/g, '').slice(0, 32);
    await pool.query(
      `INSERT INTO bundle_pcids (pcid, api_key) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE pcid = pcid`,
      [cleanPcid, pcidKey]
    );

    const [rows] = await pool.query('SELECT * FROM bundles WHERE id = ?', [rowId]);
    res.status(201).json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const updateBundle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      billerName, bundleName, description,
      expiryDate, amount, tag, status,
    } = req.body;

    if (tag !== undefined && tag !== null && tag.length > 2000) {
      throw new AppError('tag exceeds max length of 2000 characters', 400);
    }

    const updates = [];
    const params = [];

    if (billerName !== undefined) { updates.push('biller_name = ?'); params.push(billerName.trim().slice(0, 30)); }
    if (bundleName !== undefined) { updates.push('bundle_name = ?'); params.push(bundleName.trim().slice(0, 100)); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description || null); }
    if (expiryDate !== undefined) { updates.push('expiry_date = ?'); params.push(expiryDate || null); }
    if (amount !== undefined) { updates.push('amount = ?'); params.push(String(amount)); }
    if (tag !== undefined) { updates.push('tag = ?'); params.push(tag || null); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }

    if (updates.length === 0) throw new AppError('No fields provided to update', 400);

    params.push(id);
    await pool.query(
      `UPDATE bundles SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    );

    const [rows] = await pool.query('SELECT * FROM bundles WHERE id = ? AND deleted_at IS NULL', [id]);
    if (rows.length === 0) throw new AppError('Bundle not found', 404);
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

const deleteBundle = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      'SELECT id FROM bundles WHERE id = ? AND deleted_at IS NULL',
      [req.params.id]
    );
    if (rows.length === 0) throw new AppError('Bundle not found', 404);
    await pool.query('UPDATE bundles SET deleted_at = NOW() WHERE id = ?', [req.params.id]);
    res.json({ data: true });
  } catch (err) {
    next(err);
  }
};

// ── 1LINK FetchBundle ────────────────────────────────────────────────────────

/**
 * POST /v1/Transaction/Fetchbundle
 * 1LINK Generic REST Spec v1.5 — Transaction 1: Fetch Bundle
 *
 * Request:  { "PCID": "MBLINK01" }
 * Response: { companyId, responseCode, billerName, bundleDetails: [...] }
 *
 * Response codes:
 *   00 — Success
 *   01 — No bundles found for PCID
 *   03 — Internal error
 *   04 — Invalid / missing PCID
 */
const fetchBundle1Link = async (req, res, next) => {
  try {
    const { PCID } = req.body;

    if (!PCID || typeof PCID !== 'string' || PCID.trim().length === 0) {
      return res.status(400).json({
        companyId: '',
        responseCode: '04',
        billerName: '',
        bundleDetails: [],
      });
    }

    const pcid = PCID.trim().toUpperCase();

    const [rows] = await pool.query(
      `SELECT * FROM bundles
       WHERE pcid = ? AND status = 'active' AND deleted_at IS NULL
       ORDER BY bundle_name`,
      [pcid]
    );

    if (rows.length === 0) {
      return res.json({
        companyId: pcid,
        responseCode: '01',
        billerName: '',
        bundleDetails: [],
      });
    }

    const billerName = rows[0].biller_name;

    const bundleDetails = rows.map((row) => ({
      bundleId: row.bundle_id,
      bundleName: row.bundle_name,
      description: row.description || '',
      expiryDate: row.expiry_date || '',
      amount: row.amount,
      tag: row.tag || '',
    }));

    return res.json({
      companyId: pcid,
      responseCode: '00',
      billerName,
      bundleDetails,
    });
  } catch (err) {
    logger.error('FetchBundle 1LINK error:', err);
    return res.status(500).json({
      companyId: '',
      responseCode: '03',
      billerName: '',
      bundleDetails: [],
    });
  }
};

// ── PCID Key Management ──────────────────────────────────────────────────────

/** GET /api/bundles/pcid-keys — list all PCID entries with api_key + linked biller */
const getPcidKeys = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      `SELECT bp.pcid, bp.api_key, bp.biller_id, bp.created_at, bp.updated_at,
              t.name AS biller_name
       FROM bundle_pcids bp
       LEFT JOIN tenants t ON t.id = bp.biller_id
       ORDER BY bp.pcid`
    );
    res.json({ data: rows });
  } catch (err) {
    next(err);
  }
};

/** POST /api/bundles/pcid-keys/:pcid/regenerate — regenerate API key for a PCID */
const regeneratePcidKey = async (req, res, next) => {
  try {
    const pcid = req.params.pcid.toUpperCase();
    const newKey = crypto.randomBytes(32).toString('hex');
    const [result] = await pool.query(
      'UPDATE bundle_pcids SET api_key = ? WHERE pcid = ?',
      [newKey, pcid]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'PCID not found', code: 'NOT_FOUND' });
    }
    const [rows] = await pool.query('SELECT pcid, api_key, biller_id FROM bundle_pcids WHERE pcid = ?', [pcid]);
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

/** PUT /api/bundles/pcid-keys/:pcid/biller — link or unlink a biller_id to a PCID */
const linkPcidBiller = async (req, res, next) => {
  try {
    const pcid = req.params.pcid.toUpperCase();
    const { billerId } = req.body; // null to unlink
    await pool.query(
      'UPDATE bundle_pcids SET biller_id = ? WHERE pcid = ?',
      [billerId || null, pcid]
    );
    const [rows] = await pool.query(
      `SELECT bp.pcid, bp.api_key, bp.biller_id, t.name AS biller_name
       FROM bundle_pcids bp LEFT JOIN tenants t ON t.id = bp.biller_id
       WHERE bp.pcid = ?`,
      [pcid]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'PCID not found', code: 'NOT_FOUND' });
    res.json({ data: rows[0] });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  fetchBundles,
  getBundle,
  createBundle,
  updateBundle,
  deleteBundle,
  fetchBundle1Link,
  getPcidKeys,
  regeneratePcidKey,
  linkPcidBiller,
};
