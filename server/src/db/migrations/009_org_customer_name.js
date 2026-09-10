module.exports.up = async ({ connection, ensureColumn }) => {
  await ensureColumn(connection, 'org_payment_records', 'customer_name', 'VARCHAR(255) NULL AFTER `applicant_id`');
};
