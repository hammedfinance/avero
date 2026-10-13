/**
 * Avero — Circle developer-controlled wallets helper (Vercel API routes)
 */
import {
  initiateDeveloperControlledWalletsClient,
  type WalletResponse,
} from '@circle-fin/developer-controlled-wallets'

export function isCircleConfigured(): boolean {
  return !!(process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET && process.env.CIRCLE_WALLET_SET_ID)
}

function getSDK() {
  const apiKey = process.env.CIRCLE_API_KEY
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET
  if (!apiKey || !entitySecret) throw new Error('CIRCLE_NOT_CONFIGURED')
  return initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
}

export async function createUserWallet(userRef: string): Promise<{ walletId: string; address: string }> {
  const sdk = getSDK()
  const walletSetId = process.env.CIRCLE_WALLET_SET_ID
  if (!walletSetId) throw new Error('CIRCLE_WALLET_SET_ID not set')

  const res = await sdk.createWallets({
    blockchains: ['ARC-TESTNET'],
    count: 1,
    walletSetId,
    metadata: [{ name: `avero-${userRef.slice(0, 24)}`, refId: userRef }],
  })

  const wallet = res.data?.wallets?.[0] as WalletResponse | undefined
  if (!wallet?.id || !wallet?.address) throw new Error('Wallet creation returned no wallet data')
  return { walletId: wallet.id, address: wallet.address }
}

export async function getWalletBalance(walletId: string): Promise<{ usdcBalance: string }> {
  const sdk = getSDK()
  const res = await sdk.getWalletTokenBalance({ id: walletId })
  const balances = res.data?.tokenBalances ?? []
  const usdc = balances.find((b) => b.token?.symbol?.toUpperCase() === 'USDC' || b.token?.isNative)
  return { usdcBalance: usdc?.amount ?? '0' }
}

// Arc Testnet native USDC token ID
const ARC_TESTNET_USDC_TOKEN_ID = '15dc2b5d-0994-58b0-bf8c-3a0501148ee8'

export async function sendUsdc(params: {
  senderWalletId: string; recipientAddress: string; amount: string; idempotencyKey: string
}): Promise<{ circleTransactionId: string; status: string }> {
  const sdk = getSDK()
  const res = await sdk.createTransaction({
    walletId: params.senderWalletId,
    blockchain: 'ARC-TESTNET',
    tokenId: ARC_TESTNET_USDC_TOKEN_ID,
    destinationAddress: params.recipientAddress,
    amounts: [params.amount],
    idempotencyKey: params.idempotencyKey,
    fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
  })
  const tx = res.data as { id?: string; state?: string } | null
  if (!tx?.id) throw new Error('Circle createTransaction returned no transaction')
  return { circleTransactionId: tx.id, status: tx.state ?? 'INITIATED' }
}

export async function getTransactionStatus(circleTransactionId: string): Promise<{
  status: string; txHash: string | null; blockExplorerUrl: string | null
}> {
  const sdk = getSDK()
  const res = await sdk.getTransaction({ id: circleTransactionId })
  const tx = res.data?.transaction as { state?: string; txHash?: string } | undefined
  const state = tx?.state ?? 'UNKNOWN'
  const txHash = tx?.txHash ?? null
  const blockExplorerUrl = txHash ? `https://explorer.testnet.arc.io/tx/${txHash}` : null
  return { status: state, txHash, blockExplorerUrl }
}
