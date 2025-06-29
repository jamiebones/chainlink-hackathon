# ψ psiX – Private Synthetic Equities & Perpetual DEX

> **Where synthetic stocks meet stealth trading.**  
> Mint sTSLA & sAAPL, provide USDC liquidity, and trade perps in **public** or **fully private** mode — powered by Chainlink CCIP, HPKE encryption, and zkSNARK-verified liquidations.

---

## 🚀 Overview
psiX lets anyone:

1. **Mint synthetic equities** (sTSLA, sAAPL) with 110 % USDC collateral with a 10% buffer.  
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
| **Privacy Layer** | HPKE-encrypted commit-reveal, BatchBot netting, zk liquidation proofs     | `BatchBot.ts`, `PerpEngineZK.verifier` |
| **CCIP Bridge**   | Cross-chain mint/redeem (Sepolia ⇄ Fuji)                                   | `openPositionViaCCIP()` |

---

## 🛠 Technical Stack
- **Smart Contracts:** Solidity 0.8.x, Foundry tests  
- **Backend / Bots:** TypeScript, Node 22, BatchBot, Poseidon HPKE service, Chainlink Functions  
- **Frontend:** Next.js 18, Tailwind CSS, wagmi, viem  
- **Infra:** Hardhat devnet, Dockerised Poseidon, CCIP Router, Avalanche Subnet (future)  
- **ZK:** snarkjs + circom 2 for liquidation proofs  

---

## 🏗 Architecture
![Architecture Diagram](https://github.com/jamiebones/chainlink-hackathon/blob/main/psiX_architecture.webp)

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
    participant Wallet
    participant BatchBot
    participant Poseidon
    participant PerpEngine
    participant Verifier

    Trader->>Wallet: encOpenOrder + sig (HPKE)
    Wallet->>BatchBot: submit commit
    BatchBot->>Poseidon: decrypt & verify
    Poseidon->>Poseidon: insert / update leaf
    Poseidon->>PerpEngine: tradeNet(±Δ)
    BatchBot->>Verifier: zkProof
    Verifier-->>PerpEngine: verify OK
~~~
</details>

---

## 📝 Quick User Guides
<details><summary><strong>Mint & Redeem</strong></summary>

- **Mint:** Connect wallet → “Mint” → deposit ≥ 110 % collateral → confirm.  
- **Redeem:** Click “Redeem” → select amount → burn sEquity → receive USDC.

</details>

<details><summary><strong>Public Perp Trade</strong></summary>

1. Choose asset, size, direction.  
2. Confirm (`openPosition` / `increase` / `reduce`).  
3. Funding accrues; close anytime.

</details>

<details><summary><strong>Private Perp Trade</strong></summary>

1. Toggle “Private”.  
2. Deposit amount, then sign the encrypted commit with your burner wallet.  
3. BatchBot settles; zk proof verifies; UI shows fill.

</details>

<details><summary><strong>Add / Withdraw Liquidity</strong></summary>

Deposit USDC → receive LP tokens → earn fees & funding share → withdraw anytime.

</details>

---

## 📂 Repository Structure
~~~text
├─ contracts/            # Solidity sources
├─ frontend/             # Next.js app
├─ backend/executor      # BatchBot, Executor Bot
├─ backend/circuits      # ZK circuits
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
| Docker | for Poseidon dev-net |

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
CCIP_ROUTER=
POSEIDON_RPC=
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
| Contract      | Address                                      |
|---------------|----------------------------------------------|
| Vault         | `0xFeFf49844Cf2bd6c07806f86FcDeFE55786De8a4` |
| PerpEngine    | `0xC707f6C9625B97FD9a214953528dfd846c2b2dD7` |
| LiquidityPool | `0xD24FB6ebc087604af93D536B5A4562A0Dfa6Ab3a` |
| PerpEngineZk  | `0xf5aD2EC0a0c763127667D71952CC80078356153c` |
| SenderContract| `0x343d00b0c2fD67cA9dD1E34e2dA820F62f3f988F` |
| MarketStatusOracle| `0xD1690b54a55A58df4440EE56969E3420198747D1` |
| TslaPriceOralce| `0x70671A042B419B266d36212337eEC2A715Af603c` |
| ApplPriceOracle| `0x76e6bf0aE87215ac57fE7ba900fD59Bab5C94eED` |
| sTSLA | `0xffd0528B468E8820324dD27E71d68CC8d4F9Eb85` |
| sAPPL| `0xba52894c5319d2263bcaAbF609767c33b3A04993` |
| ReceiverContract(On sepolia)| `0xDbA42976c2139Ccc9450a5867bFEb214892b8d4D` |

---

## 🧩 Peg Maintenance
- Vault hedges 1× at mint → minimal delta.  
- KeeperBots arbitrage ± 0.5 % peg drift.  
- 10 % buffer covers funding swings.

---

## 🔒 Privacy Mode Deep-Dive
1. HPKE-encrypted commit signed with a burner wallet.  
2. BatchBot forwards to **Poseidon**, which decrypts, verifies, and updates the Merkle tree.  
3. Poseidon nets Δ and submits a single PerpEngine tx.  
4. zkSNARK proof verified on-chain; no trade details leaked.

---

## 🛡 Security Considerations
- Overflow-safe math; no unchecked external calls.  
- Role-based access for CCIP router & KeeperBots.  
- Foundry fuzz tests on funding, collateral, and liquidations.  
- Audit before mainnet.

---

## 🗺️ Roadmap

### Completed ✅
- [x] **MVP Launch** - synthetic assets on Avalanche Fuji
- [x] **Fully-Functional Perpetuals on Fuji**   
- [x] **Cross-Chain Bridge** - CCIP integration with Ethereum Sepolia
- [x] **Private Mode Beta** - HPKE encryption + ZK proof batching + liquidation with ZK proofs

### **Q3 2025: Perpetuals** 🚀
- Expand beyond synthetic equities to crypto perpetuals
- Higher volume/liquidity crypto markets
- Leverage existing privacy infrastructure for BTC/ETH trading

### **Q4 2025: Security Improvements** ⛓️
- Custom Avalanche subnet for private trading
- Lower costs & higher throughput
- Enhanced privacy with custom consensus
  
---

## 🤝 Contributing
PRs welcome — run `pnpm lint && pnpm test` first.

---

## 👥 Team
| Name        | Role                              | X / LinkedIn |
|-------------|-----------------------------------|--------------|
| **Lakshya** | Protocol Design & Project Manager | [LinkedIn](https://www.linkedin.com/in/lakshya-jindal-gupta-1b8134220/) |
| **James**   | Smart Contract Developer          | [X](https://x.com/jamiescript) |
| **Rohith**  | PerpEngine & Risk                 | [LinkedIn](https://www.linkedin.com/in/rohithnarahari/) |
| **Anushka** | ZK Circuits & Chainlink           | [LinkedIn](https://www.linkedin.com/in/anushka-somani1/) |
| **Keshav**  | Frontend                          | [LinkedIn](https://www.linkedin.com/in/keshav-bhotika-0807a61b8/) |

---

## 📄 License
MIT © 2025 psiX Labs
