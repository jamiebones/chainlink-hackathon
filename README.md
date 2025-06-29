# 🪐 psiX – Private Synthetic Equities & Perpetual DEX
![License](https://img.shields.io/github/license/your-org/psiX)
![Build](https://img.shields.io/github/actions/workflow/status/your-org/psiX/ci.yml)
![Chainlink Hackathon](https://img.shields.io/badge/Chainlink-Hackathon-2025-blue)

> **Where synthetic stocks meet stealth trading.**  
> Mint sTSLA & sAAPL, provide USDC liquidity, and trade perps in **public** or **fully private** mode — powered by Chainlink CCIP, Shutter encryption, and zkSNARK-verified liquidations.

---

## 🚀 Overview
psiX lets anyone:

1. **Mint synthetic equities** (sTSLA, sAAPL) with 110 % USDC collateral.  
2. **Trade perpetual futures** on the same assets (plus ETH & BTC) via our custom **PerpEngine**.  
3. Choose **Public Mode** (gas-efficient, transparent) or **Private Mode** (commit-reveal + zk proofs).  
4. Earn yield by **providing USDC liquidity** to back leveraged traders.

Deployed on Avalanche Fuji; cross-chain minting from Sepolia via Chainlink CCIP.

---

## ✨ Core Features
| 📌 Module         | What it does                                                              | Key Contracts |
|-------------------|---------------------------------------------------------------------------|---------------|
| **Vault**         | Mints/burns sEquity, routes 1× hedge, holds 10 % funding buffer           | `Vault.sol`   |
| **PerpEngine**    | Long/short perps, funding, liquidations, oracle checks                    | `PerpEngine.sol` |
| **LiquidityPool** | USDC pool for PerpEngine PnL & LP rewards                                 | `LiquidityPool.sol` |
| **Privacy Layer** | Shutter encrypted commit-reveal, batch-bot netting, zk liquidation proofs | `BatchBot.ts`, `PerpEngineZK.verifier` |
| **CCIP Bridge**   | Cross-chain mint/redeem (Sepolia ⇄ Fuji)                                  | `openPositionViaCCIP()` |

---

## 🛠 Technical Stack
- **Smart Contracts:** Solidity 0.8.x, Foundry tests  
- **Backend / Bots:** TypeScript, Node 22, Shutter keyper set, Chainlink Functions  
- **Frontend:** Next.js 18, Tailwind CSS, wagmi, viem  
- **Infra:** Hardhat devnet, Dockerised Shutter, CCIP Router, Avalanche Subnet (future)  
- **ZK:** snarkjs + circom 2 for liquidation proofs  

---

## 🏗 Architecture
_Embed a high-level system diagram here → `docs/architecture.png`_

---

## 🔄 User Workflows & Flow-Charts

<details open><summary><strong>1 – Mint & Redeem</strong></summary>

~~~mermaid
sequenceDiagram
    autonumber
    actor User
    participant Vault
    participant PerpEngine
    participant Buffer

    User->>Vault: mint(110 USDC)
    Vault->>PerpEngine: openHedge(100 USDC long)
    Vault->>Buffer: hold 10 USDC
    Vault-->>User: sTSLA / sAAPL

    User->>Vault: redeem()
    Vault->>PerpEngine: closeHedge()
    Vault-->>User: 110 USDC ± funding
~~~
</details>

<details><summary><strong>2 – Add / Withdraw Liquidity</strong></summary>

~~~mermaid
sequenceDiagram
    autonumber
    actor LP as Liquidity Provider
    participant LiquidityPool
    participant PerpEngine

    LP->>LiquidityPool: deposit(USDC)
    LiquidityPool-->>LP: mint LP tokens
    PerpEngine-->>LiquidityPool: settle fees + funding
    LP->>LiquidityPool: withdraw()
    LiquidityPool-->>LP: USDC + rewards
~~~
</details>

<details><summary><strong>3 – Public Perp Trading</strong></summary>

~~~mermaid
sequenceDiagram
    autonumber
    participant Trader
    participant PerpEngine
    participant Oracle

    Trader->>PerpEngine: openPosition(size, dir)
    loop Funding
        Oracle-->>PerpEngine: price
        PerpEngine-->>Trader: funding PnL
    end
    Trader->>PerpEngine: reduce / close
~~~
</details>

<details><summary><strong>4 – Private Perp Trading</strong></summary>

~~~mermaid
sequenceDiagram
    autonumber
    participant Trader
    participant Shutter
    participant BatchBot
    participant PerpEngine
    participant Verifier

    Trader->>Shutter: encrypt(order)
    Shutter-->>Trader: commitHash
    Trader->>BatchBot: submit commit
    BatchBot->>PerpEngine: net Δ settle
    BatchBot->>Verifier: zkProof
    Verifier-->>PerpEngine: verify OK
~~~
</details>

---

## 📝 Quick User Guides
<details><summary><strong>Mint & Redeem</strong></summary>

- **Mint:** Connect wallet → “Mint” → deposit ≥110 % collateral → confirm.  
- **Redeem:** Click “Redeem” → select amount → burn sEquity → receive USDC.

</details>

<details><summary><strong>Public Perp Trade</strong></summary>

1. Choose asset, size, direction.  
2. Confirm (`openPosition` / `increase` / `reduce`).  
3. Funding accrues; close anytime.

</details>

<details><summary><strong>Private Perp Trade</strong></summary>

1. Toggle “Private”.  
2. Sign encrypted commit (Shutter).  
3. BatchBot settles; zk proof verifies; UI shows fill.

</details>

<details><summary><strong>Add / Withdraw Liquidity</strong></summary>

Deposit USDC → receive LP tokens → earn fees & funding share → withdraw anytime.

</details>

---

## 📂 Repository Structure
~~~text
├─ contracts/            # Solidity sources
│  ├─ Vault.sol
│  ├─ PerpEngine.sol
│  └─ …
├─ frontend/             # Next.js app
│  ├─ components/
│  └─ pages/
├─ bots/                 # BatchBot, Keeper scripts
├─ scripts/              # Deploy & upgrade helpers
├─ docs/                 # Architecture & flow-chart images
└─ README.md
~~~

---

## ⚙️ Getting Started

### Prerequisites
| Tool | Version |
|------|---------|
| Node | ≥ 22 |
| pnpm | ≥ 9.14 |
| Foundry | nightly |
| Docker | for Shutter dev-net |

### 1 — Clone & Install
~~~bash
git clone https://github.com/your-org/psiX.git
cd psiX
pnpm install
~~~

### 2 — Environment
Copy `.env.example`, then fill:
~~~dotenv
RPC_URL_FUJI=
RPC_URL_SEPOLIA=
PRIVATE_KEY=
SHUTTER_RPC=
CCIP_ROUTER=
~~~

### 3 — Local dev-chain
~~~bash
pnpm dev
~~~

### 4 — Run tests
~~~bash
forge test -vv
~~~

---

## 🔗 Contracts & Addresses (Fuji)
| Contract      | Address                                      | Source    |
|---------------|----------------------------------------------|-----------|
| Vault         | `0x9005aA9B6C40369F6486856093C59aA0e8598D88` | Etherscan |
| PerpEngine    | `0xB9485C15cAF89Fb90be7CE14B336975F4FAE8D8f` | Etherscan |
| LiquidityPool | *TBD*                                        | —         |

---

## 🧩 Peg Maintenance
- Vault hedges 1× at mint → minimal delta.  
- KeeperBots arbitrage ±0.5 % peg drift.  
- 10 % buffer covers funding swings.

---

## 🔒 Privacy Mode Deep-Dive
1. Commit stored hashed.  
2. Shutter encrypts details; key revealed post-batch.  
3. BatchBot nets Δ → one PerpEngine tx.  
4. zkSNARK proves liquidation criteria without leaks.

---

## 🛡 Security Considerations
- Overflow-safe math; no unchecked external calls.  
- Role-based access for CCIP router & KeeperBots.  
- Foundry fuzz tests on funding, collateral, liquidations.  
- Audit before main-net.

---

## 🗺 Roadmap
- [x] MVP (sTSLA, sAAPL) on Fuji  
- [x] CCIP Sepolia bridge  
- [x] Private Mode beta  
- [ ] ETH/BTC perps (Q3 2025)  
- [ ] Avalanche Subnet deploy (Q4 2025)

---

## 🤝 Contributing
PRs welcome — run `pnpm lint && pnpm test` first.

---

## 👥 Team
| Name        | Role                              | X / LinkedIn |
|-------------|-----------------------------------|--------------|
| **Lakshya** | Protocol Design & Project Manager | [LinkedIn](https://www.linkedin.com/in/lakshya-jindal-gupta-1b8134220/) |
| **James**   | Smart Contract Developer          | [X](https://x.com/jamiescript) |
| **Rohith**  | PerpEngine & Risk                 | — |
| **Anushka** | ZK Circuits & Chainlink           | [LinkedIn](https://www.linkedin.com/in/anushka-somani1/) |
| **Keshav**  | Frontend                          | [LinkedIn](https://www.linkedin.com/in/keshav-bhotika-0807a61b8/) |

---

## 📄 License
MIT © 2025 psiX Labs
