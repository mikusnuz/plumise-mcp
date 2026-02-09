/**
 * Node Resource
 *
 * Exposes plumise://node as an MCP resource that returns
 * the current agent node status including heartbeat info.
 */

import { ethers } from "ethers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RpcClient } from "../services/rpc-client.js";
import { HeartbeatService } from "../services/heartbeat.js";

export function registerNodeResource(
  server: McpServer,
  rpcClient: RpcClient,
  wallet: ethers.Wallet,
  heartbeat: HeartbeatService
): void {
  server.resource(
    "node",
    "plumise://node",
    {
      description:
        "Current agent node status including registration, uptime, " +
        "heartbeat state, challenges solved, and pending rewards.",
      mimeType: "application/json",
    },
    async () => {
      try {
        const status = await rpcClient.agentGetStatus(wallet.address);

        return {
          contents: [
            {
              uri: "plumise://node",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  agent: {
                    address: wallet.address,
                    registered: status.registered,
                    uptime: status.uptime,
                    lastHeartbeat: status.lastHeartbeat,
                    challengesSolved: status.challengesSolved,
                    pendingReward: status.pendingReward,
                  },
                  heartbeat: {
                    running: heartbeat.isRunning,
                    lastHeartbeat:
                      heartbeat.lastHeartbeat?.toISOString() ?? null,
                    totalHeartbeats: heartbeat.heartbeatCount,
                    lastError: heartbeat.lastError,
                  },
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
              uri: "plumise://node",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  agent: {
                    address: wallet.address,
                    registered: false,
                    error: msg,
                  },
                  heartbeat: {
                    running: heartbeat.isRunning,
                    lastHeartbeat:
                      heartbeat.lastHeartbeat?.toISOString() ?? null,
                    totalHeartbeats: heartbeat.heartbeatCount,
                    lastError: heartbeat.lastError,
                  },
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
