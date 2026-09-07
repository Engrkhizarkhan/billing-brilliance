# 1BILL VPN Connectivity Status

**Organization:** Zynotch PVT Limited  
**Date:** 7 September 2026  
**Status:** Zynotch configured, awaiting response from 1LINK VPN peer

## Configured endpoints

| Item | Value |
|---|---|
| Zynotch public VPN endpoint | `178.238.236.126` |
| 1LINK public VPN peer | `103.248.140.4` |
| Zynotch dedicated protected IP | `172.29.250.10/32` |
| 1LINK protected host 1 | `10.95.8.92/32` |
| 1LINK protected host 2 | `10.95.8.94/32` |
| Application service | HTTPS on TCP `443` |

The existing Contabo private address `10.0.0.1/22` remains unchanged and is not used as the 1LINK protected selector.

## VPN configuration

| Parameter | Configured value |
|---|---|
| Implementation | StrongSwan 5.9.13 with `swanctl` and `charon-systemd` |
| IKE version | IKEv2 |
| Authentication | Pre-shared key received from 1LINK and stored securely |
| IKE proposal | `aes256-sha256-prfsha256-ecp256` |
| ESP proposal | `aes256-sha256-ecp256` |
| IKE lifetime | 28,800 seconds |
| CHILD rekey interval | 27,000 seconds |
| Connection name | `onebill` |
| CHILD 1 | `onebill-92`: `172.29.250.10/32` to `10.95.8.92/32` |
| CHILD 2 | `onebill-94`: `172.29.250.10/32` to `10.95.8.94/32` |

## Verification completed by Zynotch

- StrongSwan is active and running.
- Both CHILD configurations are loaded.
- `172.29.250.10/32` is active on loopback and persists through `onebill-vpn-ip.service`.
- Nginx listens on port `443`, and HTTPS responds through `172.29.250.10` when resolved as `app.fintap.pk`.
- UDP ports `500` and `4500` are listening under `charon-systemd`.
- The route to `103.248.140.4` uses `eth0` with source `178.238.236.126`.
- StrongSwan sends 272-byte IKEv2 `IKE_SA_INIT` packets to `103.248.140.4:500`.
- Five retransmissions occur, followed by `peer not responding`.
- No inbound UDP `500`, UDP `4500`, or ESP packets are observed from `103.248.140.4`.
- No IKE SA, CHILD SA, or IPsec XFRM state is installed.

Because the peer does not answer the first `IKE_SA_INIT`, authentication and CHILD negotiation have not started. PSK validation, protected-selector negotiation, and HTTPS API testing through the tunnel cannot occur until an inbound response is received.

## Action requested from 1LINK

Please:

1. verify that the VPN configuration for Zynotch is active on `103.248.140.4`;
2. whitelist Zynotch public IP `178.238.236.126` for IKEv2;
3. verify inbound and outbound UDP `500` and UDP `4500` handling;
4. confirm the mirrored protected selectors:
   - Zynotch: `172.29.250.10/32`
   - 1LINK: `10.95.8.92/32` and `10.95.8.94/32`;
5. confirm whether 1LINK expects to initiate the tunnel or accept Zynotch initiation; and
6. provide a coordinated test time so both teams can monitor packet captures and IKE logs.

## Retest procedure after 1LINK confirmation

Zynotch will initiate:

```bash
swanctl --initiate --child onebill-92
```

During the test, Zynotch will monitor:

```bash
journalctl -u strongswan -f
tcpdump -ni eth0 'host 103.248.140.4 and (udp port 500 or udp port 4500 or ip proto 50)'
swanctl --list-sas
```

Expected next milestone: receipt of an `IKE_SA_INIT` response from `103.248.140.4`, followed by IKE authentication and CHILD SA negotiation.
