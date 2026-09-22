# 1BILL Exact Selector Independent VPN Validation

**Organization:** Zynotch PVT Limited  
**Test date:** September 14, 2026  
**Result:** Successful  
**Purpose:** Independently validate the complete Fintap IKEv2, IPsec and protected HTTPS path using the exact protected source selector assigned to 1LINK.

## Executive conclusion

Fintap successfully established a complete IKEv2 and IPsec tunnel with an independent Azure Ubuntu server acting as a controlled 1LINK mirror. The mirror authenticated using the simulated IKE identity `103.248.140.4` and negotiated the exact protected selector pair:

```text
10.95.8.92/32 <-> 172.31.254.10/32
```

The test passed IKE Phase 1, PSK authentication, CHILD-SA establishment, NAT traversal, Group-19 CHILD rekey, bidirectional protected ping and HTTPS/TLS access to the production Fintap health endpoint. This validates the Fintap endpoint and its exact `.92` protected path independently of 1LINK's Palo Alto firewall.

The test does not assert that the Azure server owns 1LINK's public address. The actual Azure transport address was `20.187.97.214`; only the IKE identity and protected source selector were deliberately mirrored. Only 1LINK can prove transmission from its real public peer `103.248.140.4`.

## Test topology

```text
Independent Azure mirror
Public transport: 20.187.97.214
Simulated IKE ID: 103.248.140.4
Protected source: 10.95.8.92/32
            |
            | IKEv2 UDP 500 and NAT-T UDP 4500
            | AES-256-CBC / SHA-256 / PRF-SHA-256 / DH19
            v
Fintap production endpoint
Public transport: 178.238.236.126
IKE ID: 178.238.236.126
Protected service: 172.31.254.10/32
HTTPS hostname: app.fintap.pk
```

## Negotiated parameters

| Layer | Negotiated value |
|---|---|
| IKE version | IKEv2 |
| Authentication | Separate test-only pre-shared key |
| Initiator IKE identity | `103.248.140.4` |
| Responder IKE identity | `178.238.236.126` |
| IKE encryption | AES-256-CBC |
| IKE integrity | HMAC-SHA-256-128 |
| PRF | PRF-HMAC-SHA-256 |
| Diffie-Hellman group | Group 19 / ECP-256 |
| IKE rekey interval | 28,800 seconds |
| IPsec protocol and mode | ESP tunnel mode |
| ESP encryption | AES-256-CBC |
| ESP integrity | HMAC-SHA-256-128 |
| PFS on CHILD rekey | Group 19 / ECP-256 |
| CHILD lifetime | 28,800 seconds |
| CHILD rekey interval | 27,000 seconds |
| Encapsulation | NAT-T / tunnel in UDP |
| Traffic selectors | `10.95.8.92/32 <-> 172.31.254.10/32` |

## Negotiation evidence

The controlled initiation began at approximately:

```text
2026-09-14 23:40:32 Asia/Karachi
2026-09-14 20:40:32 Fintap server time
```

The Azure initiator recorded:

```text
received IKE_SA_INIT response from 178.238.236.126:500
selected IKE proposal AES_CBC_256/HMAC_SHA2_256_128/PRF_HMAC_SHA2_256/ECP_256
authentication of 178.238.236.126 with pre-shared key successful
IKE_SA onebill-mirror established
CHILD_SA onebill-mirror-92 established
TS 10.95.8.92/32 === 172.31.254.10/32
```

The Fintap responder independently recorded:

```text
received IKE_SA_INIT from 20.187.97.214:500
selected IKE proposal AES_CBC_256/HMAC_SHA2_256_128/PRF_HMAC_SHA2_256/ECP_256
authentication of simulated IKE identity 103.248.140.4 successful
IKE_SA onebill-mirror established
CHILD_SA onebill-mirror-92 established
TS 172.31.254.10/32 === 10.95.8.92/32
```

A controlled CHILD-SA rekey also completed successfully. The replacement CHILD SA explicitly reported:

```text
ESP:AES_CBC-256/HMAC_SHA2_256_128/ECP_256
```

This verifies PFS using ECP/DH Group 19.

## Protected path results

### Mirror to Fintap ping

```text
Source: 10.95.8.92
Destination: 172.31.254.10
3 packets transmitted
3 packets received
0 percent packet loss
```

### Fintap to mirror ping

```text
Source: 172.31.254.10
Destination: 10.95.8.92
3 packets transmitted
3 packets received
0 percent packet loss
```

### HTTPS health through IPsec

```text
Source: 10.95.8.92
Destination: 172.31.254.10:443
TLS hostname and SNI: app.fintap.pk
Result: HTTP 200
Service: fintap-api
Environment: production
```

No payment API was called and no financial record was created, changed or deleted.

## Interpretation for 1LINK

This result proves that Fintap can receive and answer IKEv2, negotiate the supplied Phase 1 suite, authenticate the agreed IP-style identities, install the exact `.92` CHILD selector, perform Group-19 PFS rekeying and serve HTTPS through the encrypted path.

If the actual Fintap capture contains no packet from `103.248.140.4` during a claimed 1LINK test, the remaining investigation is outside the demonstrated Fintap negotiation path. 1LINK should verify:

1. The Palo Alto IKE Gateway is enabled and the configuration is committed on the active device.
2. Gateway Version is `IKEv2 only mode`, as shown in the August 15, 2025 Internet IKEv2 template.
3. Peer address is `178.238.236.126`.
4. The actual local interface or NAT address is `103.248.140.4`.
5. Local IKE ID is `103.248.140.4` and peer IKE ID is `178.238.236.126`.
6. Passive Mode and initiator responsibility are agreed. If 1LINK is expected to initiate, its gateway must actually transmit.
7. UDP 500 and UDP 4500 are permitted in both directions.
8. The proxy IDs are `10.95.8.92/32` and `10.95.8.94/32` toward `172.31.254.10/32`.
9. The IKE and IPsec profiles match AES-256-CBC, SHA-256, Group 19 and 28,800 seconds.
10. Their packet capture and `ikemgr.log` show the exact attempt timestamp, configured destination and actual egress address.

The March 16, 2018 general network document mentions IKE Phase 1 Main Mode, which is IKEv1 terminology. The later Internet-specific template explicitly requires IKEv2-only operation. 1LINK should confirm that the current Palo Alto gateway was not created from an IKEv1/Main Mode legacy profile.

## Evidence retained

Raw evidence is retained root-only on both servers and does not contain the test PSK.

### Azure mirror

```text
/root/onebill-mirror-test/azure-mirror.pcap
/root/onebill-mirror-test/strongswan.log
/root/onebill-mirror-test/final-state.txt
```

SHA-256 checksums:

```text
31f1b48b0a4e41c00f3f9f03d0783b448f5f1161b1b4f4f539fc3bb954cbc676  azure-mirror.pcap
addc40c97e06fdb77d248f6469ac5efe4b0153eceec78c8ff3dd783e96f5adf8  strongswan.log
f789474164e3473fed2f50f09b063ace97bf7d368600bcfc0907f70bc94a6a1a  final-state.txt
```

### Fintap

```text
/root/onebill-mirror-test/fintap-mirror.pcap
/root/onebill-mirror-test/strongswan.log
/root/onebill-mirror-test/final-state.txt
```

SHA-256 checksums:

```text
87fdd704d187ca5cbe4e829862342d3b792c328e02ac7b6d6c0eba5623e3cf08  fintap-mirror.pcap
44e3a1b1c9af4416d46b2c53d929015bad3384854e5d97d3648310f2e1d3425c  strongswan.log
66b4afc8803045c09baa4db678ea490200907e14c6924bae8733a179ab0136b1  final-state.txt
```

Review and approve raw packet captures before sharing them outside Zynotch.

## Cleanup and production state

After the evidence was collected:

- The `onebill-mirror` IKE and CHILD SAs were terminated cleanly.
- The simulated `10.95.8.92/32` loopback address was removed from Azure.
- Both temporary mirror configuration files were deleted.
- The test-only PSK was deleted from both servers.
- Fintap's original `onebill`, `laptop-test` and `azure-test` configurations were restored.
- The official `onebill` configuration was not modified.
- The original Azure control SA remained established.
- The production Fintap health endpoint returned HTTP 200 after cleanup.

The retained packet captures, logs and final-state files are recoverable evidence. The deleted test PSK and temporary mirror configurations are intentionally not recoverable.
