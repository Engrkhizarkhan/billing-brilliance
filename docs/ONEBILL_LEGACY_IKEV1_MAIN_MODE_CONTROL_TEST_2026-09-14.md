# 1BILL Legacy IKEv1 Main Mode Control Test

**Organization:** Zynotch PVT Limited  
**Test date:** September 14, 2026  
**Result:** Successful  
**Purpose:** Test the legacy interpretation of the March 16, 2018 1LINK Data Network Guidelines and Standards without altering the official 1LINK production connection.

## Executive conclusion

Fintap successfully established a complete legacy IKEv1 Main Mode and IPsec tunnel with an independent Azure Ubuntu server acting as a controlled 1LINK mirror.

The test completed:

- IKEv1 Main Mode negotiation.
- AES-256-CBC encryption.
- SHA-256 integrity and PRF.
- ECP/DH Group 19 key exchange.
- Pre-shared-key authentication.
- NAT traversal over UDP 4500.
- ESP with AES-256-CBC, SHA-256 and Group-19 PFS.
- Exact protected selectors `10.95.8.92/32 <-> 172.31.254.10/32`.
- Bidirectional protected ping with zero packet loss.
- HTTPS/TLS to `app.fintap.pk` through the tunnel with HTTP 200.

This proves that the Fintap endpoint can support both tested interpretations:

1. The August 15, 2025 Internet-specific IKEv2-only template.
2. The March 16, 2018 general document's IKEv1 Main Mode wording.

This test cannot establish which version is currently configured on 1LINK's Palo Alto firewall. 1LINK must provide that configuration evidence.

## Interpretation of the legacy document

The March 16, 2018 document requires:

```text
IPsec encryption: AES-256
Hashing: SHA2 or SHA-256
IKE Phase 1: Main Mode
```

Main Mode is an IKEv1 exchange mode. The legacy document does not state a DH group, PFS group, Phase 1 lifetime or Phase 2 lifetime. For a controlled comparison, this test retained Group 19, PFS Group 19 and 28,800-second lifetimes from the later 2025 template. The principal changed variable was therefore IKEv2 versus IKEv1 Main Mode.

## Test topology

```text
Independent Azure legacy mirror
Public transport: 20.187.97.214
Simulated IKE ID: 103.248.140.4
Protected source: 10.95.8.92/32
            |
            | IKEv1 Main Mode on UDP 500
            | NAT-T and encrypted traffic on UDP 4500
            v
Fintap production endpoint
Public transport: 178.238.236.126
IKE ID: 178.238.236.126
Protected service: 172.31.254.10/32
HTTPS hostname: app.fintap.pk
```

The Azure server did not originate from 1LINK's public address. Its actual public transport address was `20.187.97.214`; only the IKE identity and protected source selector were mirrored. Only 1LINK can prove traffic from the real peer `103.248.140.4`.

## Negotiated parameters

| Layer | Negotiated value |
|---|---|
| IKE version | IKEv1 |
| IKE exchange mode | Main Mode / Identity Protection |
| Authentication | Separate test-only PSK |
| Initiator IKE identity | `103.248.140.4` |
| Responder IKE identity | `178.238.236.126` |
| IKE encryption | AES-256-CBC |
| IKE integrity | HMAC-SHA-256-128 |
| PRF | PRF-HMAC-SHA-256 |
| Diffie-Hellman group | Group 19 / ECP-256 |
| IKE lifetime | 28,800 seconds |
| Phase 2 exchange | IKEv1 Quick Mode |
| ESP mode | Tunnel |
| ESP encryption | AES-256-CBC |
| ESP integrity | HMAC-SHA-256-128 |
| PFS | Group 19 / ECP-256 |
| CHILD lifetime | 28,800 seconds |
| CHILD rekey | 27,000 seconds |
| Encapsulation | NAT-T / tunnel in UDP |
| Traffic selectors | `10.95.8.92/32 <-> 172.31.254.10/32` |

## Negotiation evidence

The controlled initiation occurred at approximately:

```text
2026-09-14 23:49:03 Asia/Karachi
2026-09-14 20:49:03 Fintap server time
```

The initiator explicitly recorded:

```text
initiating Main Mode IKE_SA onebill-legacy-test
selected proposal IKE:AES_CBC_256/HMAC_SHA2_256_128/PRF_HMAC_SHA2_256/ECP_256
IKE_SA onebill-legacy-test established
selected proposal ESP:AES_CBC_256/HMAC_SHA2_256_128/ECP_256
CHILD_SA onebill-legacy-92 established
TS 10.95.8.92/32 === 172.31.254.10/32
```

Fintap independently recorded the matching IKEv1 SA and CHILD SA with the reverse selector direction.

## Protected path results

### Azure legacy mirror to Fintap

```text
Source: 10.95.8.92
Destination: 172.31.254.10
3 packets transmitted
3 packets received
0 percent packet loss
```

### Fintap to Azure legacy mirror

```text
Source: 172.31.254.10
Destination: 10.95.8.92
3 packets transmitted
3 packets received
0 percent packet loss
```

### HTTPS health through the legacy tunnel

```text
Source: 10.95.8.92
Destination: 172.31.254.10:443
TLS hostname and SNI: app.fintap.pk
Result: HTTP 200
Service: fintap-api
Environment: production
```

No payment API was called and no financial record was created, changed or deleted.

## Decision resulting from both control tests

| Question | Evidence-based answer |
|---|---|
| Can Fintap establish the 2025 IKEv2 profile? | Yes |
| Can Fintap establish the 2018 IKEv1 Main Mode interpretation? | Yes |
| Can Fintap authenticate the simulated `103.248.140.4` identity? | Yes, in both versions |
| Can the exact `.92` selector install and pass traffic? | Yes, in both versions |
| Is the Fintap application reachable through IPsec? | Yes, in both versions |
| Do these tests prove the actual 1LINK Palo Alto configuration? | No |
| Should production be changed to IKEv1 now? | No, not without written 1LINK confirmation |

The current production connection should remain IKEv2-only because the August 15, 2025 Internet-specific template is newer and more specific than the 2018 general document. A production change to IKEv1 would be justified only if 1LINK confirms that its active gateway is actually configured for IKEv1 Main Mode.

If 1LINK is configured for IKEv1-only while Fintap sends IKEv2, a version mismatch can prevent establishment. This is therefore a plausible explanation for the current failure, but it is not proven. The decisive evidence is the Version field on their active Palo Alto IKE Gateway and their `ikemgr.log` during a timestamped attempt.

## Required evidence from 1LINK

1LINK should provide or show:

1. Active Palo Alto IKE Gateway name and enabled state.
2. Committed Version value: `IKEv1 only`, `IKEv2 only` or `IKEv2 preferred`.
3. If IKEv1 is selected, Exchange Mode must be `main`.
4. Local interface and actual public/NAT source address.
5. Peer address `178.238.236.126`.
6. Local and peer IKE identification values.
7. Passive Mode setting and designated initiator.
8. IKE and IPsec crypto profiles.
9. Proxy IDs for `.92`, `.94` and `172.31.254.10/32`.
10. UDP 500/4500 packet capture and `ikemgr.log` for the same timestamp.

If no packet from `103.248.140.4` reaches Fintap during that attempt, changing cryptographic parameters on Fintap cannot solve the problem; 1LINK must first correct its gateway activation, destination, routing, NAT or firewall policy.

## Evidence retained

Raw evidence is retained root-only on both servers. It does not include the test PSK.

### Azure

```text
/root/onebill-legacy-test/azure-legacy.pcap
/root/onebill-legacy-test/strongswan.log
/root/onebill-legacy-test/final-state.txt
```

```text
9ad5142672fef1980a5ffa8ccc4c96e633a5becbe5f83479749fb3c1b35ba0dd  azure-legacy.pcap
de2ff06061e5db978738c470b260eee364431dba7b0f64da2510f3a0d836b47c  strongswan.log
8338e816de2b4086b240e20c7c5baf18ea8578a0137ca07df168e0e23f911b75  final-state.txt
```

### Fintap

```text
/root/onebill-legacy-test/fintap-legacy.pcap
/root/onebill-legacy-test/strongswan.log
/root/onebill-legacy-test/final-state.txt
```

```text
650d4e5bf0b3c4d4de878ee28571f936dcef611ee2818e27500ef335f3977eb9  fintap-legacy.pcap
0a310e301ce4ed1281b332d7383d81d5de1195fa54f51fb793b3ccfc89588010  strongswan.log
15b90064aa9a637b24839476a844290cba3d1a5830e5dc79c4ff1db089243924  final-state.txt
```

Review and approve raw packet captures before sharing them outside Zynotch.

## Cleanup and final state

- The legacy IKEv1 IKE and CHILD SAs were terminated.
- The temporary `10.95.8.92/32` address was removed from Azure.
- The temporary legacy configuration and include files were deleted.
- The test-only PSK was deleted from both servers.
- Fintap's official `onebill`, `laptop-test` and `azure-test` definitions were restored.
- Azure's original `azure-test` definition was restored.
- The official `onebill` file and PSK were not modified.
- The original Azure IKEv2 control SA remained established.
- Fintap returned HTTP 200 after cleanup.

The retained packet captures, StrongSwan logs and final-state records are recoverable. The deleted test PSK and temporary legacy configurations are intentionally not recoverable.
