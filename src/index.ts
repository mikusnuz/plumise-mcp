#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { loadConfig } from './config.js'
import { initClient, getClient, getAccount } from './client.js'
import { registerChainTools } from './tools/chain.js'
import { registerWalletTools } from './tools/wallet.js'
import { registerAgentTools } from './tools/agent.js'
import { registerRewardTools } from './tools/reward.js'
import { registerInferenceTools } from './tools/inference.js'
import { registerPaymentTools } from './tools/payment.js'
import { registerNetworkResource } from './resources/network.js'
import { registerWalletResource } from './resources/wallet.js'

const server = new McpServer(
  { name: 'plumise-mcp', version: '2.0.0' },
  { capabilities: { tools: {}, resources: {} } },
)

// ─── Lazy init on first tool/resource call ───────────────────────────
let initialized = false
function ensureInit() {
  if (initialized) return
  const config = loadConfig()
  if (!config.privateKey) {
    throw new Error('PLUMISE_PRIVATE_KEY is required')
  }
  initClient(config)
  initialized = true
}

// Wrap tool registrations to lazy-init
const config = loadConfig()

// ─── Tools ───────────────────────────────────────────────────────────
// Chain: get_block, get_transaction, get_transaction_receipt, get_block_number, get_gas_price, get_chain_info, get_logs
registerChainTools(server)

// Wallet: get_balance, transfer, get_nonce, get_code
registerWalletTools(server)

// Agent: agent_status, agent_list, network_stats
registerAgentTools(server)

// Reward: pending_reward, claim_reward, reward_history, epoch_info, contribution
registerRewardTools(server)

// Inference (consumer): inference, model_status
registerInferenceTools(server, config)

// Payment: inference_balance, inference_deposit, inference_withdraw, estimate_cost
registerPaymentTools(server)

// ─── Resources ───────────────────────────────────────────────────────
registerNetworkResource(server)
registerWalletResource(server)

// ─── Prompts ─────────────────────────────────────────────────────────
server.prompt(
  'network_status',
  'Check Plumise network health and statistics',
  async () => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: 'Please check the Plumise network status. Use get_chain_info for chain details and network_stats for agent statistics. Summarize the network health.',
      },
    }],
  }),
)

server.prompt(
  'wallet_overview',
  'Get a comprehensive wallet overview',
  async () => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: 'Please check my wallet. Use get_balance for PLM balance, pending_reward for unclaimed rewards, and inference_balance for inference credits. Give me a complete financial overview.',
      },
    }],
  }),
)

// ─── Start ───────────────────────────────────────────────────────────
async function main() {
  // Validate config early
  ensureInit()
  console.error(`plumise-mcp v2.0.0 started (${config.network}, wallet: ${getAccount().address})`)

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('Fatal:', err)
  process.exit(1)
})
