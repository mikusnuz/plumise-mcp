/**
 * Network Resource
 *
 * Exposes plumise://network as an MCP resource that returns
 * network-wide statistics from the Plumise blockchain.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RpcClient } from "../services/rpc-client.js";
import type { PlumiseConfig } from "../config.js";

export function registerNetworkResource(
  server: McpServer,
  rpcClient: RpcClient,
  config: PlumiseConfig
): void {
  server.resource(
    "network",
    "plumise://network",
    {
      description:
        "Plumise network statistics including total agents, active agents, " +
        "challenges solved, rewards distributed, and current block number.",
      mimeType: "application/json",
    },
    async () => {
      try {
        const [networkStats, blockNumberHex, chainIdHex, gasPriceHex] =
          await Promise.all([
            rpcClient.agentGetNetworkStats(),
            rpcClient.getBlockNumber(),
            rpcClient.getChainId(),
            rpcClient.getGasPrice(),
          ]);

        const blockNumber = parseInt(blockNumberHex, 16);
        const chainId = parseInt(chainIdHex, 16);
        const gasPrice = BigInt(gasPriceHex);

        return {
          contents: [
            {
              uri: "plumise://network",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  chainId,
                  nodeUrl: config.nodeUrl,
                  blockNumber,
                  gasPriceGwei: Number(gasPrice) / 1e9,
                  agents: {
                    total: networkStats.totalAgents,
                    active: networkStats.activeAgents,
                  },
                  challenges: {
                    totalSolved: networkStats.totalChallengesSolved,
                  },
                  rewards: {
                    totalDistributed: networkStats.totalRewardsDistributed,
                  },
                  networkHashrate: networkStats.networkHashrate,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        return {
          contents: [
            {
              uri: "plumise://network",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  chainId: config.chainId,
                  nodeUrl: config.nodeUrl,
                  error: msg,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    }
  );
}
