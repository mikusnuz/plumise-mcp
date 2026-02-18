import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { formatGwei } from 'viem'
import { getAgentRegistry } from '@plumise/core'
import { getClient } from '../client.js'

export function registerNetworkResource(server: McpServer) {
  server.resource(
    'network',
    'plumise://network',
    { description: 'Plumise network status overview' },
    async () => {
      const client = getClient()
      const registry = getAgentRegistry(client.publicClient, client.network)

      const [blockNumber, gasPrice, chainId, totalAgents, activeAgents] = await Promise.all([
        client.publicClient.getBlockNumber(),
        client.publicClient.getGasPrice(),
        client.publicClient.getChainId(),
        registry.read.getTotalAgentCount() as Promise<bigint>,
        registry.read.getActiveAgentCount() as Promise<bigint>,
      ])

      return {
        contents: [{
          uri: 'plumise://network',
          mimeType: 'application/json',
          text: JSON.stringify({
            network: client.network,
            chainId,
            blockNumber: blockNumber.toString(),
            gasPrice: formatGwei(gasPrice) + ' gwei',
            agents: {
              total: totalAgents.toString(),
              active: activeAgents.toString(),
            },
          }, null, 2),
        }],
      }
    },
  )
}
