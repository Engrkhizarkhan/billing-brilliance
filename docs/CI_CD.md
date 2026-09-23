# CI and release automation

The workflow `.github/workflows/ci-cd.yml` runs frontend tests, lint and a type-checked build; backend tests/lint; production dependency audits; and transaction/concurrency regressions against a disposable MySQL 8.4 service. Node 22 is used throughout. Database tests require INTEGRATION_DATABASE_CONFIRM to match a non-production disposable DB name.

Production deploy depends on successful check jobs, a main-branch run, PRODUCTION_DEPLOY_ENABLED=true, and the configured GitHub production environment. SSH uses a restricted key and pinned known-hosts data. It sends the **tested GITHUB_SHA**, not an instruction to release whichever main commit is newest when the host fetches.

Read [the deployment runbook](PRODUCTION_DEPLOYMENT_RUNBOOK.md) before installing the updated forced-command script: it requires release directories, a shared environment file and an active-release symlink. Existing in-place hosts must be provisioned before enabling this workflow. Staging/rollback/provider UAT gates remain required even when CI is green.
