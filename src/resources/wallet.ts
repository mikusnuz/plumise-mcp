import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { formatPLM } from '@plumise/core'
import { getClient, getAccount } from '../client.js'

export function registerWalletResource(server: McpServer) {
  server.resource(
    'wallet',
    'plumise://wallet',
    { description: 'Current wallet address and PLM balance' },
    async () => {
      const client = getClient()
      const address = getAccount().address
      const balance = await client.publicClient.getBalance({ address })

      return {
        contents: [{
          uri: 'plumise://wallet',
          mimeType: 'application/json',
          text: JSON.stringify({
            address,
            balance: formatPLM(balance) + ' PLM',
            balanceWei: balance.toString(),
          }, null, 2),
        }],
      }
    },
  )
}
