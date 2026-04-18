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
const router = express.Router();
const config = require('../config');
const bundleController = require('../controllers/bundleController');

// Validate 1LINK credentials sent as HTTP headers
const oneLinkAuth = (req, res, next) => {
  const username = req.headers['username'] || req.headers['Username'];
  const password = req.headers['password'] || req.headers['Password'];

  if (username !== config.onebill.username || password !== config.onebill.password) {
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
