module.exports.up = async ({ connection, ensureColumn }) => {
  await ensureColumn(connection, 'org_payment_records', 'late_fee', 'DECIMAL(15,2) NOT NULL DEFAULT 0');
  await ensureColumn(connection, 'org_payment_records', 'paid_amount', 'DECIMAL(15,2) NULL');
};
