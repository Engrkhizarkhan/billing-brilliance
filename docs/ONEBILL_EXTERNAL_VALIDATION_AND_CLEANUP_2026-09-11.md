# 1BILL External Validation, Passive Monitoring, and Cleanup

Date: 2026-09-11

## Purpose

This record documents the safe external tests performed against the production Fintap VM, the temporary passive monitor left running for a later 1LINK test, the limitations of the simulation, and the exact cleanup steps.

The work was deliberately non-invasive. No StrongSwan connection, PSK, traffic selector, route, firewall rule, Nginx configuration, PM2 process, database, or application setting was changed or restarted.

## Why this computer cannot literally become the 1LINK peer

The actual tunnel is identified by addresses controlled by 1LINK:

- Public IKE peer: `103.248.140.4`
- Protected sources: `10.95.8.92/32` and `10.95.8.94/32`

This test computer does not own those addresses and cannot legitimately originate Internet packets from `103.248.140.4`. Its observed public egress address during the test was `103.18.15.132`. An arbitrary UDP packet reaching port 500 or 4500 proves Internet delivery to those ports, but it is not a valid IKEv2 exchange and does not prove PSK, proposal, or CHILD-SA negotiation.

Creating a second VPN peer or relaxing the production peer from `103.248.140.4` to a wildcard would change the live security boundary and could conflict with 1LINK's testing. That was intentionally not done.

## Tools used

No new package was installed on either machine. Existing tools were sufficient:

- Windows `ping`, PowerShell UDP sockets, and `curl`
- Existing SSH access to the VM
- Existing `tcpdump`, StrongSwan, Nginx, Node.js, and PM2 on the VM

## Production endpoints under test

- Fintap public IP: `178.238.236.126`
- Fintap protected IP: `172.31.254.10/32`
- HTTPS hostname: `app.fintap.pk`
- IKE ports: UDP 500 and UDP 4500
- 1BILL inquiry path: `/api/1.0/Payments/BillInquiry`

## Test results

| Layer | Test | Result | What it proves |
| --- | --- | --- | --- |
| Internet/ICMP | External computer pinged `178.238.236.126` | 3 sent, 3 replies, 0% loss | The VM public address is reachable and replies to ICMP from this external source. |
| IKE transport | External UDP probes sent to 500 and 4500 | Both packets captured on VM `eth0`; 0 kernel drops | UDP 500/4500 traffic from this source reaches the VM. It does not prove a valid IKE exchange. |
| TLS/Nginx | Direct-origin request with SNI `app.fintap.pk` | HTTP 200 from Nginx and `/api/health` | The certificate/SNI, Nginx route, and production application health endpoint work at the origin. |
| Public 1BILL route | Inquiry with intentionally invalid test credentials | HTTP 401 with 1BILL `response_Code: "04"` envelope | The public HTTPS route reaches the 1BILL authentication middleware and rejects unauthorized clients correctly. |
| Authorized read-only contract | Local server request using configured credentials and simulated allowed source `10.95.8.92` | HTTP 200 with `response_Code: "01"` for a deliberately nonexistent consumer | Authentication, source allowlist, controller, database query, and response formatting work. No bill or payment was created or changed. |
| Runtime | PM2 status checked after tests | Production API, production worker, sandbox API, and sandbox worker all online | The checks did not interrupt application services. |

### Captured transport evidence

The VM observed:

```text
103.18.15.132 > 178.238.236.126: ICMP echo request
178.238.236.126 > 103.18.15.132: ICMP echo reply
103.18.15.132:<ephemeral> > 178.238.236.126:500 UDP
103.18.15.132:<ephemeral> > 178.238.236.126:4500 UDP
6 packets captured
6 packets received by filter
0 packets dropped by kernel
```

`tcpdump` labels arbitrary UDP/4500 payloads as UDP-encapsulated ESP based on the port. The probe was not real ESP and must not be presented as a successfully negotiated tunnel.

## Current conclusion

The tested Fintap-side public ingress and application layers are working. The exact 1LINK IKEv2 tunnel is **not** proven by this external simulation because only 1LINK can originate from its configured public peer and complete authentication.

If 1LINK attempts the tunnel and no packet from `103.248.140.4` appears in the passive log, the attempt did not reach this VM. Investigation should then focus on 1LINK's configured destination, egress/NAT address, upstream firewall, whitelisting, or transit path. If packets do arrive, StrongSwan logs will identify the next negotiation stage and any proposal, identity, PSK, or traffic-selector mismatch.

## Temporary passive monitor

A header-only monitor was started as a transient systemd unit:

- Unit: `onebill-passive-monitor.service`
- Log: `/root/onebill-diagnostics/peer-monitor-20260911.log`
- Automatic maximum runtime: 6 hours
- Started at server time: 2026-09-11 15:20:26 CEST
- Scheduled automatic stop: 2026-09-11 21:20:26 CEST
- Packet payloads are not captured
- StrongSwan is not restarted or reconfigured

It watches only:

- IKE/ESP/ICMP involving `103.248.140.4`
- HTTPS involving protected sources `10.95.8.92` or `10.95.8.94`

Inspect it without changing anything:

```bash
systemctl --no-pager --full status onebill-passive-monitor.service
tail -n 200 /root/onebill-diagnostics/peer-monitor-20260911.log
journalctl -u strongswan --since "2026-09-11 15:20:00" --no-pager
swanctl --list-sas
```

## How to interpret a later 1LINK test

1. No line containing `103.248.140.4`: no packet from the configured 1LINK public peer reached the VM during the captured period.
2. Inbound UDP/500 appears: IKE negotiation reached the VM; inspect the StrongSwan journal for proposal and identity handling.
3. UDP/4500 or ESP appears: negotiation advanced to NAT traversal or encrypted traffic.
4. `swanctl --list-sas` shows an established IKE SA and CHILD SA: the tunnel is up.
5. Traffic involving `10.95.8.92` or `10.95.8.94` and TCP/443 appears: decrypted protected-side application traffic reached Fintap.

## Cleanup after the coordinated test

The monitor stops automatically after six hours. To stop it earlier and remove only the diagnostic artifact, run:

```bash
systemctl stop onebill-passive-monitor.service 2>/dev/null || true
systemctl reset-failed onebill-passive-monitor.service 2>/dev/null || true
rm -f -- /root/onebill-diagnostics/peer-monitor-20260911.log
rmdir --ignore-fail-on-non-empty /root/onebill-diagnostics
```

These commands target only the transient monitor and its named log. Do **not** delete or alter any of the following during cleanup:

- `/etc/swanctl/swanctl.conf`
- `/etc/systemd/system/onebill-vpn-ip.service`
- `172.31.254.10/32` on loopback
- StrongSwan packages or service
- Nginx configuration or certificates
- Fintap PM2 processes
- Production or sandbox databases

## Security note

The PSK has previously appeared in chat and terminal output. It should be treated as exposed and replaced with a strong random PSK through a coordinated change with 1LINK before production go-live. The value is intentionally not included in this record.

