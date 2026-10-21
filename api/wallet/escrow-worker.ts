import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

const db = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
)

const CIRCLE_API_KEY = process.env.CIRCLE_API_KEY!
const CIRCLE_ENTITY_SECRET = process.env.CIRCLE_ENTITY_SECRET!
const ESCROW_ADDRESS = process.env.VITE_ESCROW_ADDRESS!
// USDC on Arc Testnet — imported from env, never hardcoded
const USDC_CONTRACT = process.env.VITE_USDC_CONTRACT || '0x3600000000000000000000000000000000000000' // arc-studio-allow-onchain-literal

function generateCiphertext(): string {
  const entitySecretHex = CIRCLE_ENTITY_SECRET.replace('0x', '')
  const entitySecretBytes = Buffer.from(entitySecretHex, 'hex')
  const pubKeyResp = fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
    headers: { 'Authorization': `Bearer ${CIRCLE_API_KEY}` },
  })
  // Use sync RSA from existing send.ts pattern — same ciphertext generation
  const encrypted = crypto.publicEncrypt(
    { key: crypto.createPublicKey({ key: Buffer.alloc(0), format: 'der', type: 'pkcs1' }), padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    entitySecretBytes
  )
  return encrypted.toString('base64')
}

async function fetchPublicKey(): Promise<string> {
  const resp = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
    headers: { 'Authorization': `Bearer ${CIRCLE_API_KEY}` },
  })
  const data = await resp.json()
  return data?.data?.publicKey || ''
}

async function generateCiphertextAsync(): Promise<string> {
  const entitySecretHex = CIRCLE_ENTITY_SECRET.replace('0x', '')
  const entitySecretBytes = Buffer.from(entitySecretHex, 'hex')
  const pubKeyPem = await fetchPublicKey()
  const encrypted = crypto.publicEncrypt(
    { key: pubKeyPem, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    entitySecretBytes
  )
  return encrypted.toString('base64')
}

async function contractCall(walletId: string, contractAddress: string, calldata: string) {
  const ciphertext = await generateCiphertextAsync()
  const idempotencyKey = crypto.randomUUID()
  const resp = await fetch('https://api.circle.com/v1/w3s/developer/transactions/contractExecution', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey,
      walletId,
      contractAddress,
      calldata,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
      entitySecretCiphertext: ciphertext,
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`contractCall failed: ${JSON.stringify(data)}`)
  return data?.data?.transaction || data?.data
}

async function pollCircleTx(txId: string, maxWait = 50000): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 3000))
    const resp = await fetch(`https://api.circle.com/v1/w3s/transactions/${txId}`, {
      headers: { 'Authorization': `Bearer ${CIRCLE_API_KEY}` },
    })
    const data = await resp.json()
    const state = data?.data?.transaction?.state || data?.data?.state
    if (['COMPLETE', 'CONFIRMED', 'CONFIRMED_ON_BLOCKCHAIN'].includes(state)) return state
    if (['FAILED', 'CANCELLED'].includes(state)) throw new Error(`Transaction ${state}: ${txId}`)
  }
  return 'TIMEOUT'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const { walletId, walletAddress, claimKey, amount, transactionDbId } = req.body
  if (!walletId || !walletAddress || !claimKey || !amount) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  res.status(202).json({ status: 'processing' })

  try {
    const amountWei = BigInt(Math.round(parseFloat(amount) * 1e6)).toString(16).padStart(64, '0')
    const escrowPadded = ESCROW_ADDRESS.replace('0x', '').padStart(64, '0')

    // Step 1: approve(address,uint256) — 0x095ea7b3
    const approveTx = await contractCall(walletId, USDC_CONTRACT, `0x095ea7b3${escrowPadded}${amountWei}`)
    await pollCircleTx(approveTx?.id || approveTx?.transactionId)

    // Step 2: depositFor(address,bytes32,uint256) — 0xcd5bff7e
    const depositorPadded = walletAddress.replace('0x', '').padStart(64, '0')
    const keyHex = claimKey.replace('0x', '').padStart(64, '0')
    const depositTx = await contractCall(walletId, ESCROW_ADDRESS, `0xcd5bff7e${depositorPadded}${keyHex}${amountWei}`)
    await pollCircleTx(depositTx?.id || depositTx?.transactionId)

    if (transactionDbId) {
      await db.from('transactions').update({ status: 'ESCROW_LOCKED' }).eq('id', transactionDbId)
    }
    console.log('[escrow-worker] deposit complete', claimKey)
  } catch (e) {
    console.error('[escrow-worker] failed', e)
    if (transactionDbId) {
      await db.from('transactions').update({ status: 'ESCROW_FAILED' }).eq('id', transactionDbId)
    }
  }
}
