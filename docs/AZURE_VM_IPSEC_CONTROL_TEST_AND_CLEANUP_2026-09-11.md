# Azure VM to Fintap IPsec Control Test and Cleanup Record

Date: 2026-09-11

## Executive result

A second real Ubuntu server was configured as an isolated IKEv2/IPsec initiator and tested against the production Fintap VM. The tunnel remains established after the SSH test command completed.

Every tested layer passed:

- IKEv2 IKE_SA established.
- PSK authentication succeeded in both directions.
- AES-256-CBC, SHA-256, PRF-SHA-256, and ECP/DH Group 19 negotiated.
- CHILD SA installed with the intended traffic selectors.
- NAT traversal successfully used UDP 4500.
- Protected ping returned 3/3 replies with 0% loss.
- HTTPS reached Fintap through the protected IP and returned HTTP 200.
- An authenticated, read-only 1BILL Bill Inquiry returned HTTP 200 and `response_Code: "01"` for a deliberately nonexistent consumer.
- Encrypted outer traffic and decrypted protected traffic were captured on both servers.
- No payment API was called and no financial record was created, updated, paid, or deleted.
- The production Fintap API remained ready.
- The original `onebill` connection remained loaded and unchanged.

This real-server test independently validates Fintap's public IKE endpoint, NAT-T, StrongSwan configuration pattern, Linux XFRM processing, protected IP, TCP/443, TLS, Nginx, API authentication, source allowlist, controller, database lookup, and response formatting.

## Test topology

```text
Azure Ubuntu VM
Public/NAT: 20.187.97.214
Protected:  10.1.1.4/32
        |
        | IKEv2 UDP 500 -> NAT-T UDP 4500
        | AES-256 / SHA-256 / PRF-SHA-256 / DH19
        v
Fintap production VM
Public:    178.238.236.126
Protected: 172.31.254.10/32
HTTPS:     TCP 443
```

The Azure VM already had the private NIC address `10.1.1.4/24`. The test used `10.1.1.4/32` as the protected host selector. No invented loopback address or Azure routing change was required.

## Connection isolation

The new control connection is separate:

- Connection: `azure-test`
- CHILD SA: `azure-test-https`
- Initiator public IKE ID: `20.187.97.214`
- Responder public IKE ID: `178.238.236.126`
- Azure protected selector: `10.1.1.4/32`
- Fintap protected selector: `172.31.254.10/32`
- IKE proposal: `aes256-sha256-prfsha256-ecp256`
- ESP proposal: `aes256-sha256-ecp256`
- IKE lifetime/rekey: 28,800 seconds
- CHILD lifetime: 28,800 seconds
- CHILD rekey: 27,000 seconds
- MOBIKE: disabled
- Authentication: a separate random test-only PSK

The original 1LINK connection remains:

- Connection: `onebill`
- 1LINK public peer: `103.248.140.4`
- Fintap public endpoint: `178.238.236.126`
- 1LINK protected IPs: `10.95.8.92/32` and `10.95.8.94/32`
- Fintap protected IP: `172.31.254.10/32`

The test PSK is not included in this document and was never printed. It is stored only in the temporary root-owned StrongSwan files identified below.

## Negotiation evidence

Azure reported:

```text
sending packet: from 10.1.1.4[500] to 178.238.236.126[500]
received packet: from 178.238.236.126[500] to 10.1.1.4[500]
selected proposal: IKE:AES_CBC_256/HMAC_SHA2_256_128/PRF_HMAC_SHA2_256/ECP_256
local host is behind NAT
authentication of '178.238.236.126' with pre-shared key successful
IKE_SA azure-test established
CHILD_SA azure-test-https established
TS 10.1.1.4/32 === 172.31.254.10/32
```

Fintap independently reported:

```text
received packet: from 20.187.97.214[500] to 178.238.236.126[500]
selected peer config 'azure-test'
authentication of '20.187.97.214' with pre-shared key successful
IKE_SA azure-test established
CHILD_SA azure-test-https established
TS 172.31.254.10/32 === 10.1.1.4/32
```

## Protected-path results

### Ping

```text
Source: 10.1.1.4
Destination: 172.31.254.10
3 packets transmitted, 3 received, 0% packet loss
```

### HTTPS health

```text
Source: 10.1.1.4
Destination: 172.31.254.10:443
TLS SNI/Host: app.fintap.pk
Result: HTTP 200
Service: fintap-api
Environment: production
```

### Authenticated Bill Inquiry

```text
POST /api/1.0/Payments/BillInquiry
Protected source: 10.1.1.4
Result: HTTP 200
1BILL response_Code: 01
Meaning: deliberately nonexistent test consumer was not found
```

The API credential material was transferred in memory, stored briefly in a root-only curl configuration, and deleted immediately after the request. Its deletion was verified.

`response_Code: "01"` is the expected 1BILL application response for an authenticated, valid-format inquiry where the consumer does not exist. It proves the request passed source-IP and credential authentication and reached the inquiry controller/database.

## Live SA counters

Azure recorded:

```text
azure-test: ESTABLISHED, IKEv2
azure-test-https: INSTALLED, TUNNEL-in-UDP
out: 29 encrypted packets
in:  24 encrypted packets
```

Fintap recorded the matching reverse direction:

```text
azure-test: ESTABLISHED, IKEv2
azure-test-https: INSTALLED, TUNNEL-in-UDP
in:  29 encrypted packets
out: 26 encrypted packets
```

Packet captures on both hosts also showed:

- Bidirectional IKE on UDP 500
- Bidirectional IKE_AUTH and ESP-in-UDP on UDP 4500
- NAT keepalives
- Decrypted ICMP between `10.1.1.4` and `172.31.254.10`
- Decrypted TLS/TCP traffic between `10.1.1.4` and `172.31.254.10:443`

## Current state intentionally left for verification

- `azure-test` is currently established on both real servers.
- StrongSwan is active on both servers.
- The `azure-ipsec-monitor.service` transient capture is active on both servers with a one-hour maximum runtime.
- Fintap currently has three runtime definitions: `onebill`, `laptop-test`, and `azure-test`.
- Fintap's application allowlist currently contains `10.95.8.92`, `10.95.8.94`, `172.31.253.20`, and temporary Azure protected IP `10.1.1.4`.
- The Fintap production API is ready.

## Temporary artifacts

### Fintap VM

- `/etc/swanctl/azure-test.conf`
- `/etc/swanctl/control-test-load.conf`
- `/root/fintap-azure-ipsec-test/azure-test.conf`
- `/root/fintap-azure-ipsec-test/fintap-packets.log`
- `/root/fintap-azure-ipsec-test/server.env.before-azure-allowlist`
- Runtime connection `azure-test`
- Transient service `azure-ipsec-monitor.service`
- Application allowlist entry `10.1.1.4`
- One controlled reload of `Fintap-api-backend`

### Azure VM

- `/etc/swanctl/azure-test.conf`
- `/root/fintap-azure-ipsec-test/azure-test.conf`
- `/root/fintap-azure-ipsec-test/azure-packets.log`
- Runtime connection and SA `azure-test`
- Transient service `azure-ipsec-monitor.service`
- Newly installed packages:
  - `strongswan-swanctl`
  - `charon-systemd`
  - `strongswan-libcharon`
  - `libstrongswan`
  - `libstrongswan-standard-plugins`
  - `libcharon-extauth-plugins`

The Azure NIC private IP `10.1.1.4` existed before testing and must not be deleted.

## Read-only verification commands

On Fintap:

```bash
swanctl --list-sas
swanctl --list-conns
tail -n 200 /root/fintap-azure-ipsec-test/fintap-packets.log
journalctl -u strongswan --since '-30 minutes' --no-pager
```

On Azure:

```bash
sudo swanctl --list-sas
sudo swanctl --list-conns
sudo tail -n 200 /root/fintap-azure-ipsec-test/azure-packets.log
sudo journalctl -u strongswan --since '-30 minutes' --no-pager
```

## Cleanup procedure

Run cleanup only after this control tunnel is no longer required. If 1LINK has an active production SA, coordinate the Fintap credential reload carefully.

### 1. Azure VM cleanup

```bash
set -Eeuo pipefail

sudo systemctl stop azure-ipsec-monitor.service 2>/dev/null || true
sudo systemctl reset-failed azure-ipsec-monitor.service 2>/dev/null || true
sudo swanctl --terminate --ike azure-test 2>/dev/null || true
sudo swanctl --load-all

sudo rm -f -- /etc/swanctl/azure-test.conf
sudo rm -f -- /root/fintap-azure-ipsec-test/azure-test.conf
sudo rm -f -- /root/fintap-azure-ipsec-test/azure-packets.log
sudo rmdir --ignore-fail-on-non-empty /root/fintap-azure-ipsec-test
```

If StrongSwan has no other purpose on the Azure VM, it can then be removed completely:

```bash
sudo systemctl disable --now strongswan
sudo apt-get purge -y \
  strongswan-swanctl \
  charon-systemd \
  strongswan-libcharon \
  libstrongswan \
  libstrongswan-standard-plugins \
  libcharon-extauth-plugins
sudo apt-get autoremove -y
```

Do not remove Azure's existing `10.1.1.4/24` NIC address.

### 2. Fintap VM cleanup

```bash
set -Eeuo pipefail

systemctl stop azure-ipsec-monitor.service 2>/dev/null || true
systemctl reset-failed azure-ipsec-monitor.service 2>/dev/null || true
swanctl --terminate --ike azure-test 2>/dev/null || true

python3 - <<'PY'
from pathlib import Path

path = Path('/var/www/billing-brilliance/server/.env')
lines = path.read_text().splitlines()
key = 'ONELINK_ALLOWED_IPS='
remove = {'10.1.1.4'}
output = []
for line in lines:
    if line.startswith(key):
        values = [v.strip() for v in line[len(key):].split(',') if v.strip()]
        values = [v for v in values if v not in remove]
        output.append(key + ','.join(values))
    else:
        output.append(line)
path.write_text('\n'.join(output) + '\n')
PY

pm2 reload Fintap-api-backend --update-env

# Preserve the original 1LINK and laptop control definitions if the laptop
# files still exist. Otherwise load only the original production definition.
if [ -f /etc/swanctl/laptop-load.conf ]; then
  swanctl --load-conns --file /etc/swanctl/laptop-load.conf
  swanctl --load-creds --clear --file /etc/swanctl/laptop-load.conf
else
  swanctl --load-conns --file /etc/swanctl/swanctl.conf
  swanctl --load-creds --clear --file /etc/swanctl/swanctl.conf
fi

rm -f -- /etc/swanctl/azure-test.conf
rm -f -- /etc/swanctl/control-test-load.conf
rm -f -- /root/fintap-azure-ipsec-test/azure-test.conf
rm -f -- /root/fintap-azure-ipsec-test/fintap-packets.log
rm -f -- /root/fintap-azure-ipsec-test/server.env.before-azure-allowlist
rmdir --ignore-fail-on-non-empty /root/fintap-azure-ipsec-test

grep '^ONELINK_ALLOWED_IPS=' /var/www/billing-brilliance/server/.env
swanctl --list-conns
curl -fsS -H 'X-Forwarded-Proto: https' http://127.0.0.1:3000/api/ready
```

The `--clear` credential reload removes the temporary Azure PSK from StrongSwan memory and immediately reloads the retained credentials. Perform it during a controlled window if a production IKE SA is active.

## Items that must not be removed

- `/etc/swanctl/swanctl.conf`
- The `onebill`, `onebill-92`, or `onebill-94` definitions
- `/etc/systemd/system/onebill-vpn-ip.service`
- Fintap protected IP `172.31.254.10/32`
- 1LINK allowlist entries `10.95.8.92` and `10.95.8.94`
- Azure NIC address `10.1.1.4/24`
- Nginx, TLS certificates, PM2 production services, or databases

## Conclusion suitable for 1LINK

Fintap established and maintained a complete site-to-site IKEv2/IPsec tunnel with a second external Ubuntu server. The required AES-256/SHA-256/Group-19 proposals, PSK authentication, NAT-T, CHILD SA, bidirectional protected traffic, TLS/443, and authenticated 1BILL inquiry all succeeded. Fintap's endpoint and protected application path are operational. If no packet from the configured 1LINK public peer `103.248.140.4` appears at Fintap, 1LINK must verify the peer is enabled and actually transmitting from that address toward `178.238.236.126`.
