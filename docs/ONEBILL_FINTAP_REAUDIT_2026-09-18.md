# Fintap and 1LINK VPN re-audit

Audit date: 18 September 2026, Pakistan time. Fresh control probes ran at 01:23 PKT (17 September, 20:23 UTC).

## Conclusion

The real 1LINK tunnel is still not established. This audit found no active Linux firewall, listener, or routing configuration that explains a blanket failure to receive IKE traffic. Fresh unsolicited IKEv2 requests from the authorized Azure control VM reached Fintap on both UDP 500 and UDP 4500; Fintap accepted the proposed algorithms and returned valid responses. Protected HTTPS also worked through the existing Azure IPsec tunnel.

This does not certify the production connection or assign fault to 1LINK. The live Contabo panel was subsequently verified: this VPS is not assigned to a Contabo firewall. The actual 1LINK egress address and running configuration remain unavailable, and no synchronized fresh attempt from the real peer occurred during this audit. A provider/transit problem outside the configurable firewall feature remains possible.

A concrete handover inconsistency needs resolution: documents from 5–8 September advertise protected IP `172.29.250.10/32`, but the running server and current VPN profile use `172.31.254.10/32`. We have not established which address 1LINK actually configured. That can break CHILD-SA negotiation or protected traffic; it does not explain a missing initial IKE_SA_INIT response.

Earlier confidence percentages and claims that a laboratory success proves the production endpoint completely correct were too strong. The supported conclusion is that the tested host capabilities work, while the production pairing and end-to-end path remain unproven.

## Scope and safety

- Read-only SSH audit of Fintap `178.238.236.126` and existing Azure control `20.187.97.214`.
- Two bounded IKE_SA_INIT probes using fresh initiator SPIs and ephemeral UDP source ports. No authentication attempt or PSK was used in these probes; temporary half-open states expired, with zero half-open SAs confirmed afterward.
- Three protected ICMP requests and a GET to `/api/health` through the existing control tunnel. No financial API or payment operation was submitted.
- Original 15 August 2025 IKEv2 template rendered and visually inspected, including embedded Palo Alto screenshots; network standards and existing runbook/control-test records reviewed.
- No VPN configuration, firewall rule, route, PSK, daemon, or application configuration was changed. No services were restarted. The existing Azure tunnel was left in place.
- The user opened the Contabo panel during the audit. Instance `203390162`, hostname `vmi3390162`, display name Fintap and IP `178.238.236.126` were checked. Its Firewall tab explicitly displayed “This Server is not a member of Firewall.” The live screen was visually inspected and shown in the conversation. No provider settings were changed.

## Live endpoint and parameter comparison

| Item | Observed Fintap configuration | Comparison or limitation |
|---|---|---|
| Public endpoint | `178.238.236.126/24` on `eth0` | Local public address exists |
| Public gateway | `178.238.236.1` | Route to the peer uses `eth0` and correct public source |
| 1LINK public peer | `103.248.140.4` | Matches the original template; actual current egress must be confirmed |
| Local and remote IKE identities | IPv4 identities `178.238.236.126` and `103.248.140.4` | Consistent with template's IP-address identity type; real peer not verified |
| IKE version | IKEv2 only | Matches 2025 Internet template, not legacy IKEv1 Main Mode wording |
| IKE proposal | `aes256-sha256-prfsha256-ecp256` | AES-256-CBC, SHA-256, PRF-HMAC-SHA-256, DH19; fresh control probe accepted |
| ESP proposal | `aes256-sha256-ecp256` | AES-256-CBC, SHA-256, PFS19; matches screenshot |
| IKE rekey | 28,800 seconds | Matches template timing intent; IKEv2 lifetimes are not negotiated proposal transforms |
| CHILD timing | Lifetime 28,800; rekey 27,000 seconds | Rekey margin is local behavior |
| Local protected address | `172.31.254.10/32` on loopback | Differs from older handover documents |
| Remote protected hosts | `10.95.8.92/32`, `10.95.8.94/32` | Two separate CHILD definitions |
| Startup initiation | `start_action = none` | Waits for initiation unless manually initiated |
| DPD and MOBIKE | `dpd_delay = 0`, `mobike = no` | No configured periodic active DPD; not evidence of blocked initiation |
| ESP encapsulation | Not forced; NAT-T available | Control tunnel uses UDP-encapsulated ESP; raw ESP on real path untested |
| Contabo private interface | `10.0.0.1/22` on `eth1` | Separate hosting network, not the agreed protected service address |

The 2025 template does not fill in this customer's protected IPs. It cannot resolve the old/new selector disagreement. Its displayed phase-1 and phase-2 settings do match the current crypto suite. The older general network standards are not evidence that this Internet connection should be changed to IKEv1.

## Local blocking layers checked

| Layer | Observation | Interpretation |
|---|---|---|
| Contabo configurable firewall | Correct live instance explicitly says no firewall membership | This feature is not currently applying an inbound ruleset to this VPS; not a blanket clearance of all provider networking |
| VPN service | `charon-systemd` active, required crypto plugins available | VPN daemon is running |
| IKE sockets | UDP 500/4500 IPv4 and IPv6 owned by charon | Nginx does not own these sockets |
| UFW | `ufw status`: inactive; configuration disabled | A oneshot service status is not proof filtering is enabled |
| nftables / iptables | Empty filter rules; INPUT, OUTPUT, FORWARD ACCEPT; no legacy rules returned | No host source/port deny found |
| Other security controls | No active fail2ban/firewalld block identified; charon AppArmor profile in complain mode | No identified enforcement rejecting IKE |
| Earlier packet hooks | No XDP, tc, BPF netfilter, or flow-dissector attachment shown | No hidden filter found in inspected hooks |
| Routing | Standard local/main/default rules, no blackhole or conflicting policy rule | Public reply route is locally correct; Internet delivery still unproven |
| Reverse-path filtering | `all=2`, `eth0=2`, counter zero | Loose mode; no reverse-path drop evidence |
| Namespace / service isolation | No named network namespace; `PrivateNetwork=no`; no systemd IP allow/deny | No service isolation blocker found |
| Queue pressure | 16 workers, 11 idle, job queues zero, zero half-open SAs after probes | No daemon exhaustion at audit time |
| UDP errors | Input/checksum/receive-buffer/send-buffer errors zero | No recorded host UDP error explanation |
| IPsec policy | Only active Azure policies; no stale 1LINK selector conflict identified | No installed production CHILD SA |
| XFRM counters | `XfrmInNoStates=56`, unchanged through successful test; other shown errors zero | Historical unmatched ESP is not evidence of current IKE failure |
| Time | NTP synchronized; timezone Europe/Berlin | Use UTC or PKT consistently when comparing logs |
| Nginx | Syntax valid, HTTPS listener active, no deny/allow or rate-limit directive found in inspected config | No Nginx block identified; Nginx cannot explain IKE_SA_INIT silence here |
| API IP allowlist | Configuration loader includes `.92` and `.94`, with one trusted proxy hop | Relevant only after VPN/HTTPS; real authenticated 1LINK request not tested |

`ip_forward=0` does not prevent this deployment's local-service VPN: the protected address and application are on the VPN server itself. It would matter if this machine had to forward traffic to another host.

A plain route lookup for `10.95.8.92` currently follows the public default route because no production CHILD policy is installed. Policy-based IPsec does not require a visible tunnel interface. Do not add arbitrary VPC routes as a Phase 1 fix. Separately, fail-closed protection for protected destinations when the SA is absent deserves review before production use.

## Fresh controlled evidence

At `2026-09-17 20:23:26–27 UTC`, Azure sent one IKEv2 request per destination port. Both offered AES-256-CBC / SHA-256 / PRF-SHA-256 / ECP-256. Each response had the matching initiator SPI and contained SA, KE and Nonce payloads, not a proposal rejection.

```text
20.187.97.214:53716 -> 178.238.236.126:500   IKE_SA_INIT request, 184 bytes
178.238.236.126:500 -> 20.187.97.214:53716   valid response, 200 bytes

20.187.97.214:37609 -> 178.238.236.126:4500  UDP payload 188 bytes
178.238.236.126:4500 -> 20.187.97.214:37609  UDP payload 204 bytes
```

The 4500 payload lengths include the four-byte non-ESP marker. The bounded Fintap tcpdump reported zero packets dropped by the kernel.

Daemon evidence for both requests:

```text
parsed IKE_SA_INIT request 0 [ SA KE No ]
selected proposal: IKE:AES_CBC_256/HMAC_SHA2_256_128/PRF_HMAC_SHA2_256/ECP_256
generating IKE_SA_INIT response 0 [ SA KE No N(CHDLESS_SUP) N(MULT_AUTH) ]
```

These are fresh inbound exchanges, not merely keepalives on the already-established control tunnel. However, they match the Azure-address test configuration, not the real-peer address constraint. They do not complete IKE_AUTH and do not verify 1LINK's real PSK.

At `20:22:33 UTC`, the existing control tunnel also passed:

```text
ping 10.1.1.4 -> 172.31.254.10: 3 sent, 3 received
GET https://app.fintap.pk/api/health via 172.31.254.10:
HTTP 200, ssl_verify_result=0, service=fintap-api, environment=production
```

TLS verification was enabled; no `-k` was used. The active CHILD counters increased to 15 inbound and 14 outbound packets. This proves useful protected traffic for this control, not successful financial API authentication from 1LINK.

## Historical evidence and its limits

For `2026-09-13 00:00 UTC` through `2026-09-16 00:00 UTC`, the StrongSwan journal contained 9,821 received-packet log entries from 39 public source addresses. Azure accounted for 9,733. None of these received-packet entries came from `103.248.140.4`.

The journal also shows rejects for other public addresses with no matching IKE configuration. Those cannot be attributed to 1LINK without their actual egress address and exact attempt time. Searching only the expected IP would miss an unexpected NAT source; the next joint capture should include all IKE sources.

The 14 September production attempt recorded five Fintap transmissions beginning `13:02:10 UTC` (`18:02:10 PKT`) with no recorded response from the configured peer. Across the retained journal since 7 September, the count was 32 transmissions to that peer and zero received-packet entries from it. These are log counts, not a continuous historical wire capture and not 32 separate connection attempts.

Successful September 14 log lines containing IKE identity `103.248.140.4` came from the Azure mirror at public transport address `20.187.97.214`. They are not successful real-1LINK traffic. The mirror record explicitly says it used a separate test-only PSK.

## Remaining ways our side could still be wrong

1. **Provider or path filtering specific to 1LINK.** Azure reachability cannot exclude upstream mitigation or a path failure. The live Contabo panel now rules out its attached-firewall feature for this VPS, but not every upstream control. A host capture cannot see a packet dropped before the VM.
2. **Wrong allowed public peer.** If 1LINK actually transmits from a different address, `remote_addrs = 103.248.140.4` may reject the connection. Confirm the observed address before making a narrowly scoped change; do not replace it with `%any` as a blind fix.
3. **Both sides waiting.** Fintap is not configured to auto-start. Confirm which side initiates IKE, independently of which side sends application requests. “One-way connection” does not mean IKE works without replies.
4. **Authentication or identity mismatch.** The real PSK has not been verified against their gateway. IPv4, FQDN and Key ID identity types are distinct even if displayed strings look similar. A later IKE_AUTH failure is still possible.
5. **Actual gateway differs from its template.** Current Fintap permits IKEv2 and the specific crypto proposal only. A deployed IKEv1 gateway or different PRF/DH proposal would not match. Do not downgrade solely because an older document mentions Main Mode.
6. **Protected IP mismatch.** Resolve `172.29.250.10/32` versus `172.31.254.10/32` against the accepted handover. An agreed correction may belong on Fintap or 1LINK; do not assume the newest local value is authoritative.
7. **ESP transport or post-tunnel application mismatch.** Raw ESP (IP protocol 50) has not been validated to the real peer. NAT-T support is not the same as forcing encapsulation. DNS/SNI, decrypted source addresses and API credentials also need end-to-end testing after IKE works.

The current file-derived API allowlist includes the two 1LINK hosts plus laboratory addresses `172.31.253.20` and `10.1.1.4`. The PSK previously shared for testing is weak. Existing test profiles, extra API permissions, broadly open host filtering and credential rotation need a separate, controlled production-hardening pass; none is a reason to open more ports blindly now.

The runbook also describes a wildcard certificate expiring 9 December. The currently served certificate is specifically for `app.fintap.pk`, issued by Let's Encrypt YE1, valid 5 September–4 December 2026. It passed verification in this audit. This is documentation drift, not a Phase 1 blocker.

## Next decisive test

The live Contabo assignment check is complete: no firewall is attached. Do not attach or change a firewall merely to troubleshoot this finding. If a firewall is deliberately introduced later, preserve required access and account for IKE UDP 500/4500 from the verified peer, plus the agreed ESP transport. Contabo documents its firewall as a separate inbound filter; this feature does not filter outbound traffic. [Contabo firewall documentation](https://help.contabo.com/en/support/solutions/articles/103000390430-firewall-what-is-it-and-how-does-it-protect-my-vps-vds-).

Then agree a short time window and ask 1LINK to show this specific gateway's IKE SA separately from the IPsec CHILD SA. A red tunnel indicator alone does not identify which stage failed. Their operator can use the following targeted commands, replacing the placeholders with their existing names:

```text
show vpn ike-sa gateway <gateway-name>
show vpn ipsec-sa tunnel <tunnel-name>
test vpn ike-sa gateway <gateway-name>
```

The `test` command initiates the designated gateway; use it during the agreed window. Ask their operator for relevant IKE log excerpts and an outside-interface capture showing actual source/destination and timestamps. They can redact unrelated customers and secrets. These are standard vendor diagnostics. [Palo Alto connectivity testing](https://docs.paloaltonetworks.com/network-security/ipsec-vpn/administration/troubleshooting/test-vpn-connectivity).

Simultaneously capture on Fintap without restricting the source to the assumed peer:

```bash
# Run during the agreed short window. No packet payload/key dump.
timeout 60 tcpdump -ni eth0 -nn -tttt -s 256 \
  'udp port 500 or udp port 4500 or ip proto 50'
```

| Matched observation | What it establishes |
|---|---|
| Their outside capture sends to the correct address; nothing reaches Fintap | Investigate provider/transit path; does not by itself identify which network dropped it |
| Request reaches Fintap; daemon rejects it | Resolve exact address/version/proposal error locally against agreed settings |
| Request and reply visible at Fintap; reply absent at their outside capture | Investigate return-path/provider filtering |
| IKE_SA_INIT exchanges, then IKE_AUTH fails | Compare PSK and both typed identities |
| IKE SA exists, CHILD SA fails | Compare current protected selectors and phase-2 settings |
| CHILD SA exists, HTTPS fails | Inspect decrypted routes, source addresses, policy, TLS/SNI and application authentication |

Do not flush SAs, restart StrongSwan, change protected IPs, or disable more security controls merely to repeat an unsynchronized test.

## Reference semantics

StrongSwan documents that responder matching uses `remote_addrs`; `start_action=none` loads a responder-capable profile without auto-initiation; and `encap` can force UDP encapsulation when necessary. These behaviors explain the conditional checks above, not a demonstrated production root cause. [Configuration reference](https://docs.strongswan.org/docs/latest/swanctl/swanctlConf.html).

IKE identity strings are parsed into distinct identity types. [Identity parsing](https://docs.strongswan.org/docs/latest/config/identityParsing.html). NAT-T encapsulates ESP in UDP, so a NAT-T lab does not independently validate raw ESP transport. [NAT traversal](https://docs.strongswan.org/docs/latest/features/natTraversal.html).

Local records compared: `Call_ONEBILL_VPN_DEBUG_CALL_RUNBOOK_2026-09-14.md`, `ONEBILL_EXACT_SELECTOR_MIRROR_VALIDATION_2026-09-14.md`, `ONEBILL_PALO_ALTO_ROOT_CAUSE_ANALYSIS_2026-09-16.md`, and the 5–8 September connectivity/handover documents. This audit qualifies earlier conclusions; it does not overwrite the historical records.
