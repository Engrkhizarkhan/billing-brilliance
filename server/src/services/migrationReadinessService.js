const fs = require('fs/promises');
const path = require('path');

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, '..', 'db', 'migrations');

const listRequiredMigrations = async (migrationsDir = DEFAULT_MIGRATIONS_DIR) => {
  const files = await fs.readdir(migrationsDir);
  return files.filter((file) => /^\d+.*\.js$/.test(file)).sort();
};

const assertDatabaseMigrationsCurrent = async (dbPool, options = {}) => {
  const required = await listRequiredMigrations(options.migrationsDir);
  let rows;
  try {
    [rows] = await dbPool.query('SELECT version FROM schema_migrations');
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      throw new Error('Database migration history is missing. Run npm run migrate before starting the API.');
    }
    throw error;
  }

  const applied = new Set(rows.map((row) => row.version));
  const missing = required.filter((file) => !applied.has(file));
  if (missing.length > 0) {
    throw new Error(`Database schema is not current. Run npm run migrate. Missing: ${missing.join(', ')}`);
  }

  return { required, applied: required.length };
};

module.exports = { assertDatabaseMigrationsCurrent, listRequiredMigrations };
