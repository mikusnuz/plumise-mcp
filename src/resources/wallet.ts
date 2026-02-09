/**
 * Wallet Resource
 *
 * Exposes plumise://wallet as an MCP resource that returns
 * the current wallet address and PLM balance.
 */

import { ethers } from "ethers";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RpcClient } from "../services/rpc-client.js";

export function registerWalletResource(
  server: McpServer,
  rpcClient: RpcClient,
  wallet: ethers.Wallet
): void {
  server.resource(
    "wallet",
    "plumise://wallet",
    {
      description:
        "Current agent wallet information including address and PLM balance.",
      mimeType: "application/json",
    },
    async () => {
      try {
        const balanceHex = await rpcClient.getBalance(wallet.address);
        const balanceWei = BigInt(balanceHex);
        const balancePlm = ethers.formatEther(balanceWei);

        return {
          contents: [
            {
              uri: "plumise://wallet",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  address: wallet.address,
                  balance: balancePlm,
                  balanceWei: balanceWei.toString(),
                  unit: "PLM",
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
              uri: "plumise://wallet",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  address: wallet.address,
                  balance: null,
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
