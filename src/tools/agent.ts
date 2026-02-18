import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { isAddress } from 'viem'
import { getAgentRegistry, formatPLM } from '@plumise/core'
import { getClient } from '../client.js'

export function registerAgentTools(server: McpServer) {
  server.tool(
    'agent_status',
    'Get detailed status of a registered agent',
    { address: z.string().describe('Agent wallet address') },
    async ({ address }) => {
      if (!isAddress(address)) {
        return { content: [{ type: 'text', text: `Invalid address: ${address}` }], isError: true }
      }
      const client = getClient()
      const registry = getAgentRegistry(client.publicClient, client.network)

      const [agent, active] = await Promise.all([
        registry.read.getAgent([address as `0x${string}`]),
        registry.read.isActive([address as `0x${string}`]),
      ])

      const a = agent as { wallet: string; nodeId: string; metadata: string; registeredAt: bigint; lastHeartbeat: bigint; status: number; stake: bigint }
      const statusLabel = ['ACTIVE', 'INACTIVE', 'SLASHED'][Number(a.status)] || 'UNKNOWN'
      const lastHb = Number(a.lastHeartbeat)
      const regAt = Number(a.registeredAt)
      const now = Math.floor(Date.now() / 1000)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address,
            registered: regAt > 0,
            status: statusLabel,
            isActive: active,
            registeredAt: regAt > 0 ? new Date(regAt * 1000).toISOString() : null,
            lastHeartbeat: lastHb > 0 ? new Date(lastHb * 1000).toISOString() : null,
            secondsSinceHeartbeat: lastHb > 0 ? now - lastHb : null,
            stake: formatPLM(a.stake) + ' PLM',
            metadata: a.metadata || null,
            nodeId: a.nodeId,
          }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'agent_list',
    'List all active agents on the network',
    {},
    async () => {
      const client = getClient()
      const registry = getAgentRegistry(client.publicClient, client.network)

      const [activeAgents, totalCount, activeCount] = await Promise.all([
        registry.read.getActiveAgents(),
        registry.read.getTotalAgentCount(),
        registry.read.getActiveAgentCount(),
      ])

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            totalRegistered: (totalCount as bigint).toString(),
            activeCount: (activeCount as bigint).toString(),
            activeAgents,
          }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'network_stats',
    'Get Plumise network statistics (agents, challenges, rewards)',
    {},
    async () => {
      const client = getClient()
      const registry = getAgentRegistry(client.publicClient, client.network)

      const [blockNumber, gasPrice, chainId, totalAgents, activeAgents] = await Promise.all([
        client.publicClient.getBlockNumber(),
        client.publicClient.getGasPrice(),
        client.publicClient.getChainId(),
        registry.read.getTotalAgentCount(),
        registry.read.getActiveAgentCount(),
      ])

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            network: client.network,
            chainId,
            blockNumber: blockNumber.toString(),
            gasPrice: `${(Number(gasPrice) / 1e9).toFixed(6)} gwei`,
            agents: {
              total: (totalAgents as bigint).toString(),
              active: (activeAgents as bigint).toString(),
            },
          }, null, 2),
        }],
      }
    },
  )
}
