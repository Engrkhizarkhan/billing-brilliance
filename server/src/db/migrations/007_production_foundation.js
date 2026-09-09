/**
 * Additive production foundation for tenant lifecycle, deterministic consumer
 * numbers, atomic payment metadata, allocations and a durable outbox.
 */
module.exports.up = async ({ connection, ensureColumn, ensureIndex }) => {
  await ensureColumn(connection, 'tenants', 'api_key_hash', 'CHAR(64) NULL AFTER `api_key`');
  await ensureColumn(connection, 'tenants', 'api_key_prefix', 'VARCHAR(24) NULL AFTER `api_key_hash`');
  await ensureColumn(connection, 'tenants', 'api_key_scope', "ENUM('live','test') NOT NULL DEFAULT 'live' AFTER `api_key_prefix`");
  await ensureColumn(connection, 'tenants', 'api_key_rotated_at', 'TIMESTAMP NULL AFTER `api_key_scope`');
  await ensureIndex(connection, 'tenants', 'uk_tenants_api_key_hash', 'UNIQUE INDEX `uk_tenants_api_key_hash` (`api_key_hash`)');
  const crypto = require('crypto');
  const [legacyKeys] = await connection.query('SELECT id, api_key FROM tenants WHERE api_key IS NOT NULL AND api_key_hash IS NULL');
  for (const tenant of legacyKeys) {
    const hash = crypto.createHash('sha256').update(String(tenant.api_key)).digest('hex');
    await connection.query(
      'UPDATE tenants SET api_key_hash = ?, api_key_prefix = ?, api_key = NULL WHERE id = ?',
      [hash, String(tenant.api_key).slice(0, 12), tenant.id]
    );
  }
  await ensureColumn(connection, 'tenants', 'lifecycle_stage',
    "ENUM('testing','ready_for_live','live','offboarding') NOT NULL DEFAULT 'testing' AFTER `status`");
  await ensureColumn(connection, 'tenants', 'consumer_number_length',
    'TINYINT UNSIGNED NOT NULL DEFAULT 24 AFTER `lifecycle_stage`');
  await ensureColumn(connection, 'tenants', 'next_consumer_sequence',
    'BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER `consumer_number_length`');
  await ensureColumn(connection, 'tenants', 'suspension_reason', 'VARCHAR(500) NULL AFTER `next_consumer_sequence`');
  await ensureColumn(connection, 'tenants', 'suspended_at', 'TIMESTAMP NULL AFTER `suspension_reason`');
  await ensureColumn(connection, 'tenants', 'suspended_by', 'VARCHAR(36) NULL AFTER `suspended_at`');
  await ensureColumn(connection, 'tenants', 'restored_at', 'TIMESTAMP NULL AFTER `suspended_by`');
  await ensureColumn(connection, 'tenants', 'activated_at', 'TIMESTAMP NULL AFTER `restored_at`');
  await ensureColumn(connection, 'tenants', 'activated_by', 'VARCHAR(36) NULL AFTER `activated_at`');
  await ensureColumn(connection, 'tenants', 'activation_checklist', 'JSON NULL AFTER `activated_by`');
  await ensureIndex(connection, 'tenants', 'idx_tenants_lifecycle', 'INDEX `idx_tenants_lifecycle` (`lifecycle_stage`)');

  // Existing billers are already serving production traffic. Grandfather their
  // present identifier length and live state; new billers default to testing/24.
  await connection.query(`
    UPDATE tenants t
    LEFT JOIN (
      SELECT tenant_id, MAX(CHAR_LENGTH(consumer_number)) AS consumer_length,
             MAX(seq_number) AS max_seq
      FROM students GROUP BY tenant_id
    ) s ON s.tenant_id = t.id
    LEFT JOIN (
      SELECT tenant_id, MAX(CHAR_LENGTH(consumer_number)) AS consumer_length
      FROM org_payment_records GROUP BY tenant_id
    ) o ON o.tenant_id = t.id
    SET t.lifecycle_stage = 'live',
        t.consumer_number_length = CASE
          WHEN GREATEST(COALESCE(s.consumer_length, 0), COALESCE(o.consumer_length, 0)) IN (14,20,24)
          THEN GREATEST(COALESCE(s.consumer_length, 0), COALESCE(o.consumer_length, 0))
          ELSE 24 END,
        t.next_consumer_sequence = GREATEST(COALESCE(s.max_seq, 0) + 1, t.next_consumer_sequence)
    WHERE t.created_at < CURRENT_TIMESTAMP
  `);

  // Advance the shared allocator beyond every legacy consumer namespace. The
  // identifier is globally visible to 1LINK even though legacy unique keys are
  // table-local, so students, applicants and org payment requests must not
  // reuse one another's suffixes.
  const prefix = String(require('../../config').fintechPrefix);
  const [tenantNamespaces] = await connection.query(
    'SELECT id, biller_code, next_consumer_sequence FROM tenants WHERE deleted_at IS NULL'
  );
  for (const tenant of tenantNamespaces) {
    const namespace = `${prefix}${tenant.biller_code}`;
    const [identifiers] = await connection.query(
      `SELECT consumer_number FROM students WHERE tenant_id = ?
       UNION ALL SELECT consumer_number FROM applicants WHERE tenant_id = ?
       UNION ALL SELECT consumer_number FROM org_payment_records WHERE tenant_id = ?`,
      [tenant.id, tenant.id, tenant.id]
    );
    const maxLegacySequence = identifiers.reduce((max, row) => {
      const value = String(row.consumer_number || '');
      if (!value.startsWith(namespace)) return max;
      const suffix = value.slice(namespace.length);
      if (!/^\d+$/.test(suffix)) return max;
      const sequence = Number(suffix);
      return Number.isSafeInteger(sequence) ? Math.max(max, sequence) : max;
    }, 0);
    const next = Math.max(Number(tenant.next_consumer_sequence) || 1, maxLegacySequence + 1);
    await connection.query('UPDATE tenants SET next_consumer_sequence = ? WHERE id = ?', [next, tenant.id]);
  }

  await ensureColumn(connection, 'applicants', 'seq_number', 'INT UNSIGNED NOT NULL DEFAULT 0 AFTER `bill_id`');
  await ensureIndex(connection, 'applicants', 'idx_applicants_seq', 'INDEX `idx_applicants_seq` (`tenant_id`, `seq_number`)');

  await ensureColumn(connection, 'payments', 'source',
    "ENUM('onelink','manual','org_callback','saas_api','sandbox_simulator') NOT NULL DEFAULT 'manual' AFTER `note`");
  await ensureColumn(connection, 'payments', 'status',
    "ENUM('posted','reversed','voided') NOT NULL DEFAULT 'posted' AFTER `source`");
  await ensureColumn(connection, 'payments', 'received_at', 'DATETIME NULL AFTER `status`');
  await ensureColumn(connection, 'payments', 'created_by_user_id', 'VARCHAR(36) NULL AFTER `received_at`');
  await ensureColumn(connection, 'payments', 'idempotency_key', 'VARCHAR(255) NULL AFTER `created_by_user_id`');
  await ensureColumn(connection, 'payments', 'currency', "CHAR(3) NOT NULL DEFAULT 'PKR' AFTER `idempotency_key`");
  await ensureColumn(connection, 'payments', 'reversal_of_payment_id', 'VARCHAR(36) NULL AFTER `currency`');
  await ensureIndex(connection, 'payments', 'uk_payments_idempotency_tenant',
    'UNIQUE INDEX `uk_payments_idempotency_tenant` (`idempotency_key`, `tenant_id`)');
  await ensureIndex(connection, 'payments', 'idx_payments_received',
    'INDEX `idx_payments_received` (`tenant_id`, `received_at`)');

  await connection.query(`
    CREATE TABLE IF NOT EXISTS payment_allocations (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NOT NULL,
      payment_id VARCHAR(36) NOT NULL,
      target_type ENUM('invoice','org_payment','ledger_charge') NOT NULL,
      target_id VARCHAR(36) NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_payment_allocation_target (payment_id, target_type, target_id),
      INDEX idx_allocations_tenant (tenant_id),
      INDEX idx_allocations_target (target_type, target_id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
      FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS outbox_events (
      id VARCHAR(36) PRIMARY KEY,
      tenant_id VARCHAR(36) NULL,
      event_type VARCHAR(100) NOT NULL,
      aggregate_type VARCHAR(100) NOT NULL,
      aggregate_id VARCHAR(100) NOT NULL,
      payload JSON NOT NULL,
      status ENUM('pending','processing','delivered','failed') NOT NULL DEFAULT 'pending',
      attempts INT UNSIGNED NOT NULL DEFAULT 0,
      available_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processing_started_at DATETIME NULL,
      processed_at DATETIME NULL,
      last_error TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_outbox_delivery (status, available_at),
      INDEX idx_outbox_tenant (tenant_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureColumn(connection, 'outbox_events', 'processing_started_at', 'DATETIME NULL AFTER `available_at`');

  await ensureIndex(connection, 'transactions', 'idx_transactions_tenant_date',
    'INDEX `idx_transactions_tenant_date` (`tenant_id`, `date`, `created_at`)');
  await ensureIndex(connection, 'invoices', 'idx_invoices_tenant_status_due',
    'INDEX `idx_invoices_tenant_status_due` (`tenant_id`, `status`, `due_date`)');
  await ensureIndex(connection, 'org_payment_records', 'idx_org_pay_tenant_status_created',
    'INDEX `idx_org_pay_tenant_status_created` (`tenant_id`, `status`, `created_at`)');

  await connection.query('ALTER TABLE refresh_tokens MODIFY COLUMN token VARCHAR(500) NULL');
  await ensureColumn(connection, 'refresh_tokens', 'token_hash', 'CHAR(64) NULL AFTER `token`');
  const [legacyTokens] = await connection.query('SELECT id, token FROM refresh_tokens WHERE token IS NOT NULL AND token_hash IS NULL');
  for (const row of legacyTokens) {
    const hash = crypto.createHash('sha256').update(String(row.token)).digest('hex');
    await connection.query('UPDATE refresh_tokens SET token_hash = ?, token = NULL WHERE id = ?', [hash, row.id]);
  }
  await ensureIndex(connection, 'refresh_tokens', 'uk_refresh_token_hash', 'UNIQUE INDEX `uk_refresh_token_hash` (`token_hash`)');
};
