/**
 * Wallet Resource
 *
 * Exposes plumise://wallet as an MCP resource that returns
 * the current wallet address and PLM balance.
 */

import type { PrivateKeyAccount } from "viem/accounts";
import { formatPLM } from "@plumise/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RpcClient } from "../services/rpc-client.js";

export interface WalletResourceDeps {
  rpcClient: RpcClient;
  account: PrivateKeyAccount;
}

export function registerWalletResource(
  server: McpServer,
  getDeps: () => WalletResourceDeps
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
        const { rpcClient, account } = getDeps();
        const balanceHex = await rpcClient.getBalance(account.address);
        const balanceWei = BigInt(balanceHex);
        const balancePlm = formatPLM(balanceWei);

        return {
          contents: [
            {
              uri: "plumise://wallet",
              mimeType: "application/json",
              text: JSON.stringify(
                {
                  address: account.address,
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
                  address: null,
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
