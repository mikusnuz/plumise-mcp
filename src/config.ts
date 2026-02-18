export interface PlumiseConfig {
  /** RPC URL override (uses plumise-core default if empty) */
  rpcUrl: string
  /** Private key for signing transactions (hex, with 0x prefix) */
  privateKey: string
  /** Network: 'mainnet' | 'testnet' */
  network: 'mainnet' | 'testnet'
  /** Inference API URL for consumer tools */
  inferenceApiUrl: string
}

export function loadConfig(): PlumiseConfig {
  return {
    rpcUrl: process.env.PLUMISE_RPC_URL || '',
    privateKey: process.env.PLUMISE_PRIVATE_KEY || '',
    network: (process.env.PLUMISE_NETWORK as 'mainnet' | 'testnet') || 'mainnet',
    inferenceApiUrl: process.env.PLUMISE_INFERENCE_API_URL || 'https://inference.plumise.com',
  }
}
