/**
 * 1LINK Generic REST API routes
 *
 * Mounted at: /api/1.0/Payments
 *
 * Auth: caller must send HTTP headers:
 *   username: <ONELINK_USERNAME>
 *   password: <ONELINK_PASSWORD>
 *
 * These credentials are configured on our side and given to the 1LINK gateway.
 */

const express = require('express');
const router = express.Router();
const config = require('../config');
const oneLinkController = require('../controllers/oneLinkController');

// Validate 1LINK username/password headers before any request hits the controller
const oneLinkAuth = (req, res, next) => {
  const username = req.headers['username'] || req.headers['Username'];
  const password = req.headers['password'] || req.headers['Password'];

  if (username !== config.onebill.username || password !== config.onebill.password) {
    // Return 1LINK-spec error shape so the gateway can parse it
    return res.status(401).json({
      response_Code: '04',
      consumer_detail: ''.padEnd(30, ' '),
      bill_status: 'B',
      due_date: '',
      amount_within_dueDate: '+0000000000000',
      amount_after_dueDate:  '+0000000000000',
      billing_month: '',
      date_paid: '',
      amount_paid: '',
      tran_auth_Id: '',
      reserved: '',
    });
  }

  next();
};

router.post('/BillInquiry', oneLinkAuth, oneLinkController.billInquiry1Link);
router.post('/BillPayment', oneLinkAuth, oneLinkController.billPayment1Link);

module.exports = router;
