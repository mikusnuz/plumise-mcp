/**
 * Heartbeat Service
 *
 * Maintains a periodic heartbeat loop to keep the agent registered
 * and alive on the Plumise network.
 */

import type { PrivateKeyAccount } from "viem/accounts";
import { RpcClient } from "./rpc-client.js";

export class HeartbeatService {
  private rpcClient: RpcClient;
  private account: PrivateKeyAccount;
  private intervalMs: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private _isRunning: boolean = false;
  private _lastHeartbeat: Date | null = null;
  private _heartbeatCount: number = 0;
  private _lastError: string | null = null;

  constructor(rpcClient: RpcClient, account: PrivateKeyAccount, intervalMs: number) {
    this.rpcClient = rpcClient;
    this.account = account;
    this.intervalMs = intervalMs;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get lastHeartbeat(): Date | null {
    return this._lastHeartbeat;
  }

  get heartbeatCount(): number {
    return this._heartbeatCount;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  /**
   * Start the heartbeat loop. Sends an immediate heartbeat, then
   * continues at the configured interval.
   */
  async start(): Promise<void> {
    if (this._isRunning) {
      return;
    }

    this._isRunning = true;
    this._lastError = null;

    // Send an immediate heartbeat
    await this.sendHeartbeat();

    // Schedule recurring heartbeats
    this.timer = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.intervalMs);
  }

  /**
   * Stop the heartbeat loop.
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this._isRunning = false;
  }

  /**
   * Send a single heartbeat to the network.
   */
  private async sendHeartbeat(): Promise<void> {
    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const message = `heartbeat:${this.account.address}:${timestamp}`;
      const signature = await this.account.signMessage({ message });

      await this.rpcClient.agentHeartbeat(this.account.address, signature);

      this._lastHeartbeat = new Date();
      this._heartbeatCount++;
      this._lastError = null;
    } catch (error) {
      this._lastError =
        error instanceof Error ? error.message : String(error);
      // Don't stop the loop on error; just log and continue
      console.error(`[heartbeat] Error: ${this._lastError}`);
    }
  }
}
