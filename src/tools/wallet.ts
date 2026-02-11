/**
 * Wallet Tools
 *
 * MCP tools for wallet operations on the Plumise network:
 * - check_balance: Get PLM balance
 * - transfer: Send PLM to another address
 * - claim_reward: Claim accumulated agent rewards
 * - pending_reward: Check pending reward balance
 */

import { z } from "zod";
import { isAddress, parseEther, serializeTransaction, type Address } from "viem";
import type { PrivateKeyAccount } from "viem/accounts";
import { formatPLM } from "@plumise/core";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RpcClient } from "../services/rpc-client.js";
import type { PlumiseConfig } from "../config.js";

export function registerWalletTools(
  server: McpServer,
  rpcClient: RpcClient,
  account: PrivateKeyAccount,
  config: PlumiseConfig
): void {
  // ─── check_balance ─────────────────────────────────────────────

  server.tool(
    "check_balance",
    "Check the PLM (native token) balance of a wallet address on the Plumise network. " +
      "If no address is provided, checks the agent's own wallet balance.",
    {
      address: z
        .string()
        .optional()
        .describe(
          "The wallet address to check. Defaults to the agent's own address."
        ),
    },
    async ({ address }) => {
      try {
        const targetAddress = address || account.address;

        // Validate address format
        if (!isAddress(targetAddress)) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid address: ${targetAddress}`,
              },
            ],
            isError: true,
          };
        }

        const balanceHex = await rpcClient.getBalance(targetAddress);
        const balanceWei = BigInt(balanceHex);
        const balancePlm = formatPLM(balanceWei);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  address: targetAddress,
                  balance: balancePlm,
                  unit: "PLM",
                  balanceWei: balanceWei.toString(),
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
          content: [
            { type: "text" as const, text: `Failed to check balance: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── transfer ──────────────────────────────────────────────────

  server.tool(
    "transfer",
    "Send PLM (native token) from the agent's wallet to another address on " +
      "the Plumise network. Requires the amount in PLM (not wei).",
    {
      to: z
        .string()
        .describe("The recipient wallet address (0x-prefixed hex)."),
      amount: z
        .string()
        .describe("Amount of PLM to send (e.g., '1.5' for 1.5 PLM)."),
    },
    async ({ to, amount }) => {
      try {
        // Validate recipient address
        if (!isAddress(to)) {
          return {
            content: [
              { type: "text" as const, text: `Invalid recipient address: ${to}` },
            ],
            isError: true,
          };
        }

        // Parse amount
        let valueWei: bigint;
        try {
          valueWei = parseEther(amount);
        } catch {
          return {
            content: [
              {
                type: "text" as const,
                text: `Invalid amount: ${amount}. Provide a valid decimal number.`,
              },
            ],
            isError: true,
          };
        }

        if (valueWei <= 0n) {
          return {
            content: [
              { type: "text" as const, text: "Amount must be greater than 0." },
            ],
            isError: true,
          };
        }

        // Get nonce and gas price
        const nonceHex = await rpcClient.getTransactionCount(account.address);
        const gasPriceHex = await rpcClient.getGasPrice();

        const nonce = parseInt(nonceHex, 16);
        const gasPrice = BigInt(gasPriceHex);

        // Build and sign transaction
        const tx = {
          to: to as Address,
          value: valueWei,
          nonce,
          gas: 21000n,
          gasPrice,
          chainId: config.chainId,
          type: "legacy" as const,
        };

        const signedTx = await account.signTransaction(tx);
        const txHash = await rpcClient.sendRawTransaction(signedTx);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "sent",
                  txHash,
                  from: account.address,
                  to,
                  amount,
                  unit: "PLM",
                  nonce,
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
          content: [
            { type: "text" as const, text: `Transfer failed: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── claim_reward ──────────────────────────────────────────────

  server.tool(
    "claim_reward",
    "Claim accumulated agent rewards from the Plumise network. Rewards are " +
      "earned by solving challenges and maintaining uptime. This sends a " +
      "transaction to claim all pending rewards.",
    {},
    async () => {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const message = `claim:${account.address}:${timestamp}`;
        const signature = await account.signMessage({ message });

        const result = await rpcClient.agentClaimReward(
          account.address,
          signature
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "claimed",
                  txHash: result.txHash,
                  amount: formatPLM(BigInt(result.amount)),
                  unit: "PLM",
                  amountWei: result.amount,
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
          content: [
            { type: "text" as const, text: `Claim failed: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );

  // ─── pending_reward ────────────────────────────────────────────

  server.tool(
    "pending_reward",
    "Check the pending (unclaimed) reward balance for this agent on the " +
      "Plumise network. Shows pending, claimed, and total rewards.",
    {},
    async () => {
      try {
        const reward = await rpcClient.agentGetReward(account.address);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  address: account.address,
                  pending: formatPLM(BigInt(reward.pending)),
                  claimed: formatPLM(BigInt(reward.claimed)),
                  total: formatPLM(BigInt(reward.total)),
                  unit: "PLM",
                  raw: reward,
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
          content: [
            { type: "text" as const, text: `Failed to get rewards: ${msg}` },
          ],
          isError: true,
        };
      }
    }
  );
}
