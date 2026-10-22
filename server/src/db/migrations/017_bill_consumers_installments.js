module.exports.up = async ({connection,ensureColumn,ensureIndex}) => {
  await ensureColumn(connection,'tenants','billing_mode',"ENUM('legacy','invoice') NOT NULL DEFAULT 'legacy'");
  await ensureColumn(connection,'tenants','installments_enabled','TINYINT(1) NOT NULL DEFAULT 0');
  await connection.query('ALTER TABLE students MODIFY consumer_number VARCHAR(24) NULL');
  await ensureColumn(connection,'invoices','bill_specific','TINYINT(1) NOT NULL DEFAULT 0');
  await ensureColumn(connection,'invoices','installment_plan_id','VARCHAR(36) NULL');
  await ensureColumn(connection,'invoices','installment_number','INT NULL');
  await ensureColumn(connection,'invoices','installment_count','INT NULL');
  await ensureColumn(connection,'invoices','payment_consumer_number',
    'VARCHAR(24) GENERATED ALWAYS AS (CASE WHEN bill_specific = 1 THEN consumer_number ELSE NULL END) STORED');
  await ensureIndex(connection,'invoices','uk_invoice_payment_consumer','UNIQUE INDEX uk_invoice_payment_consumer (payment_consumer_number)');
  await connection.query(`CREATE TABLE IF NOT EXISTS consumer_number_reservations (
    consumer_number VARCHAR(24) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_reserved_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  for(const table of ['students','applicants','org_payment_records','invoices']) {
    await connection.query(`INSERT IGNORE INTO consumer_number_reservations (consumer_number,tenant_id)
      SELECT consumer_number,tenant_id FROM ${table} WHERE consumer_number IS NOT NULL AND consumer_number <> ''`);
  }
  await connection.query(`CREATE TABLE IF NOT EXISTS invoice_requests (
    tenant_id VARCHAR(36) NOT NULL, request_key VARCHAR(100) NOT NULL, request_hash CHAR(64) NOT NULL,
    invoice_id VARCHAR(36) NOT NULL, PRIMARY KEY (tenant_id,request_key)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await connection.query(`CREATE TABLE IF NOT EXISTS invoice_installment_plans (
    id VARCHAR(36) PRIMARY KEY, tenant_id VARCHAR(36) NOT NULL, student_id VARCHAR(36) NOT NULL,
    original_invoice_id VARCHAR(36) NOT NULL, total_amount DECIMAL(15,2) NOT NULL,
    request_hash CHAR(64) NOT NULL, created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_installment_original (original_invoice_id), INDEX idx_installment_tenant (tenant_id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
};
