/** Invalidate access and refresh sessions atomically when credentials change. */
module.exports.up = async ({ connection, ensureColumn }) => {
  await ensureColumn(connection, 'users', 'auth_version', 'INT UNSIGNED NOT NULL DEFAULT 0');
};
