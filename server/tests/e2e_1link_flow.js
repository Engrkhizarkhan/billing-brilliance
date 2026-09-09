/**
 * 1BILL invoice-flow UAT smoke test.
 *
 * Inquiry is safe and always runs. Payment runs only when E2E_ALLOW_PAYMENT=true.
 * Use a disposable sandbox/UAT consumer; never point this script at production data.
 */
require('dotenv').config();
const http = require('http');

const base = new URL(process.env.E2E_BASE_URL || 'http://127.0.0.1:3000');
const consumerNumber = process.env.E2E_CONSUMER_NUMBER;
const username = process.env.ONELINK_USERNAME;
const password = process.env.ONELINK_PASSWORD;
const bankMnemonic = process.env.E2E_BANK_MNEMONIC || 'MBLINK01';
const sourceIp = process.env.E2E_SOURCE_IP;

const request = (path, body) => new Promise((resolve, reject) => {
  const payload = JSON.stringify(body);
  const req = http.request({
    hostname: base.hostname,
    port: base.port || 80,
    path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      username,
      password,
      ...(sourceIp ? { 'X-Forwarded-For': sourceIp } : {}),
    },
  }, (res) => {
    let text = '';
    res.on('data', (chunk) => { text += chunk; });
    res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(text) }));
  });
  req.on('error', reject);
  req.end(payload);
});

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const nowParts = () => {
  const iso = new Date().toISOString();
  return { date: iso.slice(0, 10).replace(/-/g, ''), time: iso.slice(11, 19).replace(/:/g, '') };
};
const amountFromInquiry = (value) => Number.parseInt(String(value).replace(/^[+-]/, ''), 10);

async function run() {
  assert(consumerNumber, 'E2E_CONSUMER_NUMBER is required');
  assert(username && password, 'ONELINK_USERNAME and ONELINK_PASSWORD are required');
  const inquiry = await request('/api/1.0/Payments/BillInquiry', {
    consumer_number: consumerNumber,
    bank_mnemonic: bankMnemonic,
    reserved: '',
  });
  assert(inquiry.status === 200, `Inquiry HTTP ${inquiry.status}`);
  assert(inquiry.body.response_Code === '00', `Inquiry response ${inquiry.body.response_Code}`);
  console.log(JSON.stringify({ step: 'inquiry', result: inquiry.body }, null, 2));

  if (process.env.E2E_ALLOW_PAYMENT !== 'true') {
    console.log('Payment skipped. Set E2E_ALLOW_PAYMENT=true only for a disposable UAT consumer.');
    return;
  }
  assert(inquiry.body.bill_status === 'U', 'Consumer is not unpaid');
  const minorAmount = amountFromInquiry(inquiry.body.amount_after_dueDate);
  assert(Number.isFinite(minorAmount) && minorAmount > 0, 'Inquiry returned no payable amount');
  const parts = nowParts();
  const tranAuthId = String(Math.floor(100000 + Math.random() * 900000));
  const paymentBody = {
    consumer_number: consumerNumber,
    tran_auth_id: tranAuthId,
    transaction_amount: String(minorAmount).padStart(12, '0'),
    tran_date: parts.date,
    tran_time: parts.time,
    bank_mnemonic: bankMnemonic,
    reserved: '',
  };
  const payment = await request('/api/1.0/Payments/BillPayment', paymentBody);
  assert(payment.status === 200, `Payment HTTP ${payment.status}`);
  assert(payment.body.response_Code === '00', `Payment response ${payment.body.response_Code}`);
  console.log(JSON.stringify({ step: 'payment', result: payment.body }, null, 2));

  const repeat = await request('/api/1.0/Payments/BillPayment', paymentBody);
  console.log(JSON.stringify({ step: 'duplicate-check', result: repeat.body }, null, 2));
  assert(repeat.body.response_Code === '03' || repeat.body.response_Code === '06', 'Duplicate payment was not rejected');
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
