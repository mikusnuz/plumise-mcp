#!/usr/bin/env node

/**
 * Plumise MCP Server
 *
 * A Model Context Protocol server that wraps the Plumise blockchain's
 * agent_* RPC namespace. Provides tools for node management, wallet
 * operations, and inference, plus resources for real-time wallet, node,
 * and network state.
 *
 * Usage:
 *   PLUMISE_NODE_URL=https://plug.plumise.com/rpc \
 *   PLUMISE_PRIVATE_KEY=0x... \
 *   plumise-mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { z } from "zod";

import { loadConfig, type PlumiseConfig } from "./config.js";
import { RpcClient } from "./services/rpc-client.js";
import { HeartbeatService } from "./services/heartbeat.js";
import { registerNodeTools } from "./tools/node.js";
import { registerWalletTools } from "./tools/wallet.js";
import { registerInferenceTools } from "./tools/inference.js";
import { registerWalletResource } from "./resources/wallet.js";
import { registerNodeResource } from "./resources/node.js";
import { registerNetworkResource } from "./resources/network.js";

interface LazyState {
  config: PlumiseConfig;
  rpcClient: RpcClient;
  account: PrivateKeyAccount;
  heartbeat: HeartbeatService;
}

let lazyState: LazyState | null = null;

function getState(): LazyState {
  if (!lazyState) {
    const config = loadConfig();

    if (!config.nodeUrl || !config.privateKey) {
      throw new Error(
        "PLUMISE_NODE_URL and PLUMISE_PRIVATE_KEY environment variables are required."
      );
    }

    const pk = config.privateKey.startsWith("0x")
      ? config.privateKey
      : `0x${config.privateKey}`;
    const account = privateKeyToAccount(pk as `0x${string}`);
    const rpcClient = new RpcClient(config.nodeUrl);
    const heartbeat = new HeartbeatService(
      rpcClient,
      account,
      config.heartbeatIntervalMs
    );

    lazyState = { config, rpcClient, account, heartbeat };
  }
  return lazyState;
}

async function main(): Promise<void> {
  const server = new McpServer(
    {
      name: "plumise-mcp",
      version: "1.2.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  registerNodeTools(server, () => getState());
  registerWalletTools(server, () => getState());
  registerInferenceTools(server, () => getState());

  registerWalletResource(server, () => getState());
  registerNodeResource(server, () => getState());
  registerNetworkResource(server, () => getState());

  server.prompt(
    "network_status",
    "Check Plumise network health: node sync status, peer count, latest block, and gas price",
    {},
    () => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              "Please check the current health and status of the Plumise network. " +
              "Use the `plumise://network` resource to get network-wide statistics including " +
              "the latest block number, gas price, active agents, and challenge/reward metrics. " +
              "Also use the `node_status` tool to get the local agent's heartbeat status and uptime. " +
              "Summarize: (1) latest block height, (2) current gas price in gwei, " +
              "(3) number of active vs total agents, (4) total challenges solved, " +
              "(5) total rewards distributed, and (6) local node heartbeat health. " +
              "Flag any anomalies such as stalled block height or unusually high gas price.",
          },
        },
      ],
    })
  );

  server.prompt(
    "wallet_overview",
    "Get a comprehensive wallet overview: balance, pending rewards, and recent activity",
    {
      address: z
        .string()
        .optional()
        .describe(
          "Wallet address to inspect. Defaults to the agent's own address if omitted."
        ),
    },
    ({ address }) => ({
      messages: [
        {
          role: "user" as const,
          content: {
            type: "text" as const,
            text:
              `Please provide a comprehensive overview of the wallet${address ? ` at address ${address}` : ""}. ` +
              "Use the `check_balance` tool to get the current PLM balance" +
              (address ? ` for address ${address}` : " (agent's own wallet)") +
              ". Then use the `pending_reward` tool to check unclaimed agent rewards. " +
              "Finally read the `plumise://wallet` resource for the full wallet snapshot. " +
              "Summarize: (1) current PLM balance, (2) pending (unclaimed) rewards, " +
              "(3) total rewards earned so far, and (4) any recommended actions " +
              "(e.g., claim rewards if pending > 1 PLM, check low balance warnings).",
          },
        },
      ],
    })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    if (lazyState) {
      lazyState.heartbeat.stop();
    }
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.error("[plumise-mcp] Server started. Waiting for tool calls.");
}

main().catch((error) => {
  console.error("[plumise-mcp] Fatal error:", error);
  process.exit(1);
});
