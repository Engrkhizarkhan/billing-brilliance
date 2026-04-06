# 1LINK Data Network Guidelines and Standards

**January 2023**  
**1LINK Networks Department**

---

## Table of Contents

1. [Introduction and Scope](#1-introduction-and-scope)
   - 1.1 [Objectives](#11-objectives)
   - 1.2 [Purpose](#12-purpose)
   - 1.3 [Scope](#13-scope)
2. [Data Network Standards](#2-data-network-standards)
   - 2.1 [Network Connectivity](#21-network-connectivity)
   - 2.2 [Last Mile Connectivity](#22-last-mile-connectivity)
   - 2.3 [Dual Network Connection](#23-dual-network-connection)
   - 2.4 [Communication Routing](#24-communication-routing)
   - 2.5 [Support IPSEC VPN](#25-support-ipsec-vpn)
   - 2.6 [Communication Interface](#26-communication-interface)

---

## 1. Introduction and Scope

### 1.1 Objectives

The objective of this document is to provide information to member banks / billing companies and other third parties which are required to establish secure and high available network connectivity with 1LINK. This document will also explain how to establish network connectivity with 1LINK using different media types, encryption and interfaces.

### 1.2 Purpose

The purpose of this document is to support the 1LINK's IT security policies and prevent unauthorized access to 1LINK information systems and network services. This document describes the data network standards on which 1LINK will communicate with the external entities.

### 1.3 Scope

This document applies to all entities that are connected or willing to connect with 1LINK. All the entities that are connected to 1LINK must conform to the standards mentioned in this document.

---

## 2. Data Network Standards

### 2.1 Network Connectivity

All member banks and other 3rd party companies that are required to establish network connectivity with 1LINK must ensure the following requirements:

- The last mile connectivity will be the responsibility of the bank / 3rd party
- At least dual connectivity will be ensured at 1LINK's Primary site and also at DR Site from different service providers **[At least dual with primary and dual with DR]**
- Media Type: P2P Fiber Layer 2 connections, MPLS Layer 2 connections, Internet
- Interface provided to 1LINK should be **Ethernet interface**
- Devices used to connect 1LINK using point to point WAN/Internet connections should be enabled with updated security IOS features. 1LINK has CISCO based router so the compatibility must be ensured by third parties.
- Support IPSec Encryption **AES-256** and hashing **SHA2 or SHA 256**
- Configure IKE Phase 1 with **Main Mode** to establish Security Association

> **Note:** Aggressive mode should be disabled (interface / global level) on all customer devices that connects with 1LINK network.

---

### 2.2 Last Mile Connectivity

Member banks and 3rd parties can use the services of their preferred network service providers. The ownership of last mile connectivity will always remain with member bank / 3rd parties and they are responsible to maintain and manage the last mile connectivity. 1LINK only provides router / switch ports for terminating the network connections on its network.

The following Service Providers have presence in the 1LINK Primary site and connectivity can be established in short time:

- PTCL
- Multinet
- Cybernet
- Wateen
- Mobilink / JAZZ
- Transworld
- Worldcall

---

### 2.3 Dual Network Connection

All Member Banks and Business Partners are required to establish **at least dual network connections** at each site:

- **1LINK Primary Site** – PTCL Datacenter (Karachi)
- **1LINK DR Site** – PTCL Datacenter (Lahore)

Both connections must be configured by member banks / business partners at their end in such a way that when primary connection fails, or communication gets halted, secondary connection should be activated automatically using the **Automatic Switchover** feature.

If the member bank / Business Partner want to establish more than two network connections, they should notify the 1LINK concerned team and verify the provisioning of port availability at 1LINK end. All the links can be established in a point-to-point mode.

#### Figure 1: 1LINK Network Infrastructure

```
                          ┌─────────────────┐
                          │  PTCL MPLS CLOUD│
                          └────────┬────────┘
                                   │
          ┌────────────────────────┴───────────────────────┐
          │                                                │
┌─────────┴──────────┐                       ┌────────────┴──────────┐
│ 1LINK PRIMARY SITE │                       │  1LINK DR SITE LAHORE │
│      KARACHI        │                       │                       │
└─────────┬──────────┘                       └────────────┬──────────┘
          │                                               │
          │          ┌──────────────────────┐             │
          └──────────┤    MEMBER BANKS      ├─────────────┘
                     │  Bank A  Bank B  Bank C
                     └──────────────────────┘
```

> **1LINK NETWORK INFRASTRUCTURE**

---

### 2.4 Communication Routing

In order to perform intercommunication routing between 1LINK and member banks / 3rd parties, **only static routing protocol is allowed**. No Dynamic routing protocol can perform intercommunication routing.

1LINK uses Dynamic Routing Protocol between 1LINK KHI and LHR site and Static protocol with member bank / 3rd parties to perform the automatic switchover in case of any (primary or secondary) communication link failure. The automatic switchover preference is configured based on **static route weight**.

---

### 2.5 Support IPSEC VPN

All member banks and other companies must support IPSEC VPN for secure and encrypted data transfer using International Cryptographic Standards:

- **Encryption:** AES-256 (Advanced Encryption Standard)
- **Hashing:** SHA 2 or SHA 256

#### Parameters for IPSec VPN over Internet

| Parameter | Value |
|-----------|-------|
| IKE Version | IKEv2 |
| Encryption | AES 256 |
| Hash | SHA 256 |
| DH Group | 19 |
| PFS | Enabled |

---

### 2.6 Communication Interface

All member banks and 3rd parties should provide **Ethernet interface** in order to terminate their connection on 1LINK's provided router/switch port.

#### 2.6.1 Wired Media

If member banks / 3rd parties want to establish the communication network via:

- Fiber point-to-point Layer 2 connection
- MPLS Layer 2 connection
- Internet circuit

For all wired media and internet connectivity, member bank / 3rd parties will be responsible to maintain and manage all their media related issues.

In case of communication problems, member banks and 3rd parties will be responsible to coordinate with their respective vendors for the resolution of the issue and restore the communication link on a priority basis.

#### 2.6.2 Restricted Media

> ⚠️ **Third Party Indoor and Outdoor Wireless media devices are NOT allowed.**

Wireless media types that are **strictly prohibited** from connecting with 1LINK Primary and DR site datacenters include:

- WIMAX
- Microwave units
- Any other wireless media

---

## Important Notes

1. Member banks / 3rd parties are responsible to filter any unwanted and malicious traffic generated from their side.

2. 1LINK reserves the right to terminate any connection without prior notice if any ambiguity from agreed terms and conditions is found.

3. ACL need to be properly implemented with restricted destinations and source and if possible with ports as well at WAN devices.

4. Partner is responsible to upgrade its devices and its OS as well as per industry security standard or at least compatible to work with 1LINK devices.

5. Customer will take commercially reasonable measures to ensure that any Malware is not introduced into 1LINK network via their interface. They will continue to review, analyze, and implement improvements to and upgrades of their Malware prevention and correction programs and processes that are commercially reasonable and consistent with current information technology industry's standards. If Malware is found, customer shall promptly notify 1LINK and use commercially reasonable measures / efforts and diligently work to remedy the effects of the Malware. If any Malware will be introduced as a result of breach from customer side, 1LINK shall have the right to unilaterally disable connectivity and any remediation efforts shall be at customer expense.

6. Public IPs for server's connectivity are strictly restricted, and customers are required to provide only **private IP segments** for their server communication with 1LINK services.

7. In case of any problems related to third party's equipment (e.g., power related issues, device related issues, overheating and/or unstructured cabling), 1LINK will immediately cutoff / shutoff the network connection / devices of the respective member bank/utility company or any third party without giving prior notice.

---

*Document Classification: Confidential*  
*© 1LINK (Pvt) Limited*
