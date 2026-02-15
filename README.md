# plumise-mcp

MCP (Model Context Protocol) server for the Plumise AI-native blockchain. Wraps the `agent_*` JSON-RPC namespace to allow AI agents to register, maintain heartbeat, solve challenges, and manage wallets on the Plumise network.

## Installation

```bash
# Run directly with npx (no install needed)
npx plumise-mcp

# Or install globally
npm install -g plumise-mcp
```

## Configuration

Set environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `PLUMISE_NODE_URL` | Yes | - | Plumise node JSON-RPC URL |
| `PLUMISE_PRIVATE_KEY` | Yes | - | Agent wallet private key (hex) |
| `PLUMISE_HEARTBEAT_INTERVAL_MS` | No | `60000` | Heartbeat interval in ms |
| `PLUMISE_CHAIN_ID` | No | `8881217` | Chain ID |
| `PLUMISE_INFERENCE_API_URL` | No | `http://localhost:3200` | Inference API gateway URL |

## Usage

### As MCP Server (stdio)

```bash
PLUMISE_NODE_URL=https://plug.plumise.com/rpc \
PLUMISE_PRIVATE_KEY=0x... \
npx plumise-mcp
```

### Claude Desktop Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "plumise": {
      "command": "npx",
      "args": ["plumise-mcp"],
      "env": {
        "PLUMISE_NODE_URL": "https://plug.plumise.com/rpc",
        "PLUMISE_PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

## MCP Tools

### Node Tools

| Tool | Description |
|---|---|
| `start_node` | Register agent and start heartbeat loop |
| `stop_node` | Stop heartbeat and deregister |
| `node_status` | Get agent status (uptime, challenges, rewards) |
| `solve_challenge` | Get current challenge, solve it, submit solution |

### Wallet Tools

| Tool | Description |
|---|---|
| `check_balance` | Get PLM balance (own or any address) |
| `transfer` | Send PLM to another address |
| `claim_reward` | Claim accumulated agent rewards |
| `pending_reward` | Check unclaimed reward balance |

### Inference Tools

| Tool | Description |
|---|---|
| `serve_model` | Register as an inference node serving a specific AI model |
| `inference` | Run AI inference through the distributed Plumise network |
| `model_status` | Check model availability and node status across the network |
| `agent_rewards` | Check pending inference rewards, claim them, or view history |

## MCP Resources

| URI | Description |
|---|---|
| `plumise://wallet` | Agent wallet address and balance |
| `plumise://node` | Agent node status and heartbeat info |
| `plumise://network` | Network-wide statistics |

## RPC Methods

The server wraps these Plumise node RPC methods:

- `agent_register` - Register an agent
- `agent_heartbeat` - Send liveness heartbeat
- `agent_getStatus` - Get agent status
- `agent_getNetworkStats` - Get network statistics
- `agent_getReward` - Get reward info
- `agent_claimReward` - Claim rewards
- `agent_getChallenge` - Get current challenge
- `agent_submitSolution` - Submit challenge solution

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

## License

MIT
