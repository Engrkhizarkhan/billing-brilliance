/**
 * End-to-end test: register-consumer + BillInquiry
 * Verifies the fix: new consumer now returns bill_status U (not P)
 */
const { pool } = require('./src/config/database');

async function test() {
  console.log('=== 1BILL Flow Integration Test ===\n');

  // 1. Get a valid PCID + API key + tenant
  const [pcids] = await pool.query(
    `SELECT bp.pcid, bp.api_key, bp.biller_id, t.name, t.biller_code
     FROM bundle_pcids bp
     JOIN tenants t ON t.id = bp.biller_id
     WHERE bp.api_key IS NOT NULL AND bp.biller_id IS NOT NULL
     LIMIT 1`
  );
  if (!pcids.length) {
    console.log('No PCID with API key + linked biller found — skipping');
    process.exit(0);
  }
  const { pcid, api_key, name: tenantName, biller_code } = pcids[0];

  // 2. Get an active bundle for this PCID
  const [bundles] = await pool.query(
    `SELECT * FROM bundles WHERE pcid = ? AND status = 'active' AND deleted_at IS NULL LIMIT 1`,
    [pcid]
  );
  if (!bundles.length) {
    console.log('No active bundle for PCID', pcid, '— create one in Bundle Management first');
    process.exit(0);
  }
  const bundle = bundles[0];

  console.log('Tenant    :', tenantName, `(biller_code: ${biller_code})`);
  console.log('PCID      :', pcid);
  console.log('Bundle    :', bundle.bundle_id, '—', bundle.bundle_name, '— PKR', bundle.amount);

  const origin = 'http://localhost:3000';

  // ── Test A: register WITH bundleId (invoice auto-created) ──
  console.log('\n── Test A: register-consumer WITH bundleId ──');
  const nameA = `Test Consumer ${Date.now()}`;
  const regResA = await fetch(origin + '/api/saas/v1/register-consumer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': api_key },
    body: JSON.stringify({ name: nameA, bundleId: bundle.bundle_id }),
  });
  const regDataA = await regResA.json();
  console.log('register-consumer response HTTP', regResA.status, ':');
  console.log(JSON.stringify(regDataA, null, 2));

  if (!regResA.ok || !regDataA.consumerNumber) {
    console.error('FAIL: Registration failed');
    process.exit(1);
  }
  if (!regDataA.invoice) {
    console.error('FAIL: Expected invoice in response but got none');
    process.exit(1);
  }
  console.log('PASS: consumer registered + invoice auto-created:', regDataA.invoice.invoiceNumber, '✓');

  // BillInquiry for consumer A
  const consumerA = regDataA.consumerNumber;
  const bundleIdPadded = String(bundle.bundle_id).padEnd(100, ' ');
  const reservedA = ' '.repeat(13) + ' '.repeat(28) + bundleIdPadded;

  const inqResA = await fetch(origin + '/api/1.0/Payments/BillInquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', username: 'demo-user', password: 'demo-pass' },
    body: JSON.stringify({ consumer_number: consumerA, bank_mnemonic: pcid, reserved: reservedA }),
  });
  const inqDataA = await inqResA.json();
  console.log('\nBillInquiry (Test A):');
  console.log(JSON.stringify(inqDataA, null, 2));

  if (inqDataA.bill_status !== 'U') {
    console.error('FAIL: Expected bill_status U but got', inqDataA.bill_status);
    process.exit(1);
  }
  console.log('PASS: bill_status = U (Unpaid) ✓');
  console.log('PASS: amount_within_dueDate =', inqDataA.amount_within_dueDate, '✓');

  // ── Test B: register WITHOUT bundleId — BillInquiry with bundleId creates invoice lazily ──
  console.log('\n── Test B: register-consumer WITHOUT bundleId (lazy invoice via BillInquiry) ──');
  const nameB = `Test Consumer B ${Date.now()}`;
  const regResB = await fetch(origin + '/api/saas/v1/register-consumer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': api_key },
    body: JSON.stringify({ name: nameB }),
  });
  const regDataB = await regResB.json();
  if (!regResB.ok || !regDataB.consumerNumber) {
    console.error('FAIL: Registration B failed');
    process.exit(1);
  }
  console.log('Registered consumer B:', regDataB.consumerNumber, '(no invoice yet)');

  const consumerB = regDataB.consumerNumber;
  const reservedB = ' '.repeat(13) + ' '.repeat(28) + bundleIdPadded;

  const inqResB = await fetch(origin + '/api/1.0/Payments/BillInquiry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', username: 'demo-user', password: 'demo-pass' },
    body: JSON.stringify({ consumer_number: consumerB, bank_mnemonic: pcid, reserved: reservedB }),
  });
  const inqDataB = await inqResB.json();
  console.log('\nBillInquiry (Test B — lazy invoice creation):');
  console.log(JSON.stringify(inqDataB, null, 2));

  if (inqDataB.bill_status !== 'U') {
    console.error('FAIL: Expected bill_status U but got', inqDataB.bill_status);
    process.exit(1);
  }
  console.log('PASS: bill_status = U (Unpaid) ✓ (invoice auto-created during inquiry)');

  // ── Clean up test data ──
  console.log('\n── Cleaning up test consumers ──');
  const toClean = [regDataA.consumerId, regDataB.consumerId].filter(Boolean);
  for (const id of toClean) {
    await pool.query('DELETE FROM invoices WHERE student_id = ?', [id]);
    await pool.query('DELETE FROM students WHERE id = ?', [id]);
  }
  console.log('Cleaned up', toClean.length, 'test consumer(s)');

  console.log('\n=== ALL TESTS PASSED ✓ ===');
  await pool.end();
}

test().catch(e => { console.error('\nUNEXPECTED ERROR:', e.message); process.exit(1); });
