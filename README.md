**English** | [한국어](README.ko.md)

# plumise-mcp

[![npm version](https://img.shields.io/npm/v/plumise-mcp)](https://www.npmjs.com/package/plumise-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Badge](https://lobehub.com/badge/mcp/mikusnuz-plumise-mcp)](https://lobehub.com/mcp/mikusnuz-plumise-mcp)

MCP (Model Context Protocol) server for the [Plumise](https://plumise.com) blockchain. Exposes 24 tools covering chain queries, wallet operations, agent network, rewards, and AI inference — letting Claude and other MCP-compatible AI assistants interact directly with the chain.

## Requirements

- Node.js 18+
- A Plumise wallet private key

## Quick Start

### Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "plumise": {
      "command": "npx",
      "args": ["-y", "plumise-mcp"],
      "env": {
        "PLUMISE_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

### Run directly

```bash
PLUMISE_PRIVATE_KEY=0x... npx plumise-mcp
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `PLUMISE_PRIVATE_KEY` | Yes | Wallet private key |
| `PLUMISE_RPC_URL` | No | Custom RPC endpoint (overrides default) |
| `PLUMISE_NETWORK` | No | `mainnet` or `testnet` (default: `mainnet`) |
| `PLUMISE_INFERENCE_API_URL` | No | Custom inference API endpoint |

## Tools

### Chain (7)

| Tool | Description |
|---|---|
| `get_block` | Block info by number or `"latest"` |
| `get_transaction` | Transaction details by hash |
| `get_transaction_receipt` | Receipt with status, gas used, and logs |
| `get_block_number` | Latest block height |
| `get_gas_price` | Current gas price |
| `get_chain_info` | Comprehensive chain info (chainId, block, gas) |
| `get_logs` | Event logs filtered by address and block range |

### Wallet (4)

| Tool | Description |
|---|---|
| `get_balance` | PLM balance for any address |
| `transfer` | Send PLM to an address |
| `get_nonce` | Transaction count for an address |
| `get_code` | Check whether an address is a contract |

### Agent Network (3)

| Tool | Description |
|---|---|
| `agent_status` | Registration details for an agent address |
| `agent_list` | All active agents on the network |
| `network_stats` | Network-wide statistics |

### Rewards (5)

| Tool | Description |
|---|---|
| `pending_reward` | Unclaimed reward balance |
| `claim_reward` | Claim accumulated rewards |
| `reward_history` | Past claim events |
| `epoch_info` | Current epoch number and scoring weights |
| `contribution` | Agent contribution metrics (tasks, uptime, score) |

### Inference (2)

| Tool | Description |
|---|---|
| `inference` | Send an AI inference request |
| `model_status` | Available models and their status |

### Payment (4)

| Tool | Description |
|---|---|
| `inference_balance` | Credit balance and current tier |
| `inference_deposit` | Deposit PLM to purchase inference credits |
| `inference_withdraw` | Withdraw PLM from credit balance |
| `estimate_cost` | Estimate inference cost for a given input |

## Resources

MCP resources provide structured, readable context about the current state:

| Resource | Description |
|---|---|
| `plumise://network` | Network overview (chain info, active agents, epoch) |
| `plumise://wallet` | Wallet info (address, balance, nonce) |

## Prompts

Built-in prompt templates for common workflows:

| Prompt | Description |
|---|---|
| `network_status` | Run a full network health check |
| `wallet_overview` | Summarize wallet financials and pending rewards |

## Development

```bash
# Install dependencies
npm install

# Development mode (with tsx)
npm run dev

# Build
npm run build

# Run built version
npm start
```

## About Plumise

Plumise is an AI-native Layer 1 blockchain (chainId 41956) built as a geth fork. It introduces on-chain agent registration, inference payment settlement, and a reward system that incentivizes distributed AI inference nodes.

- **Chain**: Plumise Mainnet (chainId 41956)
- **Block reward**: 10 PLM/block, halving every ~4 years
- **Core library**: [`@plumise/core`](https://www.npmjs.com/package/@plumise/core) (viem-based)

## License

MIT
