/**
 * Inference Tool Handlers
 *
 * Implementation for inference-related MCP tools.
 * Communicates with the Plumise Inference API gateway and the chain RPC.
 */

import {
  createPublicClient,
  createWalletClient,
  http,
  getContract,
  isAddress,
  type Address,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  plumise,
  addresses,
  rewardPoolAbi,
  formatPLM,
} from "@plumise/core";
import type { InferenceConfig } from "./inference.js";

// ─── Types ──────────────────────────────────────────────────────────

interface ServeModelArgs {
  model: string;
  endpoint: string;
  capacity?: number;
}

interface InferenceArgs {
  model: string;
  prompt: string;
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

interface ModelStatusArgs {
  model?: string;
}

interface AgentRewardsArgs {
  action: "check" | "claim" | "history";
  agent_address?: string;
}

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

// RewardPool contract address on Plumise chain
// Override via PLUMISE_REWARD_POOL_ADDRESS environment variable
const REWARD_POOL_ADDRESS =
  process.env.PLUMISE_REWARD_POOL_ADDRESS ||
  addresses.mainnet.RewardPool;

/** Default HTTP request timeout in milliseconds */
const FETCH_TIMEOUT_MS = 30_000;

// ─── HTTP Helpers ───────────────────────────────────────────────────

async function apiRequest(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    timeoutMs?: number;
  } = {}
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const { method = "GET", body, headers = {}, timeoutMs = FETCH_TIMEOUT_MS } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    signal: controller.signal,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, fetchOptions);
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `API request timed out after ${timeoutMs}ms: ${method} ${path}`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `API request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return response.json();
}

function makeTextResult(data: unknown, isError = false): ToolResult {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
    ...(isError ? { isError: true } : {}),
  };
}

function makeErrorResult(message: string): ToolResult {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}

// ─── Handler: serve_model ───────────────────────────────────────────

export async function handleServeModel(
  args: ServeModelArgs,
  config: InferenceConfig,
  account: PrivateKeyAccount
): Promise<ToolResult> {
  try {
    const { model, endpoint, capacity } = args;

    // Sign registration message for authentication
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `serve_model:${account.address}:${model}:${timestamp}`;
    const signature = await account.signMessage({ message });

    const result = await apiRequest(
      config.inferenceApiUrl,
      "/api/v1/models/register",
      {
        method: "POST",
        body: {
          model,
          endpoint,
          capacity: capacity ?? 1,
          agent_address: account.address,
          signature,
          timestamp,
        },
      }
    );

    return makeTextResult({
      status: "registered",
      model,
      endpoint,
      capacity: capacity ?? 1,
      agent_address: account.address,
      ...(result as object),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return makeErrorResult(`Failed to register model: ${msg}`);
  }
}

// ─── Handler: inference ─────────────────────────────────────────────

export async function handleInference(
  args: InferenceArgs,
  config: InferenceConfig,
  account: PrivateKeyAccount
): Promise<ToolResult> {
  try {
    const {
      model,
      prompt,
      max_tokens = 256,
      temperature = 0.7,
      stream = false,
    } = args;

    // Sign inference request for metering/billing
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `inference:${account.address}:${model}:${timestamp}`;
    const signature = await account.signMessage({ message });

    // Use OpenAI-compatible chat completions API
    const result = await apiRequest(
      config.inferenceApiUrl,
      "/api/v1/inference/chat",
      {
        method: "POST",
        headers: {
          "X-Agent-Address": account.address,
          "X-Agent-Signature": signature,
          "X-Agent-Timestamp": timestamp.toString(),
        },
        body: {
          model,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          max_tokens,
          temperature,
          stream,
        },
      }
    );

    const response = result as {
      id?: string;
      choices?: Array<{
        message?: { role: string; content: string };
        finish_reason?: string;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
      model?: string;
      served_by?: string;
    };

    // Extract the response content
    const content =
      response.choices?.[0]?.message?.content ?? JSON.stringify(response);

    return makeTextResult({
      model: response.model ?? model,
      response: content,
      finish_reason: response.choices?.[0]?.finish_reason ?? "unknown",
      usage: response.usage ?? null,
      inference_id: response.id ?? null,
      served_by: response.served_by ?? null,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return makeErrorResult(`Inference failed: ${msg}`);
  }
}

// ─── Handler: model_status ──────────────────────────────────────────

export async function handleModelStatus(
  args: ModelStatusArgs,
  config: InferenceConfig
): Promise<ToolResult> {
  try {
    const { model } = args;

    if (model) {
      // Get status for a specific model
      const result = await apiRequest(
        config.inferenceApiUrl,
        `/api/v1/models/${encodeURIComponent(model)}`
      );

      return makeTextResult(result);
    } else {
      // List all available models
      const result = await apiRequest(
        config.inferenceApiUrl,
        "/api/v1/models"
      );

      return makeTextResult(result);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return makeErrorResult(`Failed to get model status: ${msg}`);
  }
}

// ─── Handler: agent_rewards ─────────────────────────────────────────

export async function handleAgentRewards(
  args: AgentRewardsArgs,
  config: InferenceConfig,
  account: PrivateKeyAccount
): Promise<ToolResult> {
  try {
    const { action, agent_address } = args;
    const targetAddress = (agent_address || account.address) as Address;

    // Validate address
    if (!isAddress(targetAddress)) {
      return makeErrorResult(`Invalid address: ${targetAddress}`);
    }

    // Validate provider URL
    try {
      const parsed = new URL(config.rpcUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return makeErrorResult(
          `Invalid RPC URL protocol: ${parsed.protocol}. Only http/https supported.`
        );
      }
    } catch {
      return makeErrorResult(`Invalid RPC URL: ${config.rpcUrl}`);
    }

    const publicClient = createPublicClient({
      chain: plumise,
      transport: http(config.rpcUrl),
    });

    switch (action) {
      case "check": {
        const [pending, claimed] = await Promise.all([
          publicClient.readContract({
            address: REWARD_POOL_ADDRESS as Address,
            abi: rewardPoolAbi,
            functionName: "pendingRewards",
            args: [targetAddress],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: REWARD_POOL_ADDRESS as Address,
            abi: rewardPoolAbi,
            functionName: "getPendingReward",
            args: [targetAddress],
          }) as Promise<bigint>,
        ]);

        return makeTextResult({
          address: targetAddress,
          pending: formatPLM(pending),
          claimed: formatPLM(claimed),
          total: formatPLM(pending + claimed),
          unit: "PLM",
          raw: {
            pendingWei: pending.toString(),
            claimedWei: claimed.toString(),
          },
        });
      }

      case "claim": {
        if (!config.privateKey) {
          return makeErrorResult(
            "Private key required for claiming rewards. Set PLUMISE_PRIVATE_KEY."
          );
        }

        const pk = config.privateKey.startsWith("0x")
          ? config.privateKey
          : `0x${config.privateKey}`;
        const signerAccount = privateKeyToAccount(pk as `0x${string}`);
        const walletClient = createWalletClient({
          account: signerAccount,
          chain: plumise,
          transport: http(config.rpcUrl),
        });

        // Check pending amount first
        const pendingAmount = await publicClient.readContract({
          address: REWARD_POOL_ADDRESS as Address,
          abi: rewardPoolAbi,
          functionName: "pendingRewards",
          args: [signerAccount.address],
        }) as bigint;

        if (pendingAmount === 0n) {
          return makeTextResult({
            status: "no_rewards",
            address: signerAccount.address,
            message: "No pending rewards to claim.",
          });
        }

        // Claim rewards
        const hash = await walletClient.writeContract({
          address: REWARD_POOL_ADDRESS as Address,
          abi: rewardPoolAbi,
          functionName: "claimReward",
          args: [],
        });
        const receipt = await publicClient.waitForTransactionReceipt({ hash });

        return makeTextResult({
          status: "claimed",
          txHash: receipt.transactionHash,
          address: signerAccount.address,
          amount: formatPLM(pendingAmount),
          unit: "PLM",
          blockNumber: Number(receipt.blockNumber),
        });
      }

      case "history": {
        // Query past RewardClaimed events for the agent
        const currentBlock = await publicClient.getBlockNumber();
        const fromBlock = currentBlock > 216000n ? currentBlock - 216000n : 0n;

        const logs = await publicClient.getLogs({
          address: REWARD_POOL_ADDRESS as Address,
          event: {
            type: "event",
            name: "RewardClaimed",
            inputs: [
              { name: "agent", type: "address", indexed: true },
              { name: "amount", type: "uint256", indexed: false },
            ],
          } as const,
          args: {
            agent: targetAddress,
          },
          fromBlock,
          toBlock: currentBlock,
        });

        const history = await Promise.all(
          logs.map(async (log) => {
            const block = await publicClient.getBlock({ blockNumber: log.blockNumber });
            return {
              txHash: log.transactionHash,
              amount: formatPLM((log as any).args.amount as bigint),
              unit: "PLM",
              blockNumber: Number(log.blockNumber),
              timestamp: block
                ? new Date(Number(block.timestamp) * 1000).toISOString()
                : null,
            };
          })
        );

        return makeTextResult({
          address: targetAddress,
          claimHistory: history,
          totalClaims: history.length,
          fromBlock: Number(fromBlock),
          toBlock: Number(currentBlock),
        });
      }

      default:
        return makeErrorResult(
          `Unknown action: ${action}. Use 'check', 'claim', or 'history'.`
        );
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return makeErrorResult(`Rewards operation failed: ${msg}`);
  }
}
