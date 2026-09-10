/** Support newest-first organization applicant rows in the admin consumer registry. */
module.exports.up = async ({ connection, ensureIndex }) => {
  await ensureIndex(
    connection,
    'applicants',
    'idx_applicants_tenant_created',
    'INDEX `idx_applicants_tenant_created` (`tenant_id`, `created_at`, `id`)'
  );
};
