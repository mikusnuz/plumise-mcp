import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { parseEther } from 'viem'
import { getInferencePayment, formatPLM, estimateInferenceCost } from '@plumise/core'
import { getClient, getAccount, getAccountAddress } from '../client.js'

export function registerPaymentTools(server: McpServer) {
  server.tool(
    'inference_balance',
    'Check inference credit balance and tier',
    { address: z.string().optional().describe('User address (default: own wallet)') },
    async ({ address }) => {
      const client = getClient()
      const target = (address || getAccountAddress()) as `0x${string}`
      if (!target) {
        return { content: [{ type: 'text', text: 'Address is required (no wallet configured)' }], isError: true }
      }
      const payment = getInferencePayment(client.publicClient, client.network)

      const credit = await payment.read.getUserCredit([target]) as {
        balance: bigint; usedCredits: bigint; lastDeposit: bigint; tier: bigint
      }

      const tierLabel = Number(credit.tier) >= 1 ? 'Pro' : 'Free'

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address: target,
            balance: formatPLM(credit.balance) + ' PLM',
            usedCredits: formatPLM(credit.usedCredits) + ' PLM',
            tier: tierLabel,
            lastDeposit: Number(credit.lastDeposit) > 0
              ? new Date(Number(credit.lastDeposit) * 1000).toISOString()
              : null,
          }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'inference_deposit',
    'Deposit PLM to inference payment contract for AI credits',
    { amount: z.string().describe('Amount in PLM to deposit') },
    async ({ amount }) => {
      const client = getClient()
      if (!client.walletClient) {
        return { content: [{ type: 'text', text: 'Wallet client not available' }], isError: true }
      }
      const payment = getInferencePayment(client.walletClient, client.network)
      const account = getAccount()

      const hash = await payment.write.deposit({ account, chain: client.chain, value: parseEther(amount) })
      const receipt = await client.publicClient.waitForTransactionReceipt({ hash })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: receipt.status === 'success' ? 'success' : 'reverted',
            deposited: amount + ' PLM',
            txHash: hash,
            blockNumber: receipt.blockNumber.toString(),
          }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'inference_withdraw',
    'Withdraw PLM from inference payment contract',
    { amount: z.string().describe('Amount in PLM to withdraw') },
    async ({ amount }) => {
      const client = getClient()
      if (!client.walletClient) {
        return { content: [{ type: 'text', text: 'Wallet client not available' }], isError: true }
      }
      const payment = getInferencePayment(client.walletClient, client.network)
      const account = getAccount()

      const hash = await payment.write.withdraw([parseEther(amount)], { account, chain: client.chain })
      const receipt = await client.publicClient.waitForTransactionReceipt({ hash })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: receipt.status === 'success' ? 'success' : 'reverted',
            withdrawn: amount + ' PLM',
            txHash: hash,
            blockNumber: receipt.blockNumber.toString(),
          }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'estimate_cost',
    'Estimate inference cost for a given token count',
    { tokens: z.number().describe('Number of tokens') },
    async ({ tokens }) => {
      const cost = estimateInferenceCost(tokens)
      return {
        content: [{
          type: 'text',
          text: `Estimated cost for ${tokens} tokens: ${formatPLM(cost)} PLM`,
        }],
      }
    },
  )
}
