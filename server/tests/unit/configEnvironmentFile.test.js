const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('runtime environment file selection', () => {
  test('loads an explicitly selected sandbox environment without production fallthrough', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fintap-env-'));
    const envFile = path.join(directory, '.env.sandbox');
    fs.writeFileSync(envFile, [
      'NODE_ENV=production',
      'APP_ENVIRONMENT=sandbox',
      'PORT=3901',
      'DB_NAME=Fintap_sandbox_unit',
      'ADMIN_ACTION_PIN=654321',
      `API_KEY_ENCRYPTION_KEY=${Buffer.alloc(32, 7).toString('base64')}`,
    ].join('\n'));

    const childEnv = {
      ...process.env,
      FINTAP_ENV_FILE: envFile,
      // Simulate stale values inherited from a PM2 daemon. The selected file
      // must remain authoritative for environment isolation.
      APP_ENVIRONMENT: 'production',
      PORT: '3000',
      DB_NAME: 'Fintap',
      ADMIN_ACTION_PIN: '111111',
      API_KEY_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64'),
    };

    const configPath = path.resolve(__dirname, '../../src/config');
    const script = `const c=require(${JSON.stringify(configPath)}); process.stdout.write(JSON.stringify({env:c.appEnvironment,port:c.port,db:c.db.database,pin:c.admin.actionPin,key:c.apiKeyEncryptionKey,path:c.envFilePath}))`;
    const result = spawnSync(process.execPath, ['-e', script], { env: childEnv, encoding: 'utf8' });

    try {
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        env: 'sandbox',
        port: 3901,
        db: 'Fintap_sandbox_unit',
        pin: '654321',
        key: Buffer.alloc(32, 7).toString('base64'),
        path: envFile,
      });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test('does not expose the 1LINK namespace from a sandbox runtime', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fintap-sandbox-route-'));
    const envFile = path.join(directory, '.env.sandbox');
    fs.writeFileSync(envFile, [
      'NODE_ENV=production',
      'APP_ENVIRONMENT=sandbox',
      'PORT=3901',
      'TRUST_PROXY_HOPS=1',
      'REQUIRE_HTTPS=true',
      'DB_NAME=Fintap_sandbox_unit',
      'DB_USER=sandbox_unit',
      'DB_PASSWORD=sandbox_unit_password',
      `JWT_SECRET=${'a'.repeat(64)}`,
      `JWT_REFRESH_SECRET=${'b'.repeat(64)}`,
      'ADMIN_ACTION_PIN=654321',
      `API_KEY_ENCRYPTION_KEY=${Buffer.alloc(32, 7).toString('base64')}`,
      `SANDBOX_PURGE_SECRET=${'c'.repeat(64)}`,
      `ORG_WEBHOOK_SECRET=${'d'.repeat(64)}`,
      'REQUIRE_WEBHOOK_SIGNATURE=true',
      'FINTECH_PREFIX=105172',
      'CORS_ORIGIN=https://app.fintap.pk',
    ].join('\n'));

    const indexPath = path.resolve(__dirname, '../../src/index');
    const databasePath = path.resolve(__dirname, '../../src/config/database');
    const script = [
      "const request=require('supertest')",
      `const app=require(${JSON.stringify(indexPath)})`,
      `const {pool}=require(${JSON.stringify(databasePath)})`,
      "request(app).post('/api/1.0/Payments/BillInquiry').set('X-Forwarded-Proto','https').send({}).then(async r=>{process.stdout.write(JSON.stringify({status:r.status,body:r.body}));await pool.end()}).catch(async e=>{console.error(e);await pool.end();process.exit(1)})",
    ].join(';');
    const result = spawnSync(process.execPath, ['-e', script], {
      cwd: path.resolve(__dirname, '../..'),
      env: { ...process.env, FINTAP_ENV_FILE: envFile },
      encoding: 'utf8',
    });

    try {
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toEqual({
        status: 404,
        body: { error: 'Route /api/1.0/Payments/BillInquiry not found', code: 'NOT_FOUND' },
      });
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
