/**
 * Avero — Circle developer-controlled wallets helper
 * Arc Testnet blockchain key in Circle's API: 'ARC-TESTNET'
 */

import {
  initiateDeveloperControlledWalletsClient,
  type WalletResponse,
} from '@circle-fin/developer-controlled-wallets'

let _sdk: ReturnType<typeof initiateDeveloperControlledWalletsClient> | null = null

export function getCircleSDK() {
  if (_sdk) return _sdk
  const apiKey = process.env.CIRCLE_API_KEY
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET
  if (!apiKey || !entitySecret) throw new Error('CIRCLE_NOT_CONFIGURED')
  _sdk = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
  return _sdk
}

export function isCircleConfigured(): boolean {
  return !!(
    process.env.CIRCLE_API_KEY &&
    process.env.CIRCLE_ENTITY_SECRET &&
    process.env.CIRCLE_WALLET_SET_ID
  )
}

export function getWalletSetId(): string {
  const id = process.env.CIRCLE_WALLET_SET_ID
  if (!id) throw new Error('CIRCLE_WALLET_SET_ID not set')
  return id
}

// ── Wallet creation ──────────────────────────────────────────

export async function createUserWallet(userRef: string): Promise<{
  walletId: string
  address: string
}> {
  const sdk = getCircleSDK()
  const walletSetId = getWalletSetId()

  const res = await sdk.createWallets({
    blockchains: ['ARC-TESTNET'],
    count: 1,
    walletSetId,
    metadata: [{ name: `avero-${userRef.slice(0, 24)}`, refId: userRef }],
  })

  const wallet = res.data?.wallets?.[0] as WalletResponse | undefined
  if (!wallet?.id || !wallet?.address) {
    throw new Error('Wallet creation returned no wallet data')
  }

  return { walletId: wallet.id, address: wallet.address }
}

// ── Balance ──────────────────────────────────────────────────

export async function getWalletBalance(walletId: string): Promise<{
  usdcBalance: string
  nativeBalance: string | null
}> {
  const sdk = getCircleSDK()
  const res = await sdk.getWalletTokenBalance({ id: walletId })
  const balances = res.data?.tokenBalances ?? []

  // On Arc, USDC IS the native token — match by symbol or isNative
  const usdc = balances.find(
    (b) => b.token?.symbol?.toUpperCase() === 'USDC' || b.token?.isNative
  )

  return {
    usdcBalance: usdc?.amount ?? '0',
    nativeBalance: usdc?.amount ?? null,
  }
}

// ── Transfer USDC ────────────────────────────────────────────
// On Arc Testnet, USDC is the native gas token.
// Circle requires tokenId to identify the asset.
// Native USDC token ID on ARC-TESTNET: 15dc2b5d-0994-58b0-bf8c-3a0501148ee8

const ARC_TESTNET_USDC_TOKEN_ID = '15dc2b5d-0994-58b0-bf8c-3a0501148ee8'

export async function sendUsdc(params: {
  senderWalletId: string
  recipientAddress: string
  amount: string
  idempotencyKey: string
}): Promise<{
  circleTransactionId: string
  status: string
}> {
  const sdk = getCircleSDK()

  const res = await sdk.createTransaction({
    walletId: params.senderWalletId,
    blockchain: 'ARC-TESTNET',
    tokenId: ARC_TESTNET_USDC_TOKEN_ID,
    destinationAddress: params.recipientAddress,
    amounts: [params.amount],
    idempotencyKey: params.idempotencyKey,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })

  // Circle SDK returns the transaction directly at res.data, not res.data.transaction
  const tx = (res.data as { id?: string; state?: string } | null)
  if (!tx?.id) {
    console.error('[sendUsdc] unexpected response:', JSON.stringify(res.data))
    throw new Error('Circle createTransaction returned no transaction')
  }

  return {
    circleTransactionId: tx.id,
    status: tx.state ?? 'INITIATED',
  }
}

// ── List wallets by refId ────────────────────────────────────

export async function getWalletsByUser(userId: string): Promise<WalletResponse[]> {
  const sdk = getCircleSDK()
  const res = await sdk.listWallets({ refId: userId })
  return (res.data?.wallets ?? []) as WalletResponse[]
}
