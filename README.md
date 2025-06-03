# Chainlink Hackathon Monorepo

A Turbo-powered monorepo containing a complete Web3 application stack with smart contracts, subgraph indexing, and a modern frontend.

## 🚀 Project Structure

```
chainlink-hackathon-monorepo/
├── contracts/          # Hardhat project for smart contracts
├── subgraph/          # The Graph protocol subgraph
├── frontend/          # Next.js frontend application
├── package.json       # Root package configuration
└── turbo.json        # Turbo build configuration
```

## 📦 What's Inside

This monorepo includes the following packages and applications:

- **`contracts`**: Hardhat-based smart contract development environment
- **`subgraph`**: The Graph protocol subgraph for indexing blockchain data
- **`frontend`**: Next.js application with TypeScript, Tailwind CSS, and modern tooling

## 🛠️ Development Setup

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Git

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

This will install dependencies for all workspace packages.

### Development Commands

- **`npm run dev`** - Start development servers for all applications
- **`npm run build`** - Build all applications for production
- **`npm run lint`** - Run linting across all packages
- **`npm run test`** - Run tests across all packages
- **`npm run clean`** - Clean build artifacts

## 🏗️ Individual Package Commands

### Contracts (Hardhat)

```bash
cd contracts
npm run compile    # Compile smart contracts
npm run test      # Run contract tests
npm run deploy    # Deploy contracts
npm run node      # Start local Hardhat node
```

### Subgraph (The Graph)

```bash
cd subgraph
npm run codegen        # Generate types from schema
npm run build         # Build the subgraph
npm run deploy-local  # Deploy to local Graph Node
```

### Frontend (Next.js)

```bash
cd frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

## 🔧 Configuration

### Turbo Configuration

The monorepo uses Turbo for efficient builds and caching. The configuration is in `turbo.json`:

- **Build pipeline**: Optimized dependency resolution and parallel execution
- **Caching**: Intelligent caching of build outputs
- **Development mode**: Hot reloading across all applications

### Workspace Configuration

Each package is configured as a workspace in the root `package.json`, enabling:

- Shared dependencies
- Cross-package imports
- Unified script execution

## 🚀 Getting Started

1. **Start the development environment**:
   ```bash
   npm run dev
   ```

2. **Deploy smart contracts** (in a new terminal):
   ```bash
   cd contracts
   npm run node      # Start local blockchain
   npm run deploy    # Deploy contracts
   ```

3. **Set up the subgraph** (in a new terminal):
   ```bash
   cd subgraph
   # Update subgraph.yaml with deployed contract address
   npm run codegen
   npm run build
   ```

4. **Access the applications**:
   - Frontend: http://localhost:3000
   - Hardhat Network: http://localhost:8545

## 📝 Development Workflow

1. **Smart Contract Development**: Write and test contracts in the `contracts/` directory
2. **Subgraph Development**: Update schema and mappings in `subgraph/` to index contract events
3. **Frontend Development**: Build the user interface in `frontend/` directory
4. **Integration**: Use Turbo commands to run and build all applications together

## 🧪 Testing

Run tests across all packages:

```bash
npm run test
```

Or test individual packages:

```bash
cd contracts && npm test
cd frontend && npm test
```

## 📚 Tech Stack

- **Monorepo**: Turbo
- **Smart Contracts**: Hardhat, Solidity
- **Indexing**: The Graph Protocol
- **Frontend**: Next.js, TypeScript, Tailwind CSS
- **Package Manager**: npm workspaces

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests and linting
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details. 