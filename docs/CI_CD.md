# Continuous Integration and Production Deployment

## Canonical source

GitHub `Engrkhizarkhan/billing-brilliance`, branch `main`, is the canonical source. Production must not be edited manually. Every application change should be committed on a feature branch and merged only after the CI checks pass.

## Pipeline

`.github/workflows/ci-cd.yml` runs on pull requests, pushes to `main`, and manual dispatches.

The pipeline performs:

1. Frontend dependency installation, tests, lint, production build, and production dependency audit.
2. Backend dependency installation, unit tests, lint, and production dependency audit.
3. Production deployment only after both check jobs succeed and the tested event targets `main`.

## Restricted production access

GitHub Actions uses a dedicated SSH key whose server-side `authorized_keys` entry has a forced command. The key cannot open an interactive root shell, forward ports, allocate a terminal, or select an arbitrary command. It can invoke only the root-owned `/usr/local/sbin/fintap-github-deploy` program.

Repository secrets:

- `PRODUCTION_HOST`
- `PRODUCTION_PORT`
- `PRODUCTION_USER`
- `PRODUCTION_SSH_KEY`
- `PRODUCTION_KNOWN_HOSTS`

Repository variable `PRODUCTION_DEPLOY_ENABLED` is the deployment kill switch. Production deployment runs only when it is exactly `true`; setting it to `false` leaves CI active while preventing releases.

## Deployment behavior

The production deployer:

- serializes deployments with a lock;
- refuses to overwrite tracked server changes;
- accepts fast-forward updates only;
- installs locked dependencies;
- builds the frontend;
- applies forward-only database migrations;
- reloads the API and outbox worker through PM2;
- verifies `https://app.fintap.pk/api/health`;
- rolls application code back when the post-reload health check fails;
- records the deployed revision in `/var/lib/fintap/deployed-revision` and logs to `/var/log/fintap-deploy.log`.

Runtime secrets remain only in ignored server environment files. Generated reports, handover packages, PDFs, previews, and temporary files are excluded from Git.

## Normal development flow

```text
feature branch → pull request → CI checks → merge to main → automatic production deployment
```

Do not upload `.env` files, passwords, private keys, private credential handovers, database dumps, or generated customer evidence to GitHub.
