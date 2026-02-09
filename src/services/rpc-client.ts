/**
 * JSON-RPC Client for Plumise agent_* namespace
 *
 * Wraps all agent_* RPC methods exposed by the Plumise node.
 */

export interface RpcResponse<T = unknown> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export interface AgentStatus {
  registered: boolean;
  address: string;
  uptime: number;
  lastHeartbeat: number;
  challengesSolved: number;
  pendingReward: string;
}

export interface NetworkStats {
  totalAgents: number;
  activeAgents: number;
  totalChallengesSolved: number;
  totalRewardsDistributed: string;
  currentBlockNumber: number;
  networkHashrate: string;
}

export interface Challenge {
  id: string;
  difficulty: number;
  data: string;
  expiresAt: number;
}

export interface RewardInfo {
  pending: string;
  claimed: string;
  total: string;
}

export interface ClaimResult {
  txHash: string;
  amount: string;
}

export interface RegisterResult {
  success: boolean;
  agentId: string;
  message: string;
}

export interface HeartbeatResult {
  acknowledged: boolean;
  nextExpected: number;
}

export interface SolutionResult {
  accepted: boolean;
  reward: string;
  message: string;
}

export class RpcClient {
  private nodeUrl: string;
  private requestId: number = 0;

  constructor(nodeUrl: string) {
    this.nodeUrl = nodeUrl;
  }

  /**
   * Send a raw JSON-RPC request to the Plumise node.
   */
  async call<T = unknown>(method: string, params: unknown[] = []): Promise<T> {
    const id = ++this.requestId;
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id,
      method,
      params,
    });

    const response = await fetch(this.nodeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!response.ok) {
      throw new Error(
        `RPC HTTP error: ${response.status} ${response.statusText}`
      );
    }

    const json = (await response.json()) as RpcResponse<T>;

    if (json.error) {
      throw new Error(
        `RPC error [${json.error.code}]: ${json.error.message}`
      );
    }

    return json.result as T;
  }

  // ─── Agent Lifecycle ─────────────────────────────────────────────

  /**
   * Register this agent with the Plumise network.
   * @param address - The agent's wallet address
   * @param signature - Signed registration message
   */
  async agentRegister(
    address: string,
    signature: string
  ): Promise<RegisterResult> {
    return this.call<RegisterResult>("agent_register", [address, signature]);
  }

  /**
   * Send a heartbeat to prove liveness.
   * @param address - The agent's wallet address
   * @param signature - Signed heartbeat message
   */
  async agentHeartbeat(
    address: string,
    signature: string
  ): Promise<HeartbeatResult> {
    return this.call<HeartbeatResult>("agent_heartbeat", [address, signature]);
  }

  // ─── Agent Status ────────────────────────────────────────────────

  /**
   * Get the current status of an agent.
   * @param address - The agent's wallet address
   */
  async agentGetStatus(address: string): Promise<AgentStatus> {
    return this.call<AgentStatus>("agent_getStatus", [address]);
  }

  /**
   * Get network-wide agent statistics.
   */
  async agentGetNetworkStats(): Promise<NetworkStats> {
    return this.call<NetworkStats>("agent_getNetworkStats", []);
  }

  // ─── Rewards ─────────────────────────────────────────────────────

  /**
   * Get the reward info for an agent.
   * @param address - The agent's wallet address
   */
  async agentGetReward(address: string): Promise<RewardInfo> {
    return this.call<RewardInfo>("agent_getReward", [address]);
  }

  /**
   * Claim accumulated rewards.
   * @param address - The agent's wallet address
   * @param signature - Signed claim message
   */
  async agentClaimReward(
    address: string,
    signature: string
  ): Promise<ClaimResult> {
    return this.call<ClaimResult>("agent_claimReward", [address, signature]);
  }

  // ─── Challenges ──────────────────────────────────────────────────

  /**
   * Get the current challenge for the agent.
   * @param address - The agent's wallet address
   */
  async agentGetChallenge(address: string): Promise<Challenge> {
    return this.call<Challenge>("agent_getChallenge", [address]);
  }

  /**
   * Submit a solution to the current challenge.
   * @param address - The agent's wallet address
   * @param challengeId - The challenge ID
   * @param solution - The computed solution
   * @param signature - Signed solution message
   */
  async agentSubmitSolution(
    address: string,
    challengeId: string,
    solution: string,
    signature: string
  ): Promise<SolutionResult> {
    return this.call<SolutionResult>("agent_submitSolution", [
      address,
      challengeId,
      solution,
      signature,
    ]);
  }

  // ─── Standard Ethereum RPC ───────────────────────────────────────

  /**
   * Get ETH (PLM) balance of an address.
   * @param address - The wallet address
   */
  async getBalance(address: string): Promise<string> {
    return this.call<string>("eth_getBalance", [address, "latest"]);
  }

  /**
   * Send a raw signed transaction.
   * @param signedTx - The signed transaction hex string
   */
  async sendRawTransaction(signedTx: string): Promise<string> {
    return this.call<string>("eth_sendRawTransaction", [signedTx]);
  }

  /**
   * Get the current nonce for an address.
   * @param address - The wallet address
   */
  async getTransactionCount(address: string): Promise<string> {
    return this.call<string>("eth_getTransactionCount", [address, "latest"]);
  }

  /**
   * Get the current gas price.
   */
  async getGasPrice(): Promise<string> {
    return this.call<string>("eth_gasPrice", []);
  }

  /**
   * Get the current block number.
   */
  async getBlockNumber(): Promise<string> {
    return this.call<string>("eth_blockNumber", []);
  }

  /**
   * Get the chain ID.
   */
  async getChainId(): Promise<string> {
    return this.call<string>("eth_chainId", []);
  }
}
