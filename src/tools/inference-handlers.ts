/**
 * Inference Tool Handlers
 *
 * Implementation for inference-related MCP tools.
 * Communicates with the Plumise Inference API gateway and the chain RPC.
 */

import { ethers } from "ethers";
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

// ─── RewardPool Contract ABI (minimal) ──────────────────────────────

const REWARD_POOL_ABI = [
  "function pendingRewards(address agent) view returns (uint256)",
  "function claimRewards() external",
  "function claimedRewards(address agent) view returns (uint256)",
  "event RewardClaimed(address indexed agent, uint256 amount)",
];

// RewardPool contract address on Plumise chain (deployed for inference rewards)
const REWARD_POOL_ADDRESS = "0x0000000000000000000000000000000000000100";

// ─── HTTP Helpers ───────────────────────────────────────────────────

async function apiRequest(
  baseUrl: string,
  path: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const { method = "GET", body, headers = {} } = options;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

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
  wallet: ethers.Wallet
): Promise<ToolResult> {
  try {
    const { model, endpoint, capacity } = args;

    // Sign registration message for authentication
    const timestamp = Math.floor(Date.now() / 1000);
    const message = `serve_model:${wallet.address}:${model}:${timestamp}`;
    const signature = await wallet.signMessage(message);

    const result = await apiRequest(
      config.inferenceApiUrl,
      "/api/v1/models/register",
      {
        method: "POST",
        body: {
          model,
          endpoint,
          capacity: capacity ?? 1,
          agent_address: wallet.address,
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
      agent_address: wallet.address,
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
  wallet: ethers.Wallet
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
    const message = `inference:${wallet.address}:${model}:${timestamp}`;
    const signature = await wallet.signMessage(message);

    // Use OpenAI-compatible chat completions API
    const result = await apiRequest(
      config.inferenceApiUrl,
      "/api/v1/inference/chat",
      {
        method: "POST",
        headers: {
          "X-Agent-Address": wallet.address,
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
  wallet: ethers.Wallet
): Promise<ToolResult> {
  try {
    const { action, agent_address } = args;
    const targetAddress = agent_address || wallet.address;

    // Validate address
    if (!ethers.isAddress(targetAddress)) {
      return makeErrorResult(`Invalid address: ${targetAddress}`);
    }

    const provider = new ethers.JsonRpcProvider(config.rpcUrl);

    switch (action) {
      case "check": {
        const rewardPool = new ethers.Contract(
          REWARD_POOL_ADDRESS,
          REWARD_POOL_ABI,
          provider
        );

        const [pending, claimed] = await Promise.all([
          rewardPool.pendingRewards(targetAddress) as Promise<bigint>,
          rewardPool.claimedRewards(targetAddress) as Promise<bigint>,
        ]);

        return makeTextResult({
          address: targetAddress,
          pending: ethers.formatEther(pending),
          claimed: ethers.formatEther(claimed),
          total: ethers.formatEther(pending + claimed),
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

        const signer = new ethers.Wallet(config.privateKey, provider);
        const rewardPool = new ethers.Contract(
          REWARD_POOL_ADDRESS,
          REWARD_POOL_ABI,
          signer
        );

        // Check pending amount first
        const pending = (await rewardPool.pendingRewards(
          signer.address
        )) as bigint;

        if (pending === 0n) {
          return makeTextResult({
            status: "no_rewards",
            address: signer.address,
            message: "No pending rewards to claim.",
          });
        }

        // Claim rewards
        const tx = await rewardPool.claimRewards();
        const receipt = await tx.wait();

        return makeTextResult({
          status: "claimed",
          txHash: receipt.hash,
          address: signer.address,
          amount: ethers.formatEther(pending),
          unit: "PLM",
          blockNumber: receipt.blockNumber,
        });
      }

      case "history": {
        // Query past RewardClaimed events for the agent
        const rewardPool = new ethers.Contract(
          REWARD_POOL_ADDRESS,
          REWARD_POOL_ABI,
          provider
        );

        const filter = rewardPool.filters.RewardClaimed(targetAddress);

        // Get events from last ~30 days (~216000 blocks at 12s/block)
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, currentBlock - 216000);

        const events = await rewardPool.queryFilter(filter, fromBlock);

        const history = await Promise.all(
          events.map(async (event) => {
            const log = event as ethers.EventLog;
            const block = await log.getBlock();
            return {
              txHash: log.transactionHash,
              amount: ethers.formatEther(log.args[1]),
              unit: "PLM",
              blockNumber: log.blockNumber,
              timestamp: block
                ? new Date(block.timestamp * 1000).toISOString()
                : null,
            };
          })
        );

        return makeTextResult({
          address: targetAddress,
          claimHistory: history,
          totalClaims: history.length,
          fromBlock,
          toBlock: currentBlock,
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
