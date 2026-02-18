import { createPlumiseClient, type PlumiseClient } from '@plumise/core'
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts'
import type { PlumiseConfig } from './config.js'

let _client: PlumiseClient | null = null
let _account: PrivateKeyAccount | null = null

export function initClient(config: PlumiseConfig) {
  const key = config.privateKey.startsWith('0x') ? config.privateKey : `0x${config.privateKey}`
  _account = privateKeyToAccount(key as `0x${string}`)

  _client = createPlumiseClient({
    chain: config.network,
    rpcUrl: config.rpcUrl,
    account: _account,
  })
}

export function getClient(): PlumiseClient {
  if (!_client) throw new Error('Client not initialized. Call initClient() first.')
  return _client
}

export function getAccount(): PrivateKeyAccount {
  if (!_account) throw new Error('Account not initialized. Call initClient() first.')
  return _account
}
