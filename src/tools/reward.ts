import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { getRewardPool, formatPLM, addresses } from '@plumise/core'
import { getClient, getAccount, getAccountAddress } from '../client.js'

export function registerRewardTools(server: McpServer) {
  server.tool(
    'pending_reward',
    'Check pending (unclaimed) reward for an agent',
    { address: z.string().optional().describe('Agent address (default: own wallet)') },
    async ({ address }) => {
      const client = getClient()
      const target = (address || getAccountAddress()) as `0x${string}`
      if (!target) {
        return { content: [{ type: 'text', text: 'Address is required (no wallet configured)' }], isError: true }
      }
      const pool = getRewardPool(client.publicClient, client.network)

      const pending = await pool.read.getPendingReward([target]) as bigint
      return {
        content: [{
          type: 'text',
          text: `Agent: ${target}\nPending reward: ${formatPLM(pending)} PLM`,
        }],
      }
    },
  )

  server.tool(
    'claim_reward',
    'Claim accumulated agent rewards from RewardPool',
    {},
    async () => {
      const client = getClient()
      if (!client.walletClient) {
        return { content: [{ type: 'text', text: 'Wallet client not available' }], isError: true }
      }
      const account = getAccount()

      const readPool = getRewardPool(client.publicClient, client.network)
      const pending = await readPool.read.getPendingReward([account.address]) as bigint
      if (pending === 0n) {
        return { content: [{ type: 'text', text: 'No pending rewards to claim' }] }
      }

      const pool = getRewardPool(client.walletClient, client.network)
      const hash = await pool.write.claimReward({ account, chain: client.chain })
      const receipt = await client.publicClient.waitForTransactionReceipt({ hash })

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            status: receipt.status === 'success' ? 'success' : 'reverted',
            claimed: formatPLM(pending) + ' PLM',
            txHash: hash,
            blockNumber: receipt.blockNumber.toString(),
          }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'reward_history',
    'Get reward claim history for an agent',
    {
      address: z.string().optional().describe('Agent address (default: own wallet)'),
      limit: z.number().optional().default(20).describe('Max events to return'),
    },
    async ({ address, limit }) => {
      const client = getClient()
      const target = (address || getAccountAddress()) as `0x${string}`
      if (!target) {
        return { content: [{ type: 'text', text: 'Address is required (no wallet configured)' }], isError: true }
      }
      const addrs = client.network === 'testnet' ? addresses.testnet : addresses.mainnet

      const latest = await client.publicClient.getBlockNumber()
      const fromBlock = latest > 216000n ? latest - 216000n : 0n

      const logs = await client.publicClient.getLogs({
        address: addrs.RewardPool as `0x${string}`,
        event: {
          type: 'event',
          name: 'RewardClaimed',
          inputs: [
            { type: 'address', name: 'agent', indexed: true },
            { type: 'uint256', name: 'amount' },
            { type: 'uint256', name: 'epoch' },
          ],
        },
        args: { agent: target },
        fromBlock,
        toBlock: latest,
      })

      const events = logs.slice(-limit).reverse().map(log => ({
        blockNumber: log.blockNumber?.toString(),
        txHash: log.transactionHash,
        amount: log.args?.amount ? formatPLM(log.args.amount as bigint) + ' PLM' : 'unknown',
        epoch: log.args?.epoch?.toString(),
      }))

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ agent: target, totalEvents: logs.length, events }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'epoch_info',
    'Get current epoch information and reward weights',
    {},
    async () => {
      const client = getClient()
      const pool = getRewardPool(client.publicClient, client.network)

      const [epoch, tokenW, taskW, uptimeW, latencyW] = await Promise.all([
        pool.read.getCurrentEpoch() as Promise<bigint>,
        pool.read.tokenWeight() as Promise<bigint>,
        pool.read.taskWeight() as Promise<bigint>,
        pool.read.uptimeWeight() as Promise<bigint>,
        pool.read.latencyWeight() as Promise<bigint>,
      ])

      let epochReward = 0n
      try {
        epochReward = await pool.read.epochRewards([epoch]) as bigint
      } catch { /* may not be distributed yet */ }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            currentEpoch: epoch.toString(),
            epochReward: formatPLM(epochReward) + ' PLM',
            weights: {
              token: tokenW.toString(),
              task: taskW.toString(),
              uptime: uptimeW.toString(),
              latency: latencyW.toString(),
            },
          }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'contribution',
    'Get agent contribution metrics for reward calculation',
    { address: z.string().optional().describe('Agent address (default: own wallet)') },
    async ({ address }) => {
      const client = getClient()
      const target = (address || getAccountAddress()) as `0x${string}`
      if (!target) {
        return { content: [{ type: 'text', text: 'Address is required (no wallet configured)' }], isError: true }
      }
      const pool = getRewardPool(client.publicClient, client.network)

      const contrib = await pool.read.getContribution([target]) as {
        taskCount: bigint; uptimeSeconds: bigint; responseScore: bigint
        lastUpdated: bigint; processedTokens: bigint; avgLatencyInv: bigint
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            agent: target,
            processedTokens: contrib.processedTokens.toString(),
            taskCount: contrib.taskCount.toString(),
            uptimeSeconds: contrib.uptimeSeconds.toString(),
            responseScore: contrib.responseScore.toString(),
            avgLatencyInv: contrib.avgLatencyInv.toString(),
            lastUpdated: Number(contrib.lastUpdated) > 0
              ? new Date(Number(contrib.lastUpdated) * 1000).toISOString()
              : null,
          }, null, 2),
        }],
      }
    },
  )
}
