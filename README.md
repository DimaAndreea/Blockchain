# PT SANZIANA (CITESTE !!!!!!)

## Chainlink VRF:

`
https://vrf.chain.link/
`

- te conectezi cu metamask, cu contul de pe care vrei sa dai deploy, NU local, ci unul de sepolia

- da create subscription

- completezi nume + mail optional - (https://sepolia.etherscan.io/tx/0xca3143117918098badb093d79f74f4615190673a4805a013faba34d39ebe06b1) - hash ul meu dupa ce am creat subscription ul

- dupa ce s a creat, trebuie sa dai fund subscription.

- *in caz ca nu ai bani, probabil nu ai. intra pe: https://faucets.chain.link/sepolia si iei de acolo. sa ai grija sa fii conectata pe contul de pe care vrei sa dai deploy - (https://sepolia.etherscan.io/tx/0x1b2e78bf48d4487a0969b2687d46cb83462242865bca79be4dd94081eb7428ba) hash ul meu

- ... TBD

## Infura:

`
https://developer.metamask.io/
`

- avem deja un api key de la lab2, deci il folosim pe acelasi.

- dupa ce te conectezi pe infura (probabil cu metamask, depinde cu ce te ai conectat), o sa ti apara direct acolo my first key pe care o copiezi

- in /hardhat/.env pui ce ai tu.

  SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/da_paste_la_cheia_copiata_de_pe_infura



asadar, recapitulare:
fisierul hardhat//env trebuie sa arate asa:

`
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/pui_api_key_de_pe_infura
SEPOLIA_PRIVATE_KEY=cheia_privata_a_contului_de_pe_care_dai_deploy

SEPOLIA_SUBSCRIPTION_ID=dupa_ce_dai_create_subscription_o_sa_iti_apara_acest_id_pe_chainlink_vrf
SEPOLIA_VRF_COORDINATOR=din_pagina_principala_de_chainlink_vrf
SEPOLIA_VRF_KEYHASH=din_pagina_principala_de_chainlink_vrf             
`

---

# OUTDATED

pasii pt a rula proiectul: 

1. intr un terminal, du te in loterie-vrf/hardhat si ruleaza:

`
npx hardhat node
`

2. deschide alt terminal, du te tot in loterie-vrf/hardhat si ruleaza:

`
npx hardhat run scripts/deploy-hh3.ts --network localhost
`

o sa ai un output de genul:

`
Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
Lottery deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
RandomnessProvider deployed to: 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512
Provider set in Lottery ✅
Ticket price: 10000000000000000
`

3. te duci in loterie-vrf/frontend/src/contracts in addresses.json si inlocuiesti valorile de acolo cu 2 chestii din output-ul de mai sus.

addresses.json:

`
"Lottery": "pui_valoarea_de_la_Lottery_deployed_to",
"RandomnessProvider": "pui_valoarea_de_la_RandomnessProvider_deployed_to"
`

4. in alt terminal, te duci in loterie-vrf/frontend si ruleaza:

`
npm run dev
`

gata

---


# On-chain Lottery (VRF-style) Web3 Application

This project implements an on-chain lottery system using Solidity smart contracts and a Web3 frontend application. The lottery uses a VRF-style Randomness Provider (oracle pattern) to generate verifiable random numbers and prevent manipulation.

---

## Technologies used

- Solidity 0.8.x
- Hardhat
- ethers.js
- React + Vite
- MetaMask
- Node.js

---

## Running the application

### 1. Start local blockchain

From the hardhat folder:
```
cd loterie-vrf/hardhat
```

```
npx hardhat node
```

This starts a local blockchain on:
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337

Hardhat will display multiple funded accounts. Account #0 is the contract owner.

---

### 2. Deploy smart contracts

From the same hardhat folder:

npx tsx scripts/deploy-hh3.ts

At the end, the terminal will display the deployed contract addresses:

Lottery deployed to: 0x...
RandomnessProvider deployed to: 0x...

Copy these addresses into the frontend configuration file:

frontend/src/contracts/addresses.json

{
  "Lottery": "0x...",
  "RandomnessProvider": "0x..."
}

---

### 3. MetaMask configuration

- Add a custom network:
  - RPC URL: http://127.0.0.1:8545
  - Chain ID: 31337
  - Currency symbol: ETH

- Import one or more Hardhat accounts into MetaMask using the private keys shown by hardhat node

Account #0 is the owner and can request draws. Other accounts act as players.

---

### 4. Start frontend

From the frontend folder:
```
cd loterie-vrf/frontend
```

```
npm install
```

```
npm run dev
```

Open the application in the browser at:

http://localhost:5173

---

## Usage flow

1. Connect MetaMask using a Hardhat account
2. Buy a lottery ticket by sending the ticket price
3. The owner account requests a draw
4. Simulate VRF randomness delivery using the backend script
5. The winner is selected on-chain
6. The winning account withdraws the prize
7. The lottery resets for a new round

---

## Deliver randomness (VRF-style simulation)

From the hardhat folder:

cd loterie-vrf/hardhat
npx tsx scripts/deliver-random.ts

This simulates an oracle delivering a random number to the lottery contract.

---

## Event handling (Observer Pattern)

The frontend listens to the following smart contract events and updates the UI in real time:

- TicketBought
- DrawRequested
- WinnerSelected
- PrizeWithdrawn

---

## Automated tests

From the hardhat folder:

cd loterie-vrf/hardhat
npx hardhat test

Tests cover:
- Ticket purchase logic
- Access control (owner and provider)
- Randomness delivery
- Prize withdrawal
- State reset after payout

---

## Project requirements coverage

- Solidity data types, mappings and addresses
- Events and modifiers
- ETH transfers and withdrawal pattern
- Inter-contract communication
- VRF / oracle-based randomness
- Automated testing
- Web3 frontend interaction
- Event-driven UI (Observer Pattern)

---

## Author

Blockchain Web3 project implemented for academic purposes.
