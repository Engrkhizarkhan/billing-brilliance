# 1LINK / 1BILL IPsec VPN — Palo Alto Root-Cause Analysis

**Prepared for:** Zynotch PVT Limited and the 1LINK / 1BILL network team  
**Date:** 16 September 2026  
**Scope:** Phase 1 does not establish between Fintap and the real 1LINK public peer  
**Security note:** This report deliberately excludes the pre-shared key, API credentials, private keys and IPsec key material.

## Executive conclusion

The Fintap endpoint is working and implements the current 1LINK Internet IKEv2 profile correctly. The unresolved production failure occurs before authentication and before IPsec traffic selectors are evaluated: Fintap transmits the first IKEv2 `IKE_SA_INIT` request to the documented 1LINK peer, retransmits it four times, and receives no packet in reply.

This establishes two important boundaries:

1. A wrong PSK, IKE identity, proxy ID, Phase 2 proposal, PFS setting, TLS setting or TCP 443 policy cannot explain the present **absence of an `IKE_SA_INIT` response**. Those settings are evaluated later.
2. The remaining fault domain is the real 1LINK gateway or the network path to/from it: initiation ownership, an inactive or uncommitted gateway, an incorrect peer/local-interface/NAT value, an IKE-version error on the active Palo Alto configuration, a firewall/ACL/DoS block, or return-path failure.

My calibrated assessment is:

- **95% confidence:** the Fintap VPN host, StrongSwan responder/initiator and protected HTTPS path are functional.
- **85–90% confidence:** the current production block is on the 1LINK side or the Internet/security path controlled or observable by 1LINK.
- **Not yet provable:** which specific 1LINK-side condition is responsible. A synchronized two-sided packet capture and `ikemgr` log will decide this in one test.

The highest-probability operational explanation is that 1LINK is supposed to be the only initiator, while Fintap is intentionally configured not to auto-initiate, but 1LINK’s active Palo Alto gateway is not actually transmitting—or its gateway is not active/committed/matched to Zynotch. If 1LINK’s gateway has **Passive Mode** enabled too, neither side will initiate automatically. Palo Alto states that Passive Mode only responds and never initiates.[^1]

There is also a concrete Palo Alto version-specific risk: PAN-OS **11.2.0 through 11.2.4**, when managed by Panorama 11.2 or later, can interpret a newly pushed default IKEv2 gateway as IKEv1 unless IKEv2 was explicitly selected through Panorama CLI before deployment.[^2] This is a conditional lead until 1LINK discloses the active firewall and Panorama versions.

## 1. Evidence reviewed

### 1.1 Zynotch project and live system

- The joint-call runbook and its verified configuration.
- The exact-selector IKEv2 mirror validation.
- The independent legacy IKEv1 Main Mode control validation.
- Earlier connectivity submissions and handover documents.
- A fresh read-only inspection of the live Fintap server at `178.238.236.126`.
- StrongSwan logs for the real 1LINK attempt on 14 September 2026.
- The loaded production StrongSwan configuration, with secret material excluded.

### 1.2 Documents supplied by 1LINK

- **“1LINK STANDARD IPSEC TEMPLATE OVER INTERNET WITH Ikev2”**, dated 15 August 2025.
- **“1LINK DATA Network Standards v2.1”**, dated 16 March 2018.
- Aggregator Details Sheet.
- PRF-Q / PMO External Projects form.
- 1BILL Test Cases sheet.
- Generic REST specification.

The spreadsheets and REST specification contain application/project data, but no additional customer-specific IKE Phase 1 parameters that resolve the VPN failure.

### 1.3 Relevant 1LINK correspondence

- The 4 September kickoff says Zynotch must provide both public and private IPs; 1LINK must whitelist the Zynotch host IP on its two servers; and UAT and Production use separate connections.
- On 14 September, 1LINK re-sent the 15 August 2025 IKEv2 template. The email attachment and the repository copy have the identical SHA-256 checksum:

```text
021fec8e056506a45676ffb417a78c764238e052b293af4e23c2ae6cbf1c7944
```

This strongly indicates that the 2025 IKEv2 template—not the 2018 Main Mode language—is the currently communicated profile.

### 1.4 Primary technical sources

Palo Alto Networks administration, troubleshooting and release documentation; the IETF IKEv2 standard (RFC 7296); and the official StrongSwan configuration and proposal documentation.[^1][^2][^3][^4][^5][^6]

## 2. Authoritative connection profile

The later, Internet-specific 2025 template is the best available authority for this connection. Its Palo Alto screenshots specify:

| Item | 1LINK 2025 template | Fintap production | Assessment |
|---|---|---|---|
| IKE version | IKEv2 only | IKEv2 (`version = 2`) | Match |
| Authentication | Pre-shared key | PSK | Match |
| IKE encryption | AES-256-CBC | `aes256` | Match |
| IKE integrity/authentication | SHA-256 | `sha256` | Match |
| IKE PRF | Implied by IKEv2 SHA-256 profile / stated by 1LINK as “PRF 256” | `prfsha256` | Match |
| DH group | Group 19 | `ecp256` | Match; StrongSwan maps `ecp256` to IANA group 19[^5] |
| IKE lifetime | 28,800 seconds | 28,800 seconds | Match |
| IKEv2 authentication multiple | 0 | no forced reauthentication | Compatible |
| IPsec protocol | ESP | ESP | Match |
| ESP encryption | AES-256-CBC | `aes256` | Match |
| ESP integrity | SHA-256 | `sha256` | Match |
| PFS | Group 19 | `ecp256` | Match |
| IPsec lifetime | 28,800 seconds | lifetime 28,800; rekey 27,000 | Compatible |
| Fintap public endpoint | Customer-specific field is blank in generic template | `178.238.236.126` | 1LINK must prove populated value |
| 1LINK public endpoint | `103.248.140.4` | remote `103.248.140.4` | Match |
| Fintap protected selector | Customer-specific field is blank | `172.31.254.10/32` | 1LINK must prove current value |
| 1LINK protected selectors | Not individualized in the template | `10.95.8.92/32`, `10.95.8.94/32` | Must be confirmed on active Palo config |

Palo Alto’s current IKE profile documentation confirms support for group 19, SHA-256 and AES-256-CBC, and states that peer IKE parameters must match.[^7]

### 2.1 What “PRF 256” means

For IKEv2, the pseudorandom function derives keying material. Fintap explicitly proposes `PRF_HMAC_SHA2_256`, represented in StrongSwan as `prfsha256`. This is already present and succeeded in the controlled exact-profile negotiation. “PRF 256” is therefore not a missing parameter.

### 2.2 Old document versus new document

The 2018 general network standard uses “Main Mode,” which is IKEv1 terminology. The 2025 Internet template explicitly selects **IKEv2 only mode** in the Palo Alto gateway screenshot. Because the later document is both newer and specific to VPN over the Internet, production should remain IKEv2 unless 1LINK confirms in writing that its **running** gateway is actually IKEv1.

The repository’s derived Markdown version of the old network document should not be used as authority for the date or for an Internet-IKEv2 parameter table: the original Word file is dated 16 March 2018 and does not contain that later Internet-specific table.

## 3. Current Fintap state

The live server was checked read-only. No production configuration was changed.

```text
Public interface:       178.238.236.126/24 on eth0
Protected IP:           172.31.254.10/32 on loopback
Hosting private IP:     10.0.0.1/22 on eth1 (not a VPN selector)
Route to 1LINK:         via 178.238.236.1, eth0, source 178.238.236.126
IKE listeners:          UDP 500 and UDP 4500, charon-systemd
StrongSwan:             5.9.13
Services:               strongswan, onebill-vpn-ip and nginx active
```

The loaded production connection is:

```text
IKEv2
local transport / ID:   178.238.236.126
remote transport / ID:  103.248.140.4
IKE proposal:           aes256-sha256-prfsha256-ecp256
MOBIKE:                 disabled
DPD/liveness interval:  disabled
IKE rekey:              28800 seconds

CHILD onebill-92:
  172.31.254.10/32 <-> 10.95.8.92/32
CHILD onebill-94:
  172.31.254.10/32 <-> 10.95.8.94/32
ESP proposal:           aes256-sha256-ecp256
Lifetime / rekey:       28800 / 27000 seconds
Start action:           none
```

StrongSwan documents `start_action = none` as loading the connection without automatically initiating it; the connection can still be manually initiated or used as a responder.[^6]

The nonessential StrongSwan plugins absent from this installation do not explain the failure. The required algorithms are loaded, advertised, and were negotiated in the independent exact-profile test.

## 4. What the real production attempt proves

At 15:02 server time on 14 September 2026, Fintap manually initiated the production child. The log records:

```text
15:02:10  initiating IKE_SA onebill[318] to 103.248.140.4
15:02:10  178.238.236.126:500 -> 103.248.140.4:500, 272 bytes
15:02:14  retransmission, 272 bytes
15:02:21  retransmission, 272 bytes
15:02:34  retransmission, 272 bytes
15:02:57  retransmission, 272 bytes
```

There is no corresponding received packet from `103.248.140.4`.

Palo Alto’s own Phase 1 timeout guidance says this condition occurs when IKE message 1 does not reach the peer, the peer does not respond, or the response is dropped. Its worked example was an upstream security control blocking the traffic.[^8]

This is not yet evidence of a successful Phase 1 proposal exchange. It is evidence that Fintap transmitted the first request and received no response at all.

## 5. Why later parameters cannot be the present blocker

IKEv2 is a request/response protocol. RFC 7296 defines the initial exchanges as `IKE_SA_INIT` followed by `IKE_AUTH`; the first Child SA is completed in `IKE_AUTH`.[^4]

```text
Fintap (initiator)                         1LINK (responder)
        IKE_SA_INIT request  ----------->
        <----------- IKE_SA_INIT response     CURRENTLY MISSING

        IKE_AUTH + identity + AUTH ------>     NOT REACHED
        <------ IKE_AUTH + Child SA            NOT REACHED

        Encrypted application traffic          NOT REACHED
```

Therefore:

| Suspected setting | Stage where it matters | Can explain zero `IKE_SA_INIT` reply? |
|---|---|---|
| PSK value | IKE_AUTH | No |
| Local/peer IKE identities | IKE_AUTH / gateway selection details | Normally no; the responder first has to receive message 1 |
| Proxy IDs / traffic selectors | First Child SA in IKE_AUTH / later Child SAs | No |
| ESP encryption/integrity/PFS | Child SA | No |
| Protected IP `.29` versus `.31` | Child SA selector | No, but it will likely break Phase 2 later |
| HTTPS hostname/SNI/TLS | Application traffic after IPsec | No |
| TCP 443 application whitelist | Application traffic after IPsec | No |
| DPD / IKEv2 liveness disabled | Health of an existing IKE SA | No |
| IKE version | Initial packet parsing/gateway match | Yes, conditionally |
| IKE proposal / DH group | `IKE_SA_INIT` | Yes, but a reachable responder normally logs and returns an error/alternative |
| Peer destination, local interface, NAT/ACL/path | Before or at receipt of message 1 | Yes |
| Neither peer initiating | Before message 1 | Yes |

Palo Alto documents PSK mismatch as an `AUTHENTICATION_FAILED` condition,[^9] and traffic-selector mismatch as `TS_UNACCEPTABLE` during Child SA negotiation.[^10] Neither matches the observed “no reply to message 1” state.

## 6. Controlled tests and what they establish

### 6.1 Exact IKEv2 mirror test

An independent Azure Ubuntu endpoint at public address `20.187.97.214` acted as a controlled 1LINK mirror. It used:

- simulated IKE identity `103.248.140.4`;
- protected source `10.95.8.92/32`;
- Fintap protected destination `172.31.254.10/32`;
- the exact IKEv2/PSK/AES-256-CBC/SHA-256/PRF-SHA-256/group-19 profile;
- ESP AES-256-CBC/SHA-256/PFS group 19.

Results:

- IKE SA established.
- PSK authentication succeeded.
- Exact Child SA installed.
- NAT-T worked.
- Group-19 PFS rekey worked.
- Protected ping worked in both directions.
- HTTPS to `172.31.254.10:443` with `app.fintap.pk` SNI returned HTTP 200.

This is strong functional proof of the Fintap responder, algorithms, identity handling, Child selector, kernel IPsec path and application path. It does **not** prove what is configured or transmitted by the real 1LINK Palo Alto firewall.

### 6.2 Legacy IKEv1 Main Mode control

A separate controlled test also established the 2018 document’s IKEv1 Main Mode interpretation with the exact protected selector. This shows Fintap is technically capable of the legacy profile too. It does not justify changing production away from the newer IKEv2 template.

## 7. Ranked root-cause hypotheses

### Rank 1 — Initiator ownership or gateway activation failure

**Likelihood: high.**

1LINK reportedly said this is a “one-end connection” and Zynotch should not send the initiating traffic. Fintap’s `start_action = none` respects a responder-by-default design. If 1LINK is the designated initiator but has not run the initiation or generated interesting traffic, the tunnel will remain down by design.

If 1LINK’s Palo Alto gateway also has **Passive Mode** selected, it never initiates. Then neither peer initiates automatically. If 1LINK is designated initiator, Passive Mode must be off and they should run:

```text
test vpn ike-sa gateway <gateway-name>
test vpn ipsec-sa tunnel <tunnel-name>
```

Palo Alto documents both commands as the direct way to initiate the IKE and IPsec negotiations.[^3]

### Rank 2 — Customer gateway missing, disabled, uncommitted or on the wrong HA node/template

**Likelihood: high.**

The supplied 2025 document is a generic template. Its customer public IP and interesting-traffic fields are blank. It proves the intended standard, not that a Zynotch gateway exists in the running Palo Alto configuration.

Palo Alto requires the gateway configuration to be committed.[^1] In active/passive HA, only the active firewall processes network traffic; a passive interface may appear up while discarding traffic.[^11] 1LINK must show the running configuration and HA state on the active device, not only a Panorama candidate template or a screenshot from a passive unit.

### Rank 3 — Wrong peer IP, local interface, public NAT address, whitelist, route or upstream security policy

**Likelihood: high.**

The active Palo gateway must target `178.238.236.126`. Its selected local interface/IP must lead to the expected Internet/NAT identity `103.248.140.4`, and UDP 500/4500 must be allowed bidirectionally. A configured address in the GUI is not proof of the actual egress source.

The Palo Alto timeout article specifically directs teams to validate endpoint reachability, security policy, routing, NAT-T and upstream controls.[^8] The decisive evidence is a Palo egress capture and simultaneous Fintap ingress capture.

### Rank 4 — Active gateway is IKEv1 despite the 2025 IKEv2 template

**Likelihood: medium, conditional.**

This can happen through legacy configuration or through the documented PAN-OS 11.2.0–11.2.4 / Panorama interpretation problem.[^2] Palo Alto associates `unknown ikev2 peer` with an IKE-version mismatch.[^12]

This hypothesis cannot be confirmed from the generic Word template. 1LINK should disclose:

- PAN-OS version;
- whether Panorama manages the firewall and its version;
- running IKE Gateway Version field;
- whether IKEv2 was explicitly configured and committed;
- same-timestamp `ikemgr.log` or `ikemgr-ng.log` lines.

### Rank 5 — IKE proposal mismatch

**Likelihood: low with the provided profile, but must be checked in the running configuration.**

Fintap’s offer matches the 2025 template and the exact profile succeeded in the mirror test. If the active 1LINK profile is different, Palo should normally log a proposal problem and can return `NO_PROPOSAL_CHOSEN`. Palo’s troubleshooting guidance tells operators to inspect UDP 500 packet capture and IKE logs for the actual negotiated values.[^10]

### Rank 6 — DoS/zone/packet-buffer protection or other silent drop

**Likelihood: low but plausible.**

Palo Alto packet-buffer protection can block all traffic from an offending source, including a shared translated source.[^13] A DoS/Zone Protection rule, dynamic block list or upstream DDoS service could silently discard `178.238.236.126`. 1LINK should check global counters, threat/traffic logs and block lists for the synchronized test time.

An IKEv2 cookie threshold is less consistent with the evidence because a reachable responder under cookie protection normally sends a cookie challenge rather than staying completely silent.

### Rank 7 — Fintap listener, algorithm or host-firewall failure

**Likelihood: very low.**

UDP 500/4500 are listening; route and source address are correct; the host accepts unrelated inbound IKE attempts; and multiple independent external peers established the exact and legacy profiles. This hypothesis is contradicted by direct functional tests.

## 8. A second issue waiting behind Phase 1: protected-IP drift

Zynotch’s protected/private value changed during the implementation:

| Period / source | Value communicated or used | Meaning |
|---|---|---|
| Initial kickoff response | `10.0.0.1` / `10.0.0.0/22` | Hosting-provider private interface; later excluded from VPN |
| 5–8 September submissions | `172.29.250.10/32` | First dedicated protected loopback |
| Current production and 11–16 September tests | `172.31.254.10/32` | Current dedicated protected loopback |

This drift does **not** cause the present missing `IKE_SA_INIT` response, because traffic selectors are later in IKEv2. But if 1LINK still has `172.29.250.10/32`, Phase 1 can succeed and the Child SA can then fail with `TS_UNACCEPTABLE` or “cannot find matching IPSec tunnel.”

The teams should freeze a single written source of truth:

```text
Fintap public endpoint:       178.238.236.126
Fintap protected selector:    172.31.254.10/32
1LINK public endpoint:        103.248.140.4
1LINK protected selectors:    10.95.8.92/32 and 10.95.8.94/32
Application:                  TCP 443, TLS hostname/SNI app.fintap.pk
```

## 9. Decisive joint test

The next call should not begin by editing crypto settings. It should begin with synchronized capture and one declared initiator.

### 9.1 Agree before starting

Write in the meeting chat:

```text
Test start: <UTC timestamp>
Initiator: 1LINK Palo Alto
1LINK public/egress IP: 103.248.140.4
Destination: 178.238.236.126 UDP 500/4500
IKE version: IKEv2 only
Current Fintap protected IP: 172.31.254.10/32
```

### 9.2 Fintap capture

Run on Fintap before 1LINK initiates:

```bash
date --iso-8601=seconds
tcpdump -ni any -vvv -s0 \
  'host 103.248.140.4 and (udp port 500 or udp port 4500 or ip proto 50)'
```

In a second terminal:

```bash
journalctl -u strongswan -f -o short-iso
```

### 9.3 1LINK Palo Alto checks

These are normal operational/status commands and should not expose the PSK:

```text
show system info
show high-availability state
show vpn gateway
show vpn ike-sa
show vpn ipsec-sa
show vpn tunnel
show running tunnel flow info
```

Then enable IKE-specific evidence, initiate once, and stop debugging afterward:

```text
debug ike global on debug
debug ike pcap on
test vpn ike-sa gateway <gateway-name>
test vpn ipsec-sa tunnel <tunnel-name>
less mp-log ikemgr.log
```

For PAN-OS 11.2 and later, Palo Alto notes that the log name may be `ikemgr-ng.log`.[^10]

After evidence is collected:

```text
debug ike pcap off
debug ike global off
```

If permitted by 1LINK policy, export or screen-share the filtered IKE pcap. Palo Alto also documents `debug ike pcap on` and viewing the `ikemgr.pcap` capture.[^3]

### 9.4 Interpret the result

| 1LINK capture | Fintap capture | Conclusion |
|---|---|---|
| No outbound packet | No inbound packet | 1LINK initiation/gateway/tunnel binding problem |
| Outbound to wrong destination | No inbound packet | Correct 1LINK peer IP to `178.238.236.126` |
| Outbound from a different public/NAT IP | Packet may be absent or unmatched | Declare actual egress and adjust static-peer design only by agreement |
| Outbound correct; Fintap sees nothing | Transit/upstream ACL/routing/DDoS issue |
| Fintap sees request and replies; 1LINK sees no reply | 1LINK return path/upstream filtering issue |
| Both see `IKE_SA_INIT`; Palo logs version/proposal error | Correct running IKE version/profile |
| IKE SA establishes; Child logs `TS_UNACCEPTABLE` | Correct `.31` proxy IDs and their direction |
| Child establishes; TCP 443 fails | Then investigate routes, zones, security policy, SNI/TLS and application allowlists |

## 10. Exact evidence 1LINK should show

1. Palo Alto firewall model and PAN-OS version.
2. Whether Panorama is used and its version.
3. HA state proving which unit is active.
4. Successful commit/push state and configuration synchronization.
5. The active IKE Gateway name, enabled/running state and attached IPsec tunnel.
6. Version: `IKEv2 only mode`.
7. Passive Mode setting and a written declaration of which side initiates.
8. Selected local interface and local IP.
9. Actual Internet/NAT source expected to appear as `103.248.140.4`.
10. Peer IP exactly `178.238.236.126`.
11. Local ID `103.248.140.4`; peer ID `178.238.236.126`.
12. Attached IKE crypto profile: AES-256-CBC, SHA-256, group 19, 28,800 seconds.
13. Attached IPsec crypto profile: ESP AES-256-CBC, SHA-256, PFS group 19, 28,800 seconds.
14. Proxy IDs mirrored as:
    - local `10.95.8.92/32`, remote `172.31.254.10/32`;
    - local `10.95.8.94/32`, remote `172.31.254.10/32`.
15. UDP 500/4500 packet capture for one synchronized timestamp.
16. `ikemgr.log` / `ikemgr-ng.log` lines from the same attempt.
17. Traffic/threat/global-counter evidence showing whether `178.238.236.126` was dropped.

It is normal and reasonable to screen-share these commands and sanitized outputs during a joint network-debugging call. 1LINK may reasonably redact the PSK, unrelated gateways, internal device names and unrelated customer information. The PSK itself is not required for this diagnosis.

## 11. Recommended message to 1LINK

> We have verified our live StrongSwan IKEv2 configuration and completed an independent exact-profile test using AES-256-CBC, SHA-256, PRF-SHA-256, DH/PFS group 19 and the exact `10.95.8.92/32 <-> 172.31.254.10/32` selector. IKE, PSK authentication, Child SA, PFS rekey, encrypted traffic and HTTPS 443 all succeeded. During the real 14 September attempt, our host sent five `IKE_SA_INIT` packets from `178.238.236.126:500` to `103.248.140.4:500` and received no response. Because this occurs before IKE authentication and Child-SA selection, PSK, proxy-ID and Phase-2 settings are not yet the observed blocker. Please initiate from the active Palo Alto gateway during a synchronized capture and show the running gateway Version, Passive Mode, peer/local interface, actual NAT egress, HA/commit status, `show vpn` outputs and same-time `ikemgr` logs. Please also confirm that your current remote proxy ID is `172.31.254.10/32`, not the earlier `172.29.250.10/32`. If your firewalls run PAN-OS 11.2.0–11.2.4 under Panorama 11.2+, please verify that IKEv2 was explicitly set because Palo Alto documents a default-configuration interpretation issue in that combination.

## 12. Final decision

Do not purchase or deploy a Palo Alto VM merely to prove Fintap compatibility. The Linux-to-Linux exact-profile test already proves the protocol and Fintap endpoint, and Palo Alto officially supports the selected algorithms. A separate Palo Alto lab could reproduce GUI configuration, but it cannot prove the running configuration, NAT, HA state, whitelist or egress path inside 1LINK.

Do not change production to IKEv1, weaken algorithms or add broad/wildcard peers based only on “tunnel not up.” First obtain the missing first-packet evidence from the real Palo Alto endpoint.

The next decision gate is simple:

- **No packet from 1LINK reaches Fintap:** 1LINK/path issue; correct activation, initiation, peer, NAT, routing or security controls.
- **Packet reaches Fintap:** use the immediate IKE response/log to correct the exact version/proposal/identity issue.
- **IKE SA establishes but Child fails:** correct the known `.29` versus `.31` selector drift and proxy-ID direction.
- **Child establishes:** move to route/security-policy/TLS/TCP 443 testing.

## Sources

[^1]: Palo Alto Networks, [Set Up an IKE Gateway](https://docs.paloaltonetworks.com/network-security/ipsec-vpn/administration/set-up-site-to-site-vpn/set-up-an-ike-gateway). Documents IKE version selection, public local interface/IP, peer IP, identifiers, Passive Mode, NAT traversal and the required commit.
[^2]: Palo Alto Networks, [Changes to Default Behavior in PAN-OS 11.2](https://docs.paloaltonetworks.com/pan-os/11-2/pan-os-release-notes/changes-to-default-behavior/changes-to-default-behavior-in-pan-os-11-2). Documents the PAN-OS 11.2.0–11.2.4 / Panorama 11.2+ default IKEv2 interpretation problem.
[^3]: Palo Alto Networks, [Troubleshoot Site-to-Site VPN Issues Using CLI](https://docs.paloaltonetworks.com/network-security/ipsec-vpn/administration/troubleshooting/troubleshooting-site-to-site-vpn-issues-using-cli). Official show, test, debug and IKE packet-capture commands.
[^4]: IETF, [RFC 7296: Internet Key Exchange Protocol Version 2](https://www.rfc-editor.org/rfc/rfc7296). Defines `IKE_SA_INIT`, `IKE_AUTH`, Child SAs, traffic selectors and request/response exchanges.
[^5]: strongSwan, [Algorithm Proposals (Cipher Suites)](https://docs.strongswan.org/docs/latest/config/proposals.html). Maps `ecp256` to group 19 and documents IKE/ESP proposal syntax.
[^6]: strongSwan, [swanctl.conf Reference](https://docs.strongswan.org/docs/latest/swanctl/swanctlConf.html). Documents `start_action = none` as load-only, with manual initiation or responder use.
[^7]: Palo Alto Networks, [Define IKE Crypto Profiles](https://docs.paloaltonetworks.com/network-security/ipsec-vpn/administration/set-up-site-to-site-vpn/define-cryptographic-profiles/define-ike-crypto-profiles). Confirms supported DH, SHA and AES values and matching requirements.
[^8]: Palo Alto Networks, [Unable to establish IPsec tunnel because IKE Phase 1 is down](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA10g000000PP5sCAG&lang=en_US). Describes timeout as message 1 not reaching the peer, no peer response or a dropped response, with upstream policy as an example.
[^9]: Palo Alto Networks, [IPsec VPN error: Received notify type authentication_failed](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA14u0000004OPOCA2&lang=en_US). Locates PSK mismatch at authentication failure.
[^10]: Palo Alto Networks, [How to Troubleshoot IPsec VPN Tunnel Issues](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA14u000000wlFxCAI). Documents proposal and traffic-selector errors, packet capture and the PAN-OS 11.2 `ikemgr-ng.log` filename.
[^11]: Palo Alto Networks, [Configure Active/Passive HA](https://docs.paloaltonetworks.com/ngfw/help/12-2/configure-activepassive-ha-pan-os). Documents active/passive processing and that passive data interfaces can appear up but discard traffic.
[^12]: Palo Alto Networks, [VPN Failing with Error “Unknown ikev2 peer”](https://knowledgebase.paloaltonetworks.com/KCSArticleDetail?id=kA10g000000Cle5CAC&lang=en_US). Associates that log condition with IKE-version mismatch.
[^13]: Palo Alto Networks, [Configure Packet Buffer Protection](https://docs.paloaltonetworks.com/ngfw/administration/zone-protection-and-dos-protection/zone-defense/packet-buffer-protection/configure-packet-buffer-protection). Documents source-IP blocking behavior.

### Local evidence files

- [`Call_ONEBILL_VPN_DEBUG_CALL_RUNBOOK_2026-09-14.md`](./Call_ONEBILL_VPN_DEBUG_CALL_RUNBOOK_2026-09-14.md)
- [`ONEBILL_EXACT_SELECTOR_MIRROR_VALIDATION_2026-09-14.md`](./ONEBILL_EXACT_SELECTOR_MIRROR_VALIDATION_2026-09-14.md)
- [`ONEBILL_LEGACY_IKEV1_MAIN_MODE_CONTROL_TEST_2026-09-14.md`](./ONEBILL_LEGACY_IKEV1_MAIN_MODE_CONTROL_TEST_2026-09-14.md)
- [`1BILL_VPN_CONNECTIVITY_STATUS_2026-09-07.md`](./1bill-connectivity/1BILL_VPN_CONNECTIVITY_STATUS_2026-09-07.md)
- [`1LINK STANDARD Over The Internet  IKEv2 VPN TEMPLATE.docx`](./1LINK%20STANDARD%20Over%20The%20Internet%20%20IKEv2%20VPN%20TEMPLATE.docx)
- Original 2018 network standard: `/Users/khizer khan/Documents/Documents/1bill-offical-doc/1LINK DATA Network Standards_v2.1.docx`

