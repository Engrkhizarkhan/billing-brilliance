/**
 * fetchbundle.js — 1LINK FetchBundle route
 *
 * Mounted at: /v1/Transaction
 * Auth: 1LINK username/password headers (same credential set as BillInquiry/BillPayment)
 *
 * Implements: POST /v1/Transaction/Fetchbundle
 * Per 1LINK Generic REST Spec v1.5 — Transaction 1: Fetch Bundle
 */

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const config = require('../config');
const bundleController = require('../controllers/bundleController');

// Validate 1LINK credentials sent as HTTP headers
const safeEqual = (provided, expected) => {
  const left = Buffer.from(String(provided || ''));
  const right = Buffer.from(String(expected || ''));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

const oneLinkAuth = (req, res, next) => {
  const username = req.headers['username'] || req.headers['Username'];
  const password = req.headers['password'] || req.headers['Password'];
  const sourceIp = String(req.ip || req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  const accessDenied =
    !safeEqual(username, config.onebill.username) ||
    !safeEqual(password, config.onebill.password) ||
    (config.nodeEnv === 'production' && !config.onebill.allowedIps.includes(sourceIp));

  if (accessDenied) {
    return res.status(401).json({
      companyId: '',
      responseCode: '04',
      billerName: '',
      bundleDetails: [],
    });
  }
  next();
};

router.post('/Fetchbundle', oneLinkAuth, bundleController.fetchBundle1Link);

module.exports = router;
