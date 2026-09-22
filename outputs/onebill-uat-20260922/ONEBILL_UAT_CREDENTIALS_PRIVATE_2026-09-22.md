# Fintap / 1BILL UAT Credentials — Private

Date: 22 September 2026  
Classification: internal secret handover — do not email or send to 1LINK as part of the public handover package.

## Dashboard operator accounts

| Dashboard | Email | Temporary UAT password |
|---|---|---|
| School | `uat.school@fintap.pk` | `FintapUAT#School-2026!` |
| Transport organization | `uat.transport@fintap.pk` | `FintapUAT#Transport-2026!` |

These accounts are for Fintap operators. Rotate or disable them after UAT.

## 1BILL REST header credentials

The exact active pair remains in `/var/www/billing-brilliance/server/.env` on `root@178.238.236.126`:

- Username variable: `ONELINK_USERNAME`
- Password variable: `ONELINK_PASSWORD`

Retrieve the values only inside the trusted SSH session and transfer them through the secure channel agreed with 1LINK. They are intentionally not duplicated into this workstation file, source control, screenshots, email, or the external ZIP. Coordinate any rotation with 1LINK because both sides must change together.

