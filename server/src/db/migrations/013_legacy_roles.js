// Widen before converting legacy ENUM values; changing the value first fails
// under MySQL strict mode. Run once under the checksummed migration runner.
module.exports.up = async ({ connection }) => {
  for (const [table, column, values] of [
    ['users', 'role', ['admin', 'school', 'org']],
    ['tenants', 'type', ['school', 'org', 'private_agency']],
  ]) {
    const [[definition]] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
    if (!definition.Type.includes("'etea'")) continue;
    const combined = [...values, 'etea'].map(value => `'${value}'`).join(',');
    await connection.query(`ALTER TABLE ${table} MODIFY ${column} ENUM(${combined}) NOT NULL`);
    await connection.query(`UPDATE ${table} SET ${column} = 'org' WHERE ${column} = 'etea'`);
    await connection.query(`ALTER TABLE ${table} MODIFY ${column} ENUM(${values.map(value => `'${value}'`).join(',')}) NOT NULL`);
  }
};
