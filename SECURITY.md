# Security Policy

Do not report vulnerabilities or disclose credentials through public GitHub issues.

Never commit environment files, passwords, API keys, VPN pre-shared keys, private certificates, database dumps, private handover files, or production SSH keys. If a credential is committed, treat it as exposed: rotate it immediately and remove it from the active branch history.

Production runtime secrets are managed outside Git in `/var/www/billing-brilliance/server/.env`. Public TLS certificate chains may be shared when required; private keys must never leave the server.

