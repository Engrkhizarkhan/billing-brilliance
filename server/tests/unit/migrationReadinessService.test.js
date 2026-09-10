const {
  assertDatabaseMigrationsCurrent,
  listRequiredMigrations,
} = require('../../src/services/migrationReadinessService');

describe('migration readiness service', () => {
  test('discovers every JavaScript migration in version order', async () => {
    const migrations = await listRequiredMigrations();
    expect(migrations).toContain('007_production_foundation.js');
    expect(migrations).toContain('009_org_customer_name.js');
    expect(migrations).toContain('011_consumer_registry_indexes.js');
    expect(migrations).toEqual([...migrations].sort());
  });

  test('accepts a database containing every required migration', async () => {
    const migrations = await listRequiredMigrations();
    const dbPool = { query: jest.fn().mockResolvedValue([migrations.map((version) => ({ version }))]) };

    await expect(assertDatabaseMigrationsCurrent(dbPool)).resolves.toEqual({
      required: migrations,
      applied: migrations.length,
    });
  });

  test('reports the exact missing migration instead of allowing runtime SQL failures', async () => {
    const migrations = await listRequiredMigrations();
    const applied = migrations.filter((version) => version !== '009_org_customer_name.js');
    const dbPool = { query: jest.fn().mockResolvedValue([applied.map((version) => ({ version }))]) };

    await expect(assertDatabaseMigrationsCurrent(dbPool)).rejects.toThrow(
      'Missing: 009_org_customer_name.js'
    );
  });
});
