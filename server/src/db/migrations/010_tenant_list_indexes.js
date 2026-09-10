/**
 * Composite indexes for the high-volume tenant lists used by school and
 * organization dashboards. These preserve tenant isolation while allowing
 * newest-first pagination without scanning another tenant's rows.
 */
module.exports.up = async ({ connection, ensureIndex }) => {
  await ensureIndex(
    connection,
    'students',
    'idx_students_tenant_created',
    'INDEX `idx_students_tenant_created` (`tenant_id`, `created_at`, `id`)'
  );
  await ensureIndex(
    connection,
    'org_payment_records',
    'idx_org_pay_tenant_created',
    'INDEX `idx_org_pay_tenant_created` (`tenant_id`, `created_at`, `id`)'
  );
  await ensureIndex(
    connection,
    'org_payment_notifications',
    'idx_org_notif_tenant_sent',
    'INDEX `idx_org_notif_tenant_sent` (`tenant_id`, `sent_at`)'
  );
};
