# 1LINK / 1BILL VPN Debug Call Runbook

Prepared for the joint debugging call scheduled for September 14, 2026.

This document contains the verified Fintap VPN settings, safe screen-sharing commands, packet monitoring steps, ping tests, configuration-change procedures, and the evidence 1LINK should provide. It intentionally does not contain the PSK secret or API password.

## 1. Verified connection details

| Item | Fintap side | 1LINK side |
|---|---|---|
| Public VPN endpoint | `178.238.236.126` | `103.248.140.4` |
| Protected/private IP | `172.31.254.10/32` | `10.95.8.92/32`, `10.95.8.94/32` |
| IKE version | IKEv2 | Must match |
| Authentication | Pre-shared key | Must use the identical PSK |
| Local/remote IKE ID | `178.238.236.126` | `103.248.140.4` |
| Phase 1 | `AES-256 / SHA-256 / PRF-SHA-256 / DH Group 19` | Must match exactly |
| Phase 2 | `AES-256 / SHA-256 / PFS Group 19` | Must match exactly |
| IKE lifetime | `28800` seconds | Must match |
| CHILD lifetime | `28800` seconds | Must match |
| CHILD rekey | `27000` seconds | Local safety margin |
| NAT-T | UDP 4500 supported | Must allow UDP 4500 |
| Initial IKE | UDP 500 | Must allow UDP 500 |
| Application service | HTTPS TCP 443 | Calls must target this service |
| Fintap hostname | `app.fintap.pk` | Use as HTTPS hostname/SNI |

Quick parameter message for the call:

```text
Fintap public endpoint: 178.238.236.126
Fintap protected/private IP: 172.31.254.10/32
Fintap IKE/PSK ID: 178.238.236.126
1LINK public peer: 103.248.140.4
1LINK protected IPs: 10.95.8.92/32 and 10.95.8.94/32
IKEv2; Phase 1 AES256/SHA256/PRF-SHA256/DH19;
Phase 2 AES256/SHA256/PFS19; lifetime 28800 seconds.
```

Important distinctions:

- `172.31.254.10/32` is the dedicated Fintap IP protected by IPsec.
- `10.0.0.1/22` is the hosting provider's separate private interface and is **not** part of the 1LINK tunnel.
- `/32` means exactly one IPv4 host address.
- The PSK ID is currently the public IP `178.238.236.126`. It is not the PSK password.

## 2. Live state verified before the call

Verified on the production Fintap VM on September 13, 2026:

- StrongSwan service: active and enabled at boot.
- Dedicated protected IP service: active and enabled at boot.
- `172.31.254.10/32` is present on loopback.
- UDP 500 and UDP 4500 are listening through `charon-systemd`.
- The official `onebill` IKEv2 connection and both CHILD definitions are loaded.
- Nginx listens on TCP 443 on all IPv4 interfaces.
- `https://app.fintap.pk/api/health` returns HTTP 200.
- HTTPS through `172.31.254.10` returns HTTP 200 when the correct hostname/SNI is used.
- The wildcard certificate covers `app.fintap.pk` and is valid until December 9, 2026.
- Host UFW is inactive and the iptables INPUT policy is ACCEPT.
- ICMP echo replies are enabled.
- The application allowlist includes `10.95.8.92` and `10.95.8.94`.
- The route to `103.248.140.4` leaves through `eth0` with source `178.238.236.126`.
- The official `onebill` tunnel is not currently established; no official IKE or CHILD SA is installed.
- No 1LINK traffic from `103.248.140.4` was recorded in the preceding 24-hour StrongSwan log query.

An independent Azure Ubuntu VM successfully established the same class of IKEv2/PSK tunnel to Fintap. Protected ping, bidirectional encrypted UDP 4500 traffic, TLS, Nginx, and the Fintap health API all worked. This validates the Fintap VPN endpoint, but the actual 1LINK tunnel still requires the exact 1LINK configuration and peer traffic to match.

## 3. Safety rules during screen sharing

Safe to show:

- `ip address`, `ip route`, service status, listening ports.
- Sanitized StrongSwan configuration.
- `swanctl --list-conns` and `swanctl --list-sas`.
- StrongSwan logs and packet captures filtered to the 1LINK peer.

Do not show:

- The unredacted `/etc/swanctl/swanctl.conf` because it contains the PSK.
- `/var/www/billing-brilliance/server/.env` because it contains application secrets.
- `ip xfrm state` because it can print active IPsec encryption/authentication key material.
- API passwords, encryption keys, database credentials, or private certificate keys.

The current PSK has previously been exposed and is weak. Replace it with a strong PSK supplied through an approved secure channel before production traffic.

## 4. Safe opening checks for the call

SSH to the Fintap VM:

```bash
ssh root@178.238.236.126
```

Show the date, addresses and route to 1LINK:

```bash
date --iso-8601=seconds
hostname
ip -4 -br address show
ip route get 103.248.140.4
```

Expected important lines:

```text
lo    172.31.254.10/32
eth0  178.238.236.126/24
103.248.140.4 via 178.238.236.1 dev eth0 src 178.238.236.126
```

Show services and listeners:

```bash
systemctl is-active strongswan onebill-vpn-ip.service nginx
systemctl is-enabled strongswan onebill-vpn-ip.service
ss -lunp | grep -E ':(500|4500)[[:space:]]'
ss -lntp | grep ':443'
```

Expected: all services are active, UDP 500/4500 belong to `charon-systemd`, and TCP 443 belongs to Nginx.

Show only the official connection, without plugin-warning noise or test connections:

```bash
swanctl --list-conns 2>/dev/null | awk '
  /^onebill:/ { show=1 }
  show && /^[^ ]/ && $0 !~ /^onebill:/ { exit }
  show { print }
'
```

Show the current tunnel state:

```bash
if swanctl --list-sas 2>/dev/null | grep -q '^onebill:'; then
  swanctl --list-sas 2>/dev/null | grep -A20 '^onebill:'
else
  echo 'No active onebill SA'
fi
```

Expected before establishment: no `onebill` SA. Expected after success:

```text
onebill: ... ESTABLISHED ...
onebill-92 or onebill-94: ... INSTALLED ...
```

Show the configuration with the secret automatically redacted:

```bash
sed -E 's/^([[:space:]]*secret[[:space:]]*=).*/\1 "[REDACTED]"/' \
  /etc/swanctl/swanctl.conf
```

Show local application health:

```bash
curl --fail --silent --show-error \
  --resolve app.fintap.pk:443:172.31.254.10 \
  https://app.fintap.pk/api/health
```

Expected: JSON containing `"status":"ok"` and `"environment":"production"`.

## 5. Live monitoring during 1LINK's test

Use three SSH terminals. Start monitoring **before** 1LINK initiates and agree on an exact timestamp and timezone.

### Terminal 1: encrypted/public traffic

```bash
timeout 600 tcpdump -ni eth0 -nn -tttt -vv \
  'host 103.248.140.4 and (icmp or udp port 500 or udp port 4500 or ip proto 50)'
```

This is the decisive test of whether packets from the configured 1LINK public peer reach Fintap.

### Terminal 2: StrongSwan negotiation logs

```bash
journalctl -u strongswan -f -o short-iso | \
  grep --line-buffered -Ei \
  '103[.]248[.]140[.]4|onebill|IKE_SA|CHILD_SA|proposal|auth|traffic selector|packet'
```

### Terminal 3: connection status

```bash
watch -n 2 "swanctl --list-sas 2>/dev/null | grep -A20 '^onebill:' || echo 'No active onebill SA'"
```

Press `Ctrl+C` to stop `watch` or a live capture.

## 6. Who should initiate

The current Fintap CHILD configurations use `start_action = none`, so Fintap does not continuously initiate on startup. This is appropriate if 1LINK is the designated initiator.

Ask 1LINK to initiate from exactly:

```text
103.248.140.4 -> 178.238.236.126, UDP 500/4500
```

If both teams agree that Fintap should initiate for diagnosis, run one child at a time:

```bash
swanctl --initiate --child onebill-92
swanctl --list-sas 2>/dev/null
```

Then, if needed:

```bash
swanctl --initiate --child onebill-94
swanctl --list-sas 2>/dev/null
```

Do not repeatedly initiate while 1LINK is simultaneously changing its configuration. Perform one controlled attempt and correlate logs by timestamp.

## 7. Ping tests and what they prove

### Ping the 1LINK public peer from Fintap

```bash
ping -I 178.238.236.126 -c 10 -W 2 103.248.140.4
```

A failed public ping is not proof that IPsec is broken. Enterprise firewalls commonly block ICMP while permitting UDP 500/4500.

### Ask 1LINK to ping Fintap's public IP

First run this on Fintap:

```bash
timeout 120 tcpdump -ni eth0 -nn -tttt -vv \
  'icmp and host 103.248.140.4'
```

Then ask 1LINK to ping `178.238.236.126` from the firewall whose public/translated source is `103.248.140.4`.

Interpretation:

- Echo request and echo reply visible: public ICMP works in both directions.
- Echo request visible but no reply: investigate Fintap/provider response handling.
- Nothing visible: their packet did not reach the Fintap NIC, or it left using a different NAT/egress IP.

Fintap is configured to respond to ICMP (`net.ipv4.icmp_echo_ignore_all = 0`) and the host INPUT policy is accepting.

### Protected/private ping after the tunnel is installed

From Fintap:

```bash
ping -I 172.31.254.10 -c 10 -W 2 10.95.8.92
ping -I 172.31.254.10 -c 10 -W 2 10.95.8.94
```

From 1LINK, the equivalent protected test should use one of their agreed protected sources toward:

```text
10.95.8.92 or 10.95.8.94 -> 172.31.254.10
```

Protected ping is meaningful only after the IKE SA and matching CHILD SA are established. Their protected hosts may also intentionally block ICMP.

Monitor protected traffic on Fintap with:

```bash
timeout 180 tcpdump -ni any -nn -tttt -vv \
  'host 172.31.254.10 and (host 10.95.8.92 or host 10.95.8.94)'
```

## 8. HTTPS/API connectivity test through the tunnel

The certificate is issued for `*.fintap.pk`, not for the private IP itself. 1LINK should connect to `172.31.254.10` while sending `app.fintap.pk` as the TLS hostname/SNI.

Example from the 1LINK protected server using `10.95.8.92`:

```bash
curl -v \
  --interface 10.95.8.92 \
  --resolve app.fintap.pk:443:172.31.254.10 \
  https://app.fintap.pk/api/health
```

Expected: a valid TLS handshake and HTTP 200 health response. If 1LINK uses `10.95.8.94`, replace the `--interface` value accordingly.

The actual 1BILL routes are:

```text
POST /api/1.0/Payments/BillInquiry
POST /api/1.0/Payments/BillPayment
```

The API username/password and agreed test body should be exchanged separately. Do not display credentials during screen sharing.

## 9. Reading common failure results

| Observation | Meaning / next owner |
|---|---|
| Fintap sends IKE_SA_INIT but receives nothing | 1LINK peer, its upstream firewall/NAT, routing, or an intermediate path is not returning traffic |
| No inbound packet from `103.248.140.4` during their claimed test | Ask for their actual egress/NAT IP, outbound capture and exact timestamp |
| Inbound traffic comes from a different public IP | Fintap `remote_addrs`/remote ID must be agreed and changed, or 1LINK must correct NAT |
| `AUTHENTICATION_FAILED` | PSK mismatch, ID mismatch, whitespace/encoding error, or wrong PSK selected on one side |
| `NO_PROPOSAL_CHOSEN` | Phase 1 or Phase 2 algorithms do not match exactly |
| `TS_UNACCEPTABLE` | Protected IPs/traffic selectors or direction do not match |
| IKE established but no CHILD installed | Phase 2 proposal, PFS, lifetime, or selector mismatch |
| CHILD installed but HTTPS fails | Check protected packet capture, source IP, application allowlist, TLS hostname/SNI and TCP 443 |
| Public ping fails but IKE packets exchange | Ignore ping result; ICMP is being filtered but VPN transport is available |
| Optional plugin warnings from `swanctl` | Usually harmless package/plugin discovery noise, not evidence that the tunnel failed |

## 10. Safely changing the PSK or IKE IDs

Only change these values after both teams confirm the exact replacement. Stop screen sharing while entering a PSK.

Create a protected backup:

```bash
install -m 600 /etc/swanctl/swanctl.conf \
  "/root/swanctl.conf.before-1link-change-$(date +%Y%m%d-%H%M%S)"
```

Edit the file privately:

```bash
nano /etc/swanctl/swanctl.conf
```

The related fields are:

```text
connections.onebill.local.id       = Fintap IKE/PSK ID
connections.onebill.remote.id      = 1LINK IKE/PSK ID
secrets.ike-onebill.id-local       = same Fintap ID
secrets.ike-onebill.id-remote      = same 1LINK ID
secrets.ike-onebill.secret         = actual PSK password
```

Rules:

- If the Fintap PSK ID changes, update both `local.id` and `id-local` identically.
- If the 1LINK peer ID changes, update both `remote.id` and `id-remote` identically.
- Changing the displayed section label `ike-onebill` is unnecessary; it is a local label and is not the transmitted PSK ID.
- Do not confuse the PSK ID with the PSK password.

Restore secure permissions and load the configuration:

```bash
chmod 600 /etc/swanctl/swanctl.conf
swanctl --load-all
swanctl --list-conns 2>/dev/null
```

If an existing official SA must use the new credential immediately, terminating it is disruptive. Do this only during the agreed maintenance/test window:

```bash
swanctl --terminate --ike onebill
```

Then let the designated side initiate again. If Fintap is temporarily designated to initiate:

```bash
swanctl --initiate --child onebill-92
```

## 11. Questions 1LINK must answer on the call

1. Is `103.248.140.4` the actual outbound/NAT source IP visible on the Internet?
2. Which side is the designated IKE initiator?
3. What exact local and remote IKE IDs are configured on their firewall?
4. Do they have Fintap public IP `178.238.236.126` whitelisted for UDP 500 and UDP 4500 in both directions?
5. Are their traffic selectors exactly `10.95.8.92/32, 10.95.8.94/32 <-> 172.31.254.10/32`?
6. Are both phases configured for AES-256, SHA-256 and DH/PFS Group 19?
7. Is the lifetime `28800` seconds on both phases?
8. Is NAT-T enabled or permitted?
9. Which protected host will originate the first HTTPS request: `.92` or `.94`?
10. Can they provide a packet capture proving an outbound UDP 500 packet toward `178.238.236.126`?
11. Can they provide the exact test timestamp with timezone and their IKE negotiation log?

## 12. Evidence to save after the call

Save a filtered packet capture if needed:

```bash
tcpdump -ni eth0 -nn -s0 -w /root/onebill-debug-call.pcap \
  'host 103.248.140.4 and (udp port 500 or udp port 4500 or ip proto 50)'
```

Stop it with `Ctrl+C`, then save logs:

```bash
journalctl -u strongswan --since '2026-09-14 00:00:00' --no-pager \
  > /root/onebill-debug-call-strongswan.log
```

Before sending files outside Zynotch, review them for IPsec metadata and obtain approval. Do not send configuration files, `.env` files, PSKs, API passwords, private keys, or raw `ip xfrm state` output.

## 13. Current conclusion

The Fintap host is ready to receive IKEv2 traffic at `178.238.236.126` on UDP 500/4500 and serve the application at protected IP `172.31.254.10` on HTTPS 443. Independent VPN testing has proven bidirectional encrypted transport and application access.

The official 1LINK tunnel will only be considered operational when:

1. Packets from the agreed peer reach Fintap.
2. The `onebill` IKE SA shows `ESTABLISHED`.
3. At least one `onebill-92`/`onebill-94` CHILD SA shows `INSTALLED`.
4. Packet counters increase in both directions.
5. A protected HTTPS/API request succeeds using the agreed 1LINK source IP.

Temporary `laptop-test` and `azure-test` validation connections may appear in an unfiltered `swanctl --list-conns` output. They are independent controls and are not part of the 1LINK configuration. Use the official-only display command in Section 4 during the call.
