import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

const CIRCLE_API = 'https://api.circle.com/v1/w3s'
const ESCROW_ADDRESS = process.env.VITE_ESCROW_ADDRESS!
const ESCROW_SIGNER_PRIVATE_KEY = process.env.ESCROW_SIGNER_PRIVATE_KEY!
const CHAIN_ID = 5042002 // Arc Testnet

function generateEntitySecretCiphertext(entitySecret: string, publicKey: string): string {
  const entitySecretBytes = Buffer.from(entitySecret, 'hex')
  const pubKey = crypto.createPublicKey({
    key: publicKey.includes('BEGIN') ? publicKey : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`,
    format: 'pem',
  })
  const encrypted = crypto.publicEncrypt(
    { key: pubKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    entitySecretBytes
  )
  return encrypted.toString('base64')
}

async function getEntitySecretCiphertext(): Promise<string> {
  const pkResp = await fetch(`${CIRCLE_API}/config/entity/publicKey`, {
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}` },
  })
  const pkData = await pkResp.json()
  return generateEntitySecretCiphertext(process.env.CIRCLE_ENTITY_SECRET!, pkData.data?.publicKey)
}

async function getOrCreateWallet(db: ReturnType<typeof createClient>, email: string): Promise<{ walletId: string; address: string }> {
  const { data: existing } = await db.from('users').select('wallet_id, wallet_address').eq('email', email).maybeSingle()
  if (existing?.wallet_id && existing?.wallet_address) {
    return { walletId: existing.wallet_id, address: existing.wallet_address }
  }
  const ciphertext = await getEntitySecretCiphertext()
  const resp = await fetch(`${CIRCLE_API}/developer/wallets`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: ciphertext,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      blockchains: ['ARC-TESTNET'],
      count: 1,
      metadata: [{ name: email, refId: email }],
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`Wallet creation failed: ${JSON.stringify(data)}`)
  const wallet = data.data?.wallets?.[0]
  if (!wallet) throw new Error('No wallet returned')
  await db.from('users').upsert({ email, wallet_id: wallet.id, wallet_address: wallet.address }, { onConflict: 'email' })
  return { walletId: wallet.id, address: wallet.address }
}

// Sign the release message with the backend signer key
// Message: keccak256(abi.encodePacked(depositId, recipient, chainId))
function signRelease(depositId: number, recipientAddress: string): string {
  const privateKeyHex = ESCROW_SIGNER_PRIVATE_KEY.replace('0x', '')
  const privateKeyBytes = Buffer.from(privateKeyHex, 'hex')

  // Pack: depositId (uint256 = 32 bytes) + recipient (address = 20 bytes, right-aligned in 32 bytes) + chainId (uint256 = 32 bytes)
  const buf = Buffer.alloc(96)
  // depositId as uint256 big-endian
  const idBig = BigInt(depositId)
  for (let i = 0; i < 32; i++) {
    buf[31 - i] = Number((idBig >> BigInt(8 * i)) & BigInt(0xff))
  }
  // recipient as address (20 bytes) right-padded in 32 bytes
  const addrBytes = Buffer.from(recipientAddress.replace('0x', ''), 'hex')
  addrBytes.copy(buf, 44) // offset 32 + 12 padding = 44
  // chainId as uint256 big-endian
  const chainBig = BigInt(CHAIN_ID)
  for (let i = 0; i < 32; i++) {
    buf[95 - i] = Number((chainBig >> BigInt(8 * i)) & BigInt(0xff))
  }

  // keccak256 of packed bytes
  const hash = crypto.createHash('sha3-256').update(buf).digest()

  // Ethereum prefix: "\x19Ethereum Signed Message:\n32"
  const prefix = Buffer.from('\x19Ethereum Signed Message:\n32')
  const prefixedHash = crypto.createHash('sha3-256').update(Buffer.concat([prefix, hash])).digest()

  // Sign with secp256k1
  const sign = crypto.sign(null, prefixedHash, { key: Buffer.concat([Buffer.from('302e0201010420', 'hex'), privateKeyBytes, Buffer.from('a00706052b8104000a', 'hex')]), format: 'der', type: 'sec1', dsaEncoding: 'ieee-p1363' })

  return '0x' + sign.toString('hex')
}

async function escrowReleaseTo(depositId: number, recipientAddress: string, recipientWalletId: string): Promise<unknown> {
  const signature = signRelease(depositId, recipientAddress)

  // ABI encode: releaseTo(uint256 depositId, address recipient, bytes signature)
  // selector: keccak256("releaseTo(uint256,address,bytes)") 
  const selector = '0cecb4b3' // keccak256("releaseTo(uint256,address,bytes)")
  const idHex = depositId.toString(16).padStart(64, '0')
  const addrHex = recipientAddress.replace('0x', '').padStart(64, '0')
  // bytes offset = 96 (3 * 32)
  const bytesOffset = (96).toString(16).padStart(64, '0')
  const sigBytes = Buffer.from(signature.replace('0x', ''), 'hex')
  const sigLen = sigBytes.length.toString(16).padStart(64, '0')
  const sigData = sigBytes.toString('hex').padEnd(Math.ceil(sigBytes.length / 32) * 64, '0')
  const calldata = `0x${selector}${idHex}${addrHex}${bytesOffset}${sigLen}${sigData}`

  const ciphertext = await getEntitySecretCiphertext()

  const resp = await fetch(`${CIRCLE_API}/developer/transactions/contractExecution`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: ciphertext,
      walletId: recipientWalletId,
      contractAddress: ESCROW_ADDRESS,
      callData: calldata,
      feeLevel: 'MEDIUM',
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`releaseTo failed: ${JSON.stringify(data)}`)
  return data.data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { claimKey, recipientEmail } = req.body
  if (!claimKey || !recipientEmail) return res.status(400).json({ error: 'Missing claimKey or recipientEmail' })

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

  const { data: tx } = await db
    .from('transactions')
    .select('id, amount, deposit_id')
    .eq('claim_key', claimKey)
    .eq('status', 'PENDING_CLAIM')
    .maybeSingle()

  if (!tx) return res.status(404).json({ error: 'Claim not found or already used' })

  try {
    const { address: recipientAddress, walletId: recipientWalletId } = await getOrCreateWallet(db, recipientEmail)
    const depositId = tx.deposit_id || 1

    const releaseTx = await escrowReleaseTo(depositId, recipientAddress, recipientWalletId)

    await db.from('transactions').update({ status: 'COMPLETE' }).eq('id', tx.id)

    return res.status(200).json({
      success: true,
      transactionId: (releaseTx as { id?: string })?.id,
      recipientAddress,
      message: 'USDC released from escrow to your wallet',
    })
  } catch (e) {
    console.error('Claim error:', e)
    return res.status(500).json({ error: String(e) })
  }
}
