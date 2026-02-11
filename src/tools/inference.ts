/**
 * Inference Tools
 *
 * MCP tools for AI inference operations on the Plumise network:
 * - serve_model: Register as an inference node serving a specific model
 * - inference: Run AI inference through the distributed Plumise network
 * - model_status: Check model availability and node status
 * - agent_rewards: Check and claim agent inference rewards
 */

import { z } from "zod";
import type { PrivateKeyAccount } from "viem/accounts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RpcClient } from "../services/rpc-client.js";
import type { PlumiseConfig } from "../config.js";
import {
  handleServeModel,
  handleInference,
  handleModelStatus,
  handleAgentRewards,
} from "./inference-handlers.js";

export interface InferenceConfig {
  inferenceApiUrl: string;
  rpcUrl: string;
  privateKey?: string;
}

export function registerInferenceTools(
  server: McpServer,
  rpcClient: RpcClient,
  account: PrivateKeyAccount,
  config: PlumiseConfig
): void {
  const inferenceConfig: InferenceConfig = {
    inferenceApiUrl: config.inferenceApiUrl,
    rpcUrl: config.nodeUrl,
    privateKey: config.privateKey,
  };

  // ─── serve_model ──────────────────────────────────────────────

  server.tool(
    "serve_model",
    "Register this node as an AI model inference server on the Plumise chain. " +
      "Once registered, the node will be discoverable by other agents for inference requests " +
      "and will earn PLM rewards for serving inference tasks.",
    {
      model: z
        .string()
        .describe(
          "Model ID to serve (e.g., 'meta-llama/Llama-3.1-8B', 'mistralai/Mistral-7B-v0.1')."
        ),
      endpoint: z
        .string()
        .describe(
          "HTTP endpoint where the model is accessible for inference requests (e.g., 'http://localhost:8080/v1')."
        ),
      capacity: z
        .number()
        .optional()
        .describe(
          "Maximum number of concurrent inference requests this node can handle. Defaults to 1."
        ),
    },
    async ({ model, endpoint, capacity }) => {
      return handleServeModel(
        { model, endpoint, capacity },
        inferenceConfig,
        account
      );
    }
  );

  // ─── inference ────────────────────────────────────────────────

  server.tool(
    "inference",
    "Run AI inference through the Plumise distributed network. " +
      "Sends a prompt to an available inference node serving the specified model " +
      "and returns the generated response. Supports both completion and streaming modes.",
    {
      model: z
        .string()
        .describe(
          "Model to use for inference (e.g., 'meta-llama/Llama-3.1-8B')."
        ),
      prompt: z
        .string()
        .describe("Input prompt text to send to the model."),
      max_tokens: z
        .number()
        .optional()
        .describe(
          "Maximum number of tokens to generate. Defaults to 256."
        ),
      temperature: z
        .number()
        .optional()
        .describe(
          "Sampling temperature (0.0 to 2.0). Higher values produce more random output. Defaults to 0.7."
        ),
      stream: z
        .boolean()
        .optional()
        .describe(
          "Whether to stream the response. Defaults to false."
        ),
    },
    async ({ model, prompt, max_tokens, temperature, stream }) => {
      return handleInference(
        { model, prompt, max_tokens, temperature, stream },
        inferenceConfig,
        account
      );
    }
  );

  // ─── model_status ─────────────────────────────────────────────

  server.tool(
    "model_status",
    "Check the status and availability of AI models on the Plumise network. " +
      "If a specific model ID is provided, returns detailed status for that model. " +
      "Otherwise, lists all available models with their node counts and capacity.",
    {
      model: z
        .string()
        .optional()
        .describe(
          "Model ID to check (e.g., 'meta-llama/Llama-3.1-8B'). If omitted, lists all available models."
        ),
    },
    async ({ model }) => {
      return handleModelStatus({ model }, inferenceConfig);
    }
  );

  // ─── agent_rewards ────────────────────────────────────────────

  server.tool(
    "agent_rewards",
    "Check pending inference rewards and optionally claim them. " +
      "Agents earn PLM rewards for serving AI model inference on the Plumise network. " +
      "Use 'check' to view pending rewards, 'claim' to claim them, or 'history' to see past claims.",
    {
      action: z
        .enum(["check", "claim", "history"])
        .describe(
          "Action to perform: 'check' to view pending rewards, 'claim' to claim rewards, 'history' to see claim history."
        ),
      agent_address: z
        .string()
        .optional()
        .describe(
          "Agent address to check rewards for. Defaults to the connected wallet address."
        ),
    },
    async ({ action, agent_address }) => {
      return handleAgentRewards(
        { action, agent_address },
        inferenceConfig,
        account
      );
    }
  );
}
