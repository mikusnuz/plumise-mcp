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
 *   PLUMISE_NODE_URL=https://node-1.plumise.com/rpc \
 *   PLUMISE_PRIVATE_KEY=0x... \
 *   plumise-mcp
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ethers } from "ethers";

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

  // Create wallet from private key
  const wallet = new ethers.Wallet(config.privateKey);

  // Create RPC client
  const rpcClient = new RpcClient(config.nodeUrl);

  // Create heartbeat service
  const heartbeat = new HeartbeatService(
    rpcClient,
    wallet,
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
  registerNodeTools(server, rpcClient, wallet, heartbeat);
  registerWalletTools(server, rpcClient, wallet, config);
  registerInferenceTools(server, rpcClient, wallet, config);

  // Register resources
  registerWalletResource(server, rpcClient, wallet);
  registerNodeResource(server, rpcClient, wallet, heartbeat);
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
    `[plumise-mcp] Server started. Agent address: ${wallet.address}`
  );
}

main().catch((error) => {
  console.error("[plumise-mcp] Fatal error:", error);
  process.exit(1);
});
