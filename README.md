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
