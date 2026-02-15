#!/usr/bin/env node

/**
 * Plumise MCP Server
 *
 * A Model Context Protocol server that wraps the Plumise blockchain's
 * agent_* RPC namespace. Provides tools for node management, wallet
 * operations, and challenge solving, plus resources for real-time
 * wallet, node, and network state.
 *
 * Usage:
 *   PLUMISE_NODE_URL=https://plug.plumise.com/rpc \
 *   PLUMISE_PRIVATE_KEY=0x... \
 *   plumise-mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";

import { loadConfig } from "./config.js";
import { RpcClient } from "./services/rpc-client.js";
import { HeartbeatService } from "./services/heartbeat.js";
import { registerNodeTools } from "./tools/node.js";
import { registerWalletTools } from "./tools/wallet.js";
import { registerInferenceTools } from "./tools/inference.js";
import { registerWalletResource } from "./resources/wallet.js";
import { registerNodeResource } from "./resources/node.js";
import { registerNetworkResource } from "./resources/network.js";

async function main(): Promise<void> {
  // Load configuration from environment
  const config = loadConfig();

  // Create account from private key
  const privateKey = config.privateKey.startsWith("0x")
    ? config.privateKey
    : `0x${config.privateKey}`;
  const account = privateKeyToAccount(privateKey as `0x${string}`);

  // Create RPC client
  const rpcClient = new RpcClient(config.nodeUrl);

  // Create heartbeat service
  const heartbeat = new HeartbeatService(
    rpcClient,
    account,
    config.heartbeatIntervalMs
  );

  // Create MCP server
  const server = new McpServer(
    {
      name: "plumise-mcp",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Register tools
  registerNodeTools(server, rpcClient, account, heartbeat);
  registerWalletTools(server, rpcClient, account, config);
  registerInferenceTools(server, rpcClient, account, config);

  // Register resources
  registerWalletResource(server, rpcClient, account);
  registerNodeResource(server, rpcClient, account, heartbeat);
  registerNetworkResource(server, rpcClient, config);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  const shutdown = async () => {
    heartbeat.stop();
    await server.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.error(
    `[plumise-mcp] Server started. Agent address: ${account.address}`
  );
}

main().catch((error) => {
  console.error("[plumise-mcp] Fatal error:", error);
  process.exit(1);
});
