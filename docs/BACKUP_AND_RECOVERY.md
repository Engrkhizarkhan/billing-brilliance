# Database backup and recovery

Status, 9 October 2026: tooling is available; recurring off-server backups are **not configured**. The owner has no separate storage destination yet. A same-server copy is not disaster recovery. Do not describe the platform as protected against loss of its only server.

## Prepare

Use a dedicated operating-system account and MySQL credentials with the privileges needed for a consistent dump (including routines, triggers and events). All application tables must be transactional. Avoid schema migrations during a backup. Install compatible MySQL `mysqldump` and `mysql` clients. Keep output outside the website directory, with owner-only permissions and enough disk for a full dump. Do not run from unreviewed environment files.

`server/src/operations/databaseBackup.js` uses the configured `FINTAP_ENV_FILE`. Set `BACKUP_KEY_FILE` to a protected file path. Generate it once with `node server/src/operations/databaseBackup.js keygen`; it refuses to overwrite an existing key. Preserve a separate protected copy of the key. Losing the server and its only key makes backups unrecoverable. Do not put keys, backup files or production configuration in Git or email.

## Back up and verify

```
FINTAP_ENV_FILE=/etc/fintap/backup.env BACKUP_KEY_FILE=/etc/fintap/backup.key \
  node server/src/operations/databaseBackup.js backup /var/backups/fintap/UNIQUE_TIMESTAMP.sql.gz.enc

BACKUP_KEY_FILE=/etc/fintap/backup.key \
  node server/src/operations/databaseBackup.js verify /var/backups/fintap/UNIQUE_TIMESTAMP.sql.gz.enc
```

Use a unique timestamp for every run. The tool streams a consistent MySQL dump through gzip and authenticated AES-256-GCM encryption; unsuccessful dumps remove their partial output. Existing backup files are never replaced. The verification command authenticates and decompresses; this alone does not prove application recovery.

Once independent storage is available, schedule daily backups and transfers, verify upload checksums, alert on missed/failed runs, retain multiple versions (for example 7 daily and 4 weekly), and restrict access/deletion separately from the server. Daily backups imply up to 24 hours of database loss; payment operations should target a shorter window using binary-log archiving once supported by the chosen destination. Agree recovery time and reconciliation with the operations owner.

## Restore drill

Create an **empty, isolated** MySQL database named `fintap_test_restore` and a non-production environment file pointing to it. Do not connect it to provider networks, notification endpoints or production jobs. Set `NODE_ENV=test`, `APP_ENVIRONMENT=development` in that file.

```
FINTAP_ENV_FILE=/protected/disposable-restore.env \
BACKUP_KEY_FILE=/protected/copy-of-backup.key \
RESTORE_DATABASE_CONFIRM=fintap_test_restore \
  node server/src/operations/databaseBackup.js restore-disposable /protected/backup.sql.gz.enc
```

The tool checks the database name/environment/explicit confirmation and refuses a nonempty destination. It verifies authentication before executing SQL. Temporary decrypted files have owner-only permissions and are removed on normal completion/failure; use an encrypted local disk and inspect abandoned temporary directories after a machine crash. Treat the archive as trusted operator data: encryption authenticates its source, not the SQL's intent.

Compare source/restored tenant, consumer, invoice, ledger, payment and allocation counts; run `npm run reconcile --prefix server` using the restored environment. Apply pending migrations and run isolated application smoke tests. Record duration, discrepancies, operator and archive identifier. A failed import may leave a partially populated disposable database: inspect it, then recreate that disposable target before retrying.

Database dumps exclude deployment configuration and keys. Separately preserve protected copies of production configuration, the stable API-key encryption key, TLS material, VPN configuration, deployment revision and host provisioning procedures. Never overwrite live payment history during a restore without a reviewed incident recovery and settlement reconciliation plan.

No schedule, off-server destination, storage purchase, or production restore is configured by this change.
