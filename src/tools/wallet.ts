import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { isAddress, parseEther } from 'viem'
import { formatPLM } from '@plumise/core'
import { getClient, getAccount, getAccountAddress } from '../client.js'

export function registerWalletTools(server: McpServer) {
  server.tool(
    'get_balance',
    'Get PLM balance of an address',
    { address: z.string().optional().describe('Address to check (default: own wallet)') },
    async ({ address }) => {
      const client = getClient()
      const target = address || getAccountAddress()
      if (!target) {
        return { content: [{ type: 'text', text: 'Address is required (no wallet configured)' }], isError: true }
      }
      if (!isAddress(target)) {
        return { content: [{ type: 'text', text: `Invalid address: ${target}` }], isError: true }
      }
      const balance = await client.publicClient.getBalance({ address: target as `0x${string}` })
      return {
        content: [{
          type: 'text',
          text: `Address: ${target}\nBalance: ${formatPLM(balance)} PLM (${balance} wei)`,
        }],
      }
    },
  )

  server.tool(
    'transfer',
    'Transfer PLM to another address',
    {
      to: z.string().describe('Recipient address'),
      amount: z.string().describe('Amount in PLM (e.g. "1.5")'),
    },
    async ({ to, amount }) => {
      if (!isAddress(to)) {
        return { content: [{ type: 'text', text: `Invalid address: ${to}` }], isError: true }
      }
      const client = getClient()
      if (!client.walletClient) {
        return { content: [{ type: 'text', text: 'Wallet client not available (no private key)' }], isError: true }
      }

      const value = parseEther(amount)
      const hash = await client.walletClient.sendTransaction({
        to: to as `0x${string}`,
        value,
        chain: client.chain,
        account: getAccount(),
      })

      const receipt = await client.publicClient.waitForTransactionReceipt({ hash })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: receipt.status === 'success' ? 'success' : 'reverted',
            hash,
            from: getAccount().address,
            to,
            amount: `${amount} PLM`,
            gasUsed: receipt.gasUsed.toString(),
            blockNumber: receipt.blockNumber.toString(),
          }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'get_nonce',
    'Get transaction count (nonce) for an address',
    { address: z.string().optional().describe('Address (default: own wallet)') },
    async ({ address }) => {
      const client = getClient()
      const target = (address || getAccountAddress()) as `0x${string}`
      if (!target) {
        return { content: [{ type: 'text', text: 'Address is required (no wallet configured)' }], isError: true }
      }
      const nonce = await client.publicClient.getTransactionCount({ address: target })
      return {
        content: [{ type: 'text', text: `Address: ${target}\nNonce: ${nonce}` }],
      }
    },
  )

  server.tool(
    'get_code',
    'Get bytecode at an address (check if contract)',
    { address: z.string().describe('Address to check') },
    async ({ address }) => {
      if (!isAddress(address)) {
        return { content: [{ type: 'text', text: `Invalid address: ${address}` }], isError: true }
      }
      const client = getClient()
      const code = await client.publicClient.getCode({ address: address as `0x${string}` })
      const isContract = code && code !== '0x'
      return {
        content: [{
          type: 'text',
          text: isContract
            ? `Address ${address} is a contract (${(code!.length - 2) / 2} bytes bytecode)`
            : `Address ${address} is an EOA (no contract code)`,
        }],
      }
    },
  )
}
