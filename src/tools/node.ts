/**
 * Node Tools
 *
 * MCP tools for managing the Plumise agent node lifecycle:
 * - start_node: Register agent and start heartbeat
 * - stop_node: Stop heartbeat and deregister
 * - node_status: Get current agent status
 * - solve_challenge: Get and attempt to solve a challenge
 */

import { z } from "zod";
import { keccak256, toBytes } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RpcClient } from "../services/rpc-client.js";
import { HeartbeatService } from "../services/heartbeat.js";

export interface NodeToolDeps {
  rpcClient: RpcClient;
  account: PrivateKeyAccount;
  heartbeat: HeartbeatService;
}

export function registerNodeTools(
  server: McpServer,
  getDeps: () => NodeToolDeps
): void {
  // ─── start_node ────────────────────────────────────────────────

  server.tool(
    "start_node",
    "Register the agent with the Plumise network and start the heartbeat loop. " +
      "This must be called before the agent can participate in challenges or earn rewards.",
    {},
    async () => {
      try {
        const { rpcClient, account, heartbeat } = getDeps();

        const timestamp = Math.floor(Date.now() / 1000);
        const message = `register:${account.address}:${timestamp}`;
        const signature = await account.signMessage({ message });

        const result = await rpcClient.agentRegister(
          account.address,
          signature
        );

        await heartbeat.start();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "started",
                  agentId: result.agentId,
                  address: account.address,
                  heartbeatRunning: heartbeat.isRunning,
                  message: result.message,
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
          content: [{ type: "text" as const, text: `Failed to start node: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // ─── stop_node ─────────────────────────────────────────────────

  server.tool(
    "stop_node",
    "Stop the heartbeat loop and deregister the agent from the Plumise network. " +
      "The agent will no longer receive challenges or earn rewards after this.",
    {},
    async () => {
      try {
        const { account, heartbeat } = getDeps();

        heartbeat.stop();

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "stopped",
                  address: account.address,
                  heartbeatRunning: heartbeat.isRunning,
                  totalHeartbeats: heartbeat.heartbeatCount,
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
          content: [{ type: "text" as const, text: `Failed to stop node: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // ─── node_status ───────────────────────────────────────────────

  server.tool(
    "node_status",
    "Get the current status of this agent on the Plumise network, including " +
      "uptime, challenges solved, pending rewards, and heartbeat state.",
    {},
    async () => {
      try {
        const { rpcClient, account, heartbeat } = getDeps();
        const status = await rpcClient.agentGetStatus(account.address);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  ...status,
                  heartbeat: {
                    running: heartbeat.isRunning,
                    lastHeartbeat: heartbeat.lastHeartbeat?.toISOString() ?? null,
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
          content: [{ type: "text" as const, text: `Failed to get status: ${msg}` }],
          isError: true,
        };
      }
    }
  );

  // ─── solve_challenge ───────────────────────────────────────────

  server.tool(
    "solve_challenge",
    "Get the current challenge from the Plumise network, attempt to solve it, " +
      "and submit the solution. Challenges are computational puzzles that reward " +
      "PLM tokens upon successful completion.",
    {},
    async () => {
      try {
        const { rpcClient, account } = getDeps();
        const challenge = await rpcClient.agentGetChallenge(account.address);

        if (!challenge || !challenge.id) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No challenge currently available. Try again later.",
              },
            ],
          };
        }

        const now = Math.floor(Date.now() / 1000);
        if (challenge.expiresAt > 0 && now >= challenge.expiresAt) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "expired",
                    challengeId: challenge.id,
                    expiredAt: new Date(challenge.expiresAt * 1000).toISOString(),
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const solution = solveChallenge(challenge.data, challenge.difficulty);

        if (!solution) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify(
                  {
                    status: "failed",
                    challengeId: challenge.id,
                    difficulty: challenge.difficulty,
                    message: "Could not find solution within iteration limit.",
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        const submitMessage = `solution:${account.address}:${challenge.id}:${solution}`;
        const signature = await account.signMessage({ message: submitMessage });

        const result = await rpcClient.agentSubmitSolution(
          account.address,
          challenge.id,
          solution,
          signature
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: result.accepted ? "accepted" : "rejected",
                  challengeId: challenge.id,
                  difficulty: challenge.difficulty,
                  reward: result.reward,
                  message: result.message,
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
          content: [{ type: "text" as const, text: `Challenge error: ${msg}` }],
          isError: true,
        };
      }
    }
  );
}

// ─── Challenge Solver ──────────────────────────────────────────────

const MAX_ITERATIONS = 1_000_000;

function solveChallenge(data: string, difficulty: number): string | null {
  for (let nonce = 0; nonce < MAX_ITERATIONS; nonce++) {
    const input = data + nonce.toString(16).padStart(8, "0");
    const hash = keccak256(toBytes(input));

    if (hasLeadingZeroBits(hash, difficulty)) {
      return nonce.toString(16).padStart(8, "0");
    }
  }
  return null;
}

function hasLeadingZeroBits(hash: string, bits: number): boolean {
  const hex = hash.startsWith("0x") ? hash.slice(2) : hash;
  const fullNibbles = Math.floor(bits / 4);
  const remainingBits = bits % 4;

  for (let i = 0; i < fullNibbles; i++) {
    if (hex[i] !== "0") return false;
  }

  if (remainingBits > 0 && fullNibbles < hex.length) {
    const nibbleValue = parseInt(hex[fullNibbles], 16);
    const mask = 0xf << (4 - remainingBits);
    if ((nibbleValue & mask) !== 0) return false;
  }

  return true;
}
