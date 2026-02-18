import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { formatEther, formatGwei, type Block, type Transaction, type TransactionReceipt } from 'viem'
import { getClient } from '../client.js'

export function registerChainTools(server: McpServer) {
  server.tool(
    'get_block',
    'Get block information by number or "latest"',
    { block: z.string().default('latest').describe('Block number or "latest"') },
    async ({ block }) => {
      const client = getClient()
      const blockParam = block === 'latest' ? undefined : BigInt(block)
      const data = await client.publicClient.getBlock(
        blockParam !== undefined ? { blockNumber: blockParam } : {}
      )
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formatBlock(data), null, 2),
        }],
      }
    },
  )

  server.tool(
    'get_transaction',
    'Get transaction details by hash',
    { hash: z.string().describe('Transaction hash (0x...)') },
    async ({ hash }) => {
      const client = getClient()
      const tx = await client.publicClient.getTransaction({ hash: hash as `0x${string}` })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formatTransaction(tx), null, 2),
        }],
      }
    },
  )

  server.tool(
    'get_transaction_receipt',
    'Get transaction receipt (status, gas used, logs)',
    { hash: z.string().describe('Transaction hash (0x...)') },
    async ({ hash }) => {
      const client = getClient()
      const receipt = await client.publicClient.getTransactionReceipt({ hash: hash as `0x${string}` })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formatReceipt(receipt), null, 2),
        }],
      }
    },
  )

  server.tool(
    'get_block_number',
    'Get the latest block number',
    {},
    async () => {
      const client = getClient()
      const blockNumber = await client.publicClient.getBlockNumber()
      return {
        content: [{ type: 'text', text: `Current block number: ${blockNumber}` }],
      }
    },
  )

  server.tool(
    'get_gas_price',
    'Get current gas price',
    {},
    async () => {
      const client = getClient()
      const gasPrice = await client.publicClient.getGasPrice()
      return {
        content: [{
          type: 'text',
          text: `Gas price: ${formatGwei(gasPrice)} gwei (${gasPrice} wei)`,
        }],
      }
    },
  )

  server.tool(
    'get_chain_info',
    'Get comprehensive chain information (block height, gas, chain ID)',
    {},
    async () => {
      const client = getClient()
      const [blockNumber, gasPrice, chainId] = await Promise.all([
        client.publicClient.getBlockNumber(),
        client.publicClient.getGasPrice(),
        client.publicClient.getChainId(),
      ])
      const block = await client.publicClient.getBlock()
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            network: client.network,
            chainId,
            blockNumber: blockNumber.toString(),
            gasPrice: `${formatGwei(gasPrice)} gwei`,
            latestBlock: {
              number: block.number?.toString(),
              hash: block.hash,
              timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
              transactionCount: block.transactions.length,
              gasUsed: block.gasUsed.toString(),
              gasLimit: block.gasLimit.toString(),
              miner: block.miner,
            },
          }, null, 2),
        }],
      }
    },
  )

  server.tool(
    'get_logs',
    'Get event logs filtered by address and/or block range',
    {
      address: z.string().optional().describe('Contract address to filter'),
      fromBlock: z.string().optional().describe('Start block number (default: latest - 1000)'),
      toBlock: z.string().optional().describe('End block number (default: latest)'),
    },
    async ({ address, fromBlock, toBlock }) => {
      const client = getClient()
      const latest = await client.publicClient.getBlockNumber()
      const logs = await client.publicClient.getLogs({
        ...(address ? { address: address as `0x${string}` } : {}),
        fromBlock: fromBlock ? BigInt(fromBlock) : latest - 1000n,
        toBlock: toBlock ? BigInt(toBlock) : latest,
      })
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            count: logs.length,
            logs: logs.slice(0, 50).map(log => ({
              address: log.address,
              blockNumber: log.blockNumber?.toString(),
              transactionHash: log.transactionHash,
              topics: log.topics,
              data: log.data,
            })),
            ...(logs.length > 50 ? { note: `Showing first 50 of ${logs.length} logs` } : {}),
          }, null, 2),
        }],
      }
    },
  )
}

function formatBlock(block: Block) {
  return {
    number: block.number?.toString(),
    hash: block.hash,
    parentHash: block.parentHash,
    timestamp: new Date(Number(block.timestamp) * 1000).toISOString(),
    miner: block.miner,
    gasUsed: block.gasUsed.toString(),
    gasLimit: block.gasLimit.toString(),
    baseFeePerGas: block.baseFeePerGas ? formatGwei(block.baseFeePerGas) + ' gwei' : null,
    transactionCount: block.transactions.length,
    size: block.size?.toString(),
  }
}

function formatTransaction(tx: Transaction) {
  return {
    hash: tx.hash,
    blockNumber: tx.blockNumber?.toString(),
    from: tx.from,
    to: tx.to,
    value: `${formatEther(tx.value)} PLM`,
    gasPrice: tx.gasPrice ? formatGwei(tx.gasPrice) + ' gwei' : null,
    gas: tx.gas.toString(),
    nonce: tx.nonce,
    type: tx.type,
    input: tx.input.length > 10 ? `${tx.input.slice(0, 10)}... (${(tx.input.length - 2) / 2} bytes)` : tx.input,
  }
}

function formatReceipt(receipt: TransactionReceipt) {
  return {
    transactionHash: receipt.transactionHash,
    blockNumber: receipt.blockNumber.toString(),
    from: receipt.from,
    to: receipt.to,
    status: receipt.status === 'success' ? 'success' : 'reverted',
    gasUsed: receipt.gasUsed.toString(),
    effectiveGasPrice: receipt.effectiveGasPrice ? formatGwei(receipt.effectiveGasPrice) + ' gwei' : null,
    contractAddress: receipt.contractAddress,
    logsCount: receipt.logs.length,
  }
}
