/**
 * End-to-end test: register-consumer → BillInquiry → BillPayment
 *
 * Run: node tests/e2e_1link_flow.js
 *
 * Prerequisites:
 *   - Server running on PORT (default 3000)
 *   - DB seeded with at least one active PCID+bundle linked to a tenant
 */

const http = require('http');

const BASE = `http://localhost:${process.env.PORT || 3000}`;
const ONELINK_USER = process.env.ONELINK_USERNAME || 'demo-user';
const ONELINK_PASS = process.env.ONELINK_PASSWORD || 'demo-pass';

let passed = 0;
let failed = 0;

// ── helpers ────────────────────────────────────────────────────────────────

function req(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload ? Buffer.byteLength(payload) : 0,
        ...headers,
      },
    };
    const [host, port] = BASE.replace('http://', '').split(':');
    const r = http.request({ ...options, hostname: host, port: parseInt(port), path }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function assert(label, condition, detail = '') {
  if (condition) {
    console.log(`  ✅  ${label}`);
    passed++;
  } else {
    console.error(`  ❌  ${label}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function buildInquiryReserved(bundleId) {
  // CNIC(13) + AccountId(28) + BundleID(100) + Info1(100) + Info2(144) = 385
  const blank = (n) => ' '.repeat(n);
  return blank(13) + blank(28) + (bundleId || '').padEnd(100, ' ') + blank(100) + blank(144);
}

function buildPaymentReserved(bundleId) {
  // CNIC(13)+City(30)+Province(20)+AccountId(28)+fromAccountType(2)+fromAccountTitle(30)+BundleID(100)+Info1(100)+Info2(192)=515
  const blank = (n) => ' '.repeat(n);
  return blank(13) + blank(30) + blank(20) + blank(28) + blank(2) + blank(30) +
    (bundleId || '').padEnd(100, ' ') + blank(100) + blank(192);
}

function parseAN14(str) {
  return parseInt((str || '0').replace(/^[+-]/, ''), 10) / 100;
}

function toAN12(amount) {
  return String(Math.round(amount * 100)).padStart(12, '0');
}

function randomTranAuthId() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function today(offset = 0) {
  const d = new Date(Date.now() + offset * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function nowTime() {
  return new Date().toTimeString().slice(0, 8).replace(/:/g, '');
}

// ── main test flow ────────────────────────────────────────────────────────

async function run() {
  console.log('\n====================================================');
  console.log(' 1LINK Payment Flow — End-to-End Test');
  console.log('====================================================\n');

  // ── Step 0: admin login ────────────────────────────────────────────────
  console.log('-- Step 0: Admin login');
  const loginRes = await req('POST', '/api/auth/login', {
    email: 'admin@example.com',
    password: '123456',
  });
  assert('login returns 200', loginRes.status === 200, JSON.stringify(loginRes.body).slice(0, 120));
  const jwt = loginRes.body?.data?.token;
  assert('got JWT', !!jwt);
  const authHeader = { Authorization: `Bearer ${jwt}` };

  // ── Step 1: FetchBundle to pick a PCID + bundleId ─────────────────────
  // FetchBundle spec field is "PCID" (uppercase); BillInquiry/Payment use "bank_mnemonic"
  console.log('\n-- Step 1: FetchBundle (1LINK → our server)');

  // Discover the PCID that has active bundles by asking the admin API first
  let pcid = null;
  let bundleId = null;
  let bundleAmount = 0;
  let apiKey = null;

  const pcidRes = await req('GET', '/api/bundles/pcid-keys', null, authHeader);
  if (pcidRes.status === 200 && Array.isArray(pcidRes.body?.data)) {
    const row = pcidRes.body.data.find((p) => p.biller_id && p.api_key) || pcidRes.body.data.find((p) => p.api_key);
    if (row) { pcid = row.pcid; apiKey = row.api_key; }
  }
  if (!pcid) pcid = 'LURNIVA1'; // fallback to the known PCID with seeded bundles
  console.log(`  Using PCID: ${pcid}`);

  const fetchRes = await req(
    'POST',
    '/v1/Transaction/Fetchbundle',
    { PCID: pcid },           // spec field name is PCID (uppercase), not bank_mnemonic
    { username: ONELINK_USER, password: ONELINK_PASS },
  );
  console.log('  FetchBundle response_Code:', fetchRes.body?.responseCode);
  assert('FetchBundle rc=00', fetchRes.body?.responseCode === '00', `code=${fetchRes.body?.responseCode}`);

  if (fetchRes.body?.bundleDetails?.length > 0) {
    const bd = fetchRes.body.bundleDetails[0];
    bundleId = bd.bundleId;
    bundleAmount = parseFloat(bd.amount);
    console.log(`  Using bundle: ${bundleId} (${bd.bundleName}) PKR ${bundleAmount}`);
  } else {
    // Fallback: query bundles API directly
    const bRes = await req('GET', `/api/bundles?pcid=${pcid}&status=active`, null, authHeader);
    const bList = bRes.body?.data || bRes.body?.bundles || [];
    if (Array.isArray(bList) && bList.length > 0) {
      bundleId = bList[0].bundle_id;
      bundleAmount = parseFloat(bList[0].amount);
      console.log(`  Fallback bundle from admin API: ${bundleId} PKR ${bundleAmount}`);
    }
  }

  assert('have bundleId', !!bundleId, String(bundleId));

  if (!apiKey) {
    assert('api_key available', false, 'No api_key found for any PCID — check bundle_pcids table');
    printSummary();
    return;
  }
  assert('have api_key', !!apiKey, `pcid=${pcid}`);

  // ── Step 2: register-consumer WITH bundleId (auto-creates invoice) ────
  console.log('\n-- Step 2: POST /api/saas/v1/register-consumer (with bundleId)');
  const regRes = await req(
    'POST',
    '/api/saas/v1/register-consumer',
    {
      name: 'E2E Test User',
      phone: '03001234567',
      email: 'e2e@example.com',
      externalRef: `E2E-${Date.now()}`,
      bundleId,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    },
    { 'x-api-key': apiKey },
  );
  console.log('  register-consumer status:', regRes.status);
  console.log('  body:', JSON.stringify(regRes.body));
  assert('register-consumer 201', regRes.status === 201, `got ${regRes.status}`);

  const consumerNumber = regRes.body?.consumerNumber;
  assert('consumerNumber returned', !!consumerNumber, consumerNumber);

  const invoiceCreated = !!regRes.body?.invoice;
  assert('invoice auto-created in register-consumer', invoiceCreated,
    invoiceCreated ? `${regRes.body.invoice.invoiceNumber} PKR ${regRes.body.invoice.amount}` : 'no invoice field');

  if (!consumerNumber) {
    console.error('\nCannot continue without a consumer number.');
    printSummary();
    return;
  }

  // ── Step 3: BillInquiry — should return bill_status=U ─────────────────
  console.log('\n-- Step 3: POST /api/1.0/Payments/BillInquiry');
  const inqRes = await req(
    'POST',
    '/api/1.0/Payments/BillInquiry',
    {
      consumer_number: consumerNumber,
      bank_mnemonic: pcid,
      reserved: buildInquiryReserved(bundleId),
    },
    { username: ONELINK_USER, password: ONELINK_PASS },
  );
  console.log('  BillInquiry response:', JSON.stringify(inqRes.body));
  assert('BillInquiry response_Code=00', inqRes.body?.response_Code === '00', inqRes.body?.response_Code);
  assert('bill_status=U (unpaid)', inqRes.body?.bill_status === 'U', `got: ${inqRes.body?.bill_status}`);
  assert('consumer_detail has name', (inqRes.body?.consumer_detail || '').trim().length > 0);

  const amtWithin = inqRes.body?.amount_within_dueDate;
  const amtParsed = parseAN14(amtWithin);
  assert('amount_within_dueDate > 0', amtParsed > 0, `${amtWithin} → ${amtParsed}`);
  assert('amount matches bundle', Math.abs(amtParsed - bundleAmount) < 0.01, `${amtParsed} vs ${bundleAmount}`);

  if (inqRes.body?.bill_status !== 'U') {
    console.error('\nBillInquiry did not return U — cannot test payment.');
    printSummary();
    return;
  }

  // ── Step 4: BillPayment ───────────────────────────────────────────────
  console.log('\n-- Step 4: POST /api/1.0/Payments/BillPayment');
  const tranAuthId = randomTranAuthId();
  const payRes = await req(
    'POST',
    '/api/1.0/Payments/BillPayment',
    {
      consumer_number: consumerNumber,
      bank_mnemonic: pcid,
      transaction_amount: toAN12(amtParsed),
      tran_auth_id: tranAuthId,
      tran_date: today(),
      tran_time: nowTime(),
      reserved: buildPaymentReserved(bundleId),
    },
    { username: ONELINK_USER, password: ONELINK_PASS },
  );
  console.log('  BillPayment response:', JSON.stringify(payRes.body));
  assert('BillPayment response_Code=00', payRes.body?.response_Code === '00', `got: ${payRes.body?.response_Code}`);
  assert('Identification_parameter returned', !!payRes.body?.Identification_parameter);

  // ── Step 5: Second BillInquiry — should now be bill_status=P ─────────
  console.log('\n-- Step 5: Re-inquire after payment — should be P (paid)');
  const inq2Res = await req(
    'POST',
    '/api/1.0/Payments/BillInquiry',
    {
      consumer_number: consumerNumber,
      bank_mnemonic: pcid,
      reserved: buildInquiryReserved(bundleId),
    },
    { username: ONELINK_USER, password: ONELINK_PASS },
  );
  console.log('  Post-payment inquiry:', JSON.stringify(inq2Res.body));
  assert('Post-payment bill_status=P', inq2Res.body?.bill_status === 'P', `got: ${inq2Res.body?.bill_status}`);
  assert('date_paid populated', !!(inq2Res.body?.date_paid || '').trim());
  assert('amount_paid populated', !!(inq2Res.body?.amount_paid || '').trim());

  // ── Step 6: Duplicate payment attempt — should return error ───────────
  console.log('\n-- Step 6: Duplicate payment attempt — should be rejected');
  const dupRes = await req(
    'POST',
    '/api/1.0/Payments/BillPayment',
    {
      consumer_number: consumerNumber,
      bank_mnemonic: pcid,
      transaction_amount: toAN12(amtParsed),
      tran_auth_id: randomTranAuthId(),
      tran_date: today(),
      tran_time: nowTime(),
      reserved: buildPaymentReserved(bundleId),
    },
    { username: ONELINK_USER, password: ONELINK_PASS },
  );
  console.log('  Duplicate payment response_Code:', dupRes.body?.response_Code);
  assert('Duplicate payment rejected (not 00)', dupRes.body?.response_Code !== '00', `got: ${dupRes.body?.response_Code}`);

  // ── Step 7: register-consumer WITHOUT bundleId — inquiry auto-creates invoice ─
  console.log('\n-- Step 7: register-consumer WITHOUT bundleId, then BillInquiry auto-creates invoice');
  const reg2Res = await req(
    'POST',
    '/api/saas/v1/register-consumer',
    { name: 'E2E NoInvoice User', phone: '03009876543', externalRef: `E2E-NOINV-${Date.now()}` },
    { 'x-api-key': apiKey },
  );
  console.log('  register-consumer (no bundleId) status:', reg2Res.status, JSON.stringify(reg2Res.body));
  assert('register-consumer 201 (no bundleId)', reg2Res.status === 201, `got ${reg2Res.status}`);
  assert('no invoice in response (no bundleId)', !reg2Res.body?.invoice);
  const cn2 = reg2Res.body?.consumerNumber;
  assert('consumerNumber returned', !!cn2);

  if (cn2 && bundleId) {
    // BillInquiry carries the bundleId in the reserved field
    // → handler detects neverInvoiced + valid bundleId → auto-creates invoice
    const inq3 = await req(
      'POST', '/api/1.0/Payments/BillInquiry',
      { consumer_number: cn2, bank_mnemonic: pcid, reserved: buildInquiryReserved(bundleId) },
      { username: ONELINK_USER, password: ONELINK_PASS },
    );
    console.log('  Auto-invoice BillInquiry response:', JSON.stringify(inq3.body));
    assert('Auto-invoice BillInquiry rc=00', inq3.body?.response_Code === '00', `got: ${inq3.body?.response_Code}`);
    assert('Auto-invoice bill_status=U', inq3.body?.bill_status === 'U', `got: ${inq3.body?.bill_status}`);
    assert('Auto-invoice amount>0', parseAN14(inq3.body?.amount_within_dueDate || '0') > 0,
      `amount: ${inq3.body?.amount_within_dueDate}`);
  }

  printSummary();
}

function printSummary() {
  const total = passed + failed;
  console.log('\n====================================================');
  console.log(` Results: ${passed}/${total} passed, ${failed} failed`);
  console.log('====================================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
