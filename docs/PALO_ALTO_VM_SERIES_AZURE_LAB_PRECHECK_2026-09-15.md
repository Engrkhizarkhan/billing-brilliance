# Palo Alto VM-Series Azure Lab Precheck — 2026-09-15

## Outcome

The proposed Palo Alto VM-Series control lab was configured in the Azure Portal up to the final validation stage, but Azure rejected the deployment before creating any resources.

The blocking validation result was:

- Subscription: `Azure for Students`
- Marketplace publisher: `paloaltonetworks`
- Offer: `vmseries-flex`
- Plan: `bundle1-gen2` (PAYG Bundle 1)
- Azure error: the subscription's payment instrument is not supported for paid Marketplace offers; Azure requires another eligible subscription or an upgrade/change to its billing method.

No Palo Alto VM, public IP, virtual network, or billable Marketplace resource was deployed.

## Prepared isolated design

All resources were planned under a disposable resource group:

- Resource group: `rg-onebill-paloalto-lab`
- Region: East Asia
- Firewall VM: `paonebilllab`
- PAN-OS image: 12.1.405
- License: PAYG Bundle 1
- VM size: `Standard_D8_v3` (8 vCPU, 32 GiB)
- Management username: `panadmin`
- Authentication: existing SSH public key
- Architecture: management + public/untrust + private/trust
- Virtual network: `vnet-onebill-paloalto-lab` (`10.95.0.0/16`)
- Management subnet: `10.95.0.0/24`
- Public/untrust subnet: `10.95.1.0/24`
- Private/trust subnet: `10.95.8.0/24`
- Management ingress source: `103.18.15.132/32` (operator public IP at validation time)
- Intended IKE peer source: `178.238.236.126`
- Intended protected test host: `10.95.8.92/32`

Azure showed approximately USD 385.44/month for the `Standard_D8_v3` compute instance if left running continuously. This estimate excluded Palo Alto software charges. Billing would be hourly for a short-lived deployment.

The smaller `Standard_D3_v2` (4 vCPU, 14 GiB) was considered because Palo Alto documents it as supporting three interfaces, but Azure reported it as unavailable in East Asia for this subscription. `Standard_D4_v3` was not selected because Azure limits it to two NICs, while this topology requires management, public/untrust, and private/trust interfaces.

## VPN parameters to apply after deployment

### Current IKEv2 control

- IKE version: IKEv2 only
- Encryption: AES-256-CBC
- Integrity/authentication: SHA-256
- PRF: HMAC-SHA-256 (`PRF 256`)
- DH group: 19
- IKE lifetime: 28,800 seconds
- IPsec encryption: AES-256-CBC
- IPsec integrity: SHA-256
- PFS group: 19
- Local protected selector: `10.95.8.92/32`
- Remote protected selector: `172.31.254.10/32`
- DPD/liveness: disabled for the mirror test

### Legacy comparison

- IKE version: IKEv1
- Exchange: Main Mode
- Use the legacy document's remaining AES-256/SHA-256/DH and lifetime parameters
- DPD: disabled for the mirror test

`PRF 256` is the HMAC-SHA-256 pseudo-random function used during IKE key derivation. It is a Phase 1 setting and is distinct from Phase 2 PFS group 19. Disabling DPD/liveness normally does not prevent the initial IKE Security Association from forming; it changes dead-peer detection after negotiation.

## Required next action

Use an Azure Pay-As-You-Go or other subscription that permits paid Marketplace purchases, with a valid billing method. Alternatively, obtain a Palo Alto BYOL/evaluation authorization code and deploy the BYOL plan. The deployment can then be resumed with this design and deleted afterward by deleting `rg-onebill-paloalto-lab`.

Official references:

- [Deploy VM-Series from the Azure Marketplace](https://docs.paloaltonetworks.com/vm-series/deployment/public-cloud/set-up-the-vm-series-firewall-on-azure/deploy-the-vm-series-firewall-on-azure-solution-template)
- [PAN-OS 12.1 VM-Series Azure models and VM sizes](https://docs.paloaltonetworks.com/vm-series/getting-started/vm-series-performance/vm-series-on-azure-models-and-vms/vm-series-on-azure-models-and-vms-12-1)
- [Azure Dv3 size network-interface limits](https://learn.microsoft.com/azure/virtual-machines/sizes/general-purpose/dv3-series)
