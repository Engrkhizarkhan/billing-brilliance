# Laptop-to-Fintap IPsec Control Test and Cleanup Record

Date: 2026-09-11

## Executive result

A separate laptop-controlled IKEv2/IPsec peer was configured and tested against the production Fintap VM without changing the existing 1LINK connection definition.

The control test passed end-to-end:

- IKE_SA established successfully.
- Pre-shared-key authentication succeeded in both directions.
- CHILD_SA installed successfully.
- NAT traversal switched from UDP 500 to UDP 4500 correctly.
- AES-256-CBC, SHA-256, PRF-SHA-256, and ECP/DH Group 19 were negotiated.
- Protected-IP ping succeeded: 3 sent, 3 received, 0% loss.
- HTTPS over the protected tunnel returned HTTP 200.
- An authenticated, read-only 1BILL Bill Inquiry travelled through the tunnel and returned HTTP 200 with 1BILL `response_Code: "01"` for a deliberately nonexistent consumer.
- Packet captures on both the laptop and VM showed encrypted packets in both directions and decrypted TCP/443 traffic between the protected IPs.
- No payment request was sent and no database record was created, paid, updated, or deleted.

This is strong evidence that the Fintap VM can accept and respond to a correctly configured external IKEv2 peer. It does not prove every setting on the 1LINK device, but it narrows the remaining 1LINK issue to the exact 1LINK path/configuration if no packets from `103.248.140.4` reach the VM.

## Independent repeat test

The complete test was repeated at 2026-09-11 16:59 server time (CEST) using a new IKE SA and CHILD SA. The repeat passed:

- Server received the new IKE_SA_INIT from `103.18.15.132` on UDP 500.
- Both peers authenticated successfully using the test PSK.
- NAT-T continued on UDP 4500.
- CHILD SA traffic selectors were `172.31.253.20/32 === 172.31.254.10/32`.
- Protected ping again returned 3/3 replies with 0% loss.
- Protected HTTPS health returned HTTP 200.
- Authenticated Bill Inquiry returned HTTP 200 and `response_Code: "01"`.
- Client SA counters recorded 25 outbound and 22 inbound encrypted packets.
- VM capture independently showed the matching encrypted ESP-in-UDP packets and decrypted TCP/443 sessions.
- The client closed the temporary SA cleanly after testing.
- StrongSwan and the production API remained active and ready afterward.
- The temporary API credential file was confirmed deleted.

## Check after 1LINK again reported “tunnel down”

At 2026-09-11 20:37 server time (CEST), the VM was checked immediately after the report:

- StrongSwan was active.
- UDP 500 and UDP 4500 were listening on IPv4 and IPv6.
- The `onebill` definition remained loaded with the expected peer and selectors.
- No IKE SA or CHILD SA from 1LINK was active.
- The preceding 60 minutes of StrongSwan logs contained no packet from `103.248.140.4`.
- The dedicated passive monitor contained no packet from `103.248.140.4`.
- A new 30-second capture restricted to `103.248.140.4` captured zero matching packets.
- An IKE rejection at 20:31 originated from unrelated address `66.132.195.113`, not from 1LINK.

Therefore, 1LINK's reported attempt still did not reach the Fintap VM from the configured peer address. A coordinated test must record the exact initiation timestamp and packet capture on both firewalls.

## Isolation from the 1LINK connection

The original connection remains defined as:

- Connection: `onebill`
- Fintap public endpoint: `178.238.236.126`
- 1LINK public peer: `103.248.140.4`
- Fintap protected IP: `172.31.254.10/32`
- 1LINK protected IPs: `10.95.8.92/32` and `10.95.8.94/32`

The control test used a separate connection:

- Connection: `laptop-test`
- CHILD SA: `laptop-test-https`
- Laptop observed public IP: `103.18.15.132`
- Laptop protected IP: `172.31.253.20/32`
- Fintap protected IP: `172.31.254.10/32`
- Authentication: a separate, randomly generated test-only PSK
- IKE proposal: `aes256-sha256-prfsha256-ecp256`
- ESP proposal: `aes256-sha256-ecp256`
- IKE lifetime/rekey: 28,800 seconds
- CHILD lifetime: 28,800 seconds
- CHILD rekey: 27,000 seconds
- MOBIKE: disabled
- NAT-T: enabled and used

The production 1LINK PSK was not reused or displayed. The test PSK is stored only in the two temporary StrongSwan configuration files listed below.

## Verified negotiation evidence

The laptop reported:

```text
selected proposal: IKE:AES_CBC_256/HMAC_SHA2_256_128/PRF_HMAC_SHA2_256/ECP_256
authentication of '178.238.236.126' with pre-shared key successful
IKE_SA laptop-test established
selected proposal: ESP:AES_CBC_256/HMAC_SHA2_256_128/NO_EXT_SEQ
CHILD_SA laptop-test-https established
TS 172.31.253.20/32 === 172.31.254.10/32
```

The VM independently reported:

```text
received packet: from 103.18.15.132 to 178.238.236.126 UDP/500
selected peer config 'laptop-test'
authentication of '103.18.15.132' with pre-shared key successful
IKE_SA laptop-test established
CHILD_SA laptop-test-https established
TS 172.31.254.10/32 === 172.31.253.20/32
```

## Protected-path tests

### Ping

```text
172.31.253.20 -> 172.31.254.10
3 packets transmitted, 3 received, 0% packet loss
```

### HTTPS health

The request was bound to the laptop protected IP and resolved `app.fintap.pk` directly to the Fintap protected IP:

```text
Source:      172.31.253.20
Destination: 172.31.254.10:443
SNI/Host:    app.fintap.pk
Result:      HTTP/1.1 200 OK
Service:     fintap-api
Environment: production
```

### Authenticated 1BILL inquiry

The production API credentials were transferred in memory for the test, used through the encrypted tunnel, and removed immediately from the laptop. They are not present in this document or the test directory.

```text
POST /api/1.0/Payments/BillInquiry
Encrypted source: 172.31.253.20
HTTP result: 200 OK
1BILL response_Code: 01
Meaning: the deliberately nonexistent test consumer was not found
```

An HTTP 200 plus `response_Code: "01"` is the expected protocol-level result for an authenticated inquiry containing a valid-format but nonexistent consumer number. This verifies the VPN path, TLS, Nginx routing, source-IP allowlist, credential authentication, controller, database query, and 1BILL response envelope.

## Packet evidence

Both sides captured:

- IKE_SA_INIT request and response on UDP 500
- IKE_AUTH request and response on UDP 4500
- UDP-encapsulated ESP in both directions
- Decrypted ICMP between `172.31.253.20` and `172.31.254.10`
- Decrypted TCP/443 between `172.31.253.20` and `172.31.254.10`
- Zero packet loss during the protected ping test

The laptop was behind NAT. StrongSwan detected this and successfully used NAT-T. This is why its WSL address appeared internally while the VM correctly observed the laptop's public address `103.18.15.132`.

## Non-fatal diagnostic messages

The laptop logged a failed optional XFRM-interface startup probe. The actual policy-based XFRM states and policies installed successfully, and encrypted traffic passed. The message did not affect the test.

The VM logged `unable to install source route for 172.31.254.10`. That address already exists locally on loopback, and the CHILD SA plus return traffic worked. The message did not prevent connectivity.

## State after the test

- The laptop closed when the short WSL session ended, so the test IKE SA was deleted cleanly. No laptop test SA is currently active.
- The VM retains the runtime `laptop-test` definition for a repeat test.
- The original `onebill` definition remains loaded.
- The original passive 1LINK monitor remains active and has not recorded an actual packet from `103.248.140.4` as of the final check.
- The production API is ready and all existing 1LINK allowlist entries remain present.
- `172.31.253.20` was temporarily added to the application allowlist alongside the two 1LINK protected IPs.

## Operational audit note

During the first attempt to load the isolated server test file, a malformed temporary loader path caused `swanctl --load-conns` to unload the runtime `onebill` definition. The source configuration at `/etc/swanctl/swanctl.conf` was never modified, the StrongSwan service was never restarted, and there was no active 1LINK SA to terminate. The original definition was immediately restored with `swanctl --load-all` and verified before testing continued. The final runtime contains both the unchanged `onebill` definition and the isolated `laptop-test` definition.

Adding the temporary application allowlist entry required one controlled PM2 reload of `Fintap-api-backend`. This did not restart StrongSwan or affect the IPsec control plane. The API passed its readiness check immediately after the reload.

## Temporary changes and artifacts

### Windows/laptop

- WSL distribution: `Ubuntu-24.04`
- Installed packages inside that distribution:
  - `strongswan-swanctl`
  - `charon-systemd`
  - `tcpdump`
  - StrongSwan dependencies
  - `curl` was upgraded in the new distribution
- `/root/fintap-laptop-ipsec-test/laptop-test.conf`
- `/root/fintap-laptop-ipsec-test/client-packets.log`
- `/root/fintap-laptop-ipsec-test/load-conns.out`
- `/root/fintap-laptop-ipsec-test/load-creds.out`
- Temporary protected address `172.31.253.20/32` on WSL loopback; it is not persistent

The temporary API credential file was securely removed immediately after the request.

### Production VM

- Runtime StrongSwan connection: `laptop-test`
- `/etc/swanctl/laptop-test.conf`
- `/etc/swanctl/laptop-load.conf`
- `/root/fintap-laptop-ipsec-test/laptop-test.conf`
- `/root/fintap-laptop-ipsec-test/load.conf`
- `/root/fintap-laptop-ipsec-test/server-packets.log`
- `/root/fintap-laptop-ipsec-test/server.env.before-laptop-allowlist`
- `/tmp/restore-onebill.out`
- Transient capture unit: `laptop-ipsec-monitor.service`, maximum runtime one hour
- Temporary application allowlist entry: `172.31.253.20`
- One controlled PM2 reload of `Fintap-api-backend`; the API passed readiness immediately afterward

Standard StrongSwan journal entries are part of normal system logging and should not be selectively erased.

## Repeat the control test

The test files contain a secret and require root access. Do not print either configuration file.

If StrongSwan on the VM has restarted, first load the original and test definitions together:

```bash
swanctl --load-conns --file /etc/swanctl/laptop-load.conf
swanctl --load-creds --file /etc/swanctl/laptop-load.conf
```

Run the laptop test in one WSL session so WSL does not shut down between setup and initiation:

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc '
  ip address replace 172.31.253.20/32 dev lo
  swanctl --load-conns --file /root/fintap-laptop-ipsec-test/laptop-test.conf
  swanctl --load-creds --file /root/fintap-laptop-ipsec-test/laptop-test.conf
  swanctl --initiate --child laptop-test-https
  ping -I 172.31.253.20 -c 3 172.31.254.10
  swanctl --list-sas
'
```

Do not use the production Bill Payment endpoint for a connectivity test. Bill Inquiry is read-only; Bill Payment can change financial records.

## Cleanup procedure

Perform cleanup after the evidence is no longer needed and when no repeat laptop test is running.

### 1. Clean the production VM

Run exactly:

```bash
set -Eeuo pipefail

systemctl stop laptop-ipsec-monitor.service 2>/dev/null || true
systemctl reset-failed laptop-ipsec-monitor.service 2>/dev/null || true

swanctl --terminate --ike laptop-test 2>/dev/null || true

python3 - <<'PY'
from pathlib import Path

path = Path('/var/www/billing-brilliance/server/.env')
lines = path.read_text().splitlines()
key = 'ONELINK_ALLOWED_IPS='
expected = 'ONELINK_ALLOWED_IPS=10.95.8.92,10.95.8.94'
output = []
found = False
for line in lines:
    if line.startswith(key):
        output.append(expected)
        found = True
    else:
        output.append(line)
if not found:
    output.append(expected)
path.write_text('\n'.join(output) + '\n')
PY

pm2 reload Fintap-api-backend --update-env

# Reload only the original production StrongSwan configuration. This removes
# the runtime laptop-test definition and retains onebill.
swanctl --load-all

rm -f -- /etc/swanctl/laptop-test.conf
rm -f -- /etc/swanctl/laptop-load.conf
rm -f -- /tmp/restore-onebill.out
rm -f -- /root/fintap-laptop-ipsec-test/laptop-test.conf
rm -f -- /root/fintap-laptop-ipsec-test/load.conf
rm -f -- /root/fintap-laptop-ipsec-test/server-packets.log
rm -f -- /root/fintap-laptop-ipsec-test/server.env.before-laptop-allowlist
rmdir --ignore-fail-on-non-empty /root/fintap-laptop-ipsec-test

grep '^ONELINK_ALLOWED_IPS=' /var/www/billing-brilliance/server/.env
swanctl --list-conns
curl -fsS -H 'X-Forwarded-Proto: https' http://127.0.0.1:3000/api/ready
```

Expected after cleanup:

- Allowlist is `10.95.8.92,10.95.8.94`
- `onebill` is listed
- `laptop-test` is not listed
- API readiness returns JSON with `"status":"ready"`

### 2. Remove the complete laptop lab

First copy any evidence you want to retain. The following command permanently deletes the named Ubuntu WSL distribution and everything stored inside it:

```powershell
wsl.exe --terminate Ubuntu-24.04
wsl.exe --unregister Ubuntu-24.04
```

Do not unregister `docker-desktop`.

If the Ubuntu lab should be kept for future diagnostics, do not unregister it. Remove only the test directory instead:

```powershell
wsl.exe -d Ubuntu-24.04 -u root -- bash -lc '
  systemctl stop laptop-ipsec-monitor.service 2>/dev/null || true
  ip address del 172.31.253.20/32 dev lo 2>/dev/null || true
  rm -f -- /root/fintap-laptop-ipsec-test/laptop-test.conf
  rm -f -- /root/fintap-laptop-ipsec-test/client-packets.log
  rm -f -- /root/fintap-laptop-ipsec-test/load-conns.out
  rm -f -- /root/fintap-laptop-ipsec-test/load-creds.out
  rmdir --ignore-fail-on-non-empty /root/fintap-laptop-ipsec-test
'
```

## Items that must not be removed during cleanup

- `/etc/swanctl/swanctl.conf`
- `onebill`, `onebill-92`, or `onebill-94`
- `/etc/systemd/system/onebill-vpn-ip.service`
- `172.31.254.10/32` on the VM loopback
- StrongSwan on the production VM
- Nginx configuration or certificates
- Production or sandbox PM2 services
- Production or sandbox databases
- The 1LINK protected allowlist entries `10.95.8.92` and `10.95.8.94`

## Accurate conclusion to share with 1LINK

The Fintap endpoint accepted a separate external IKEv2 initiator, negotiated the required AES-256/SHA-256/Group-19 proposals, authenticated by PSK, established a CHILD SA, exchanged encrypted traffic in both directions through NAT-T, reached `172.31.254.10:443`, and completed an authenticated 1BILL inquiry. If 1LINK's packets from `103.248.140.4` still do not appear in the VM capture, 1LINK should verify its actual egress/NAT IP, destination `178.238.236.126`, peer activation, routing, whitelisting, and upstream firewall path.
