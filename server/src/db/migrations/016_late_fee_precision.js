// Match invoice/plan late-fee storage to the validated 1BILL monetary range.
module.exports.up = async ({ connection }) => {
  for (const table of ['invoices', 'fee_plans']) {
    await connection.query(`ALTER TABLE ${table} MODIFY late_fee DECIMAL(15,2) DEFAULT 0.00`);
  }
};
