/**
 * Plumise MCP Server Configuration
 *
 * All configuration is read from environment variables.
 */

export interface PlumiseConfig {
  /** Plumise node JSON-RPC URL */
  nodeUrl: string;
  /** Private key for signing transactions (hex, with or without 0x prefix) */
  privateKey: string;
  /** Heartbeat interval in milliseconds (default: 60000) */
  heartbeatIntervalMs: number;
  /** Chain ID (default: 8881217) */
  chainId: number;
}

export function loadConfig(): PlumiseConfig {
  const nodeUrl = process.env.PLUMISE_NODE_URL;
  if (!nodeUrl) {
    throw new Error(
      "PLUMISE_NODE_URL environment variable is required. " +
      "Example: https://node-1.plumise.com/rpc"
    );
  }

  const privateKey = process.env.PLUMISE_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error(
      "PLUMISE_PRIVATE_KEY environment variable is required. " +
      "Provide a hex-encoded private key (with or without 0x prefix)."
    );
  }

  const heartbeatIntervalMs = parseInt(
    process.env.PLUMISE_HEARTBEAT_INTERVAL_MS || "60000",
    10
  );

  const chainId = parseInt(
    process.env.PLUMISE_CHAIN_ID || "8881217",
    10
  );

  return {
    nodeUrl,
    privateKey,
    heartbeatIntervalMs,
    chainId,
  };
}
