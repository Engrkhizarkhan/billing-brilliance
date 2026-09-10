/** Add authenticated encryption for PIN-gated administrative key recovery. */
module.exports.up = async ({ connection, ensureColumn }) => {
  await ensureColumn(connection, 'tenants', 'api_key_encrypted', 'TEXT NULL AFTER `api_key_hash`');
};
