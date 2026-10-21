import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import * as crypto from 'crypto'

const ESCROW_ADDRESS = process.env.VITE_ESCROW_ADDRESS!
const USDC_TOKEN_ID = '15dc2b5d-0994-58b0-bf8c-3a0501148ee8'
const USDC_CONTRACT = '0x3600000000000000000000000000000000000000'
const CIRCLE_API = 'https://api.circle.com/v1/w3s'

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

async function circleTransfer(walletId: string, destinationAddress: string, amount: string) {
  const ciphertext = await getEntitySecretCiphertext()
  const resp = await fetch(`${CIRCLE_API}/developer/transactions/transfer`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: ciphertext,
      walletId,
      destinationAddress,
      tokenId: USDC_TOKEN_ID,
      amounts: [String(amount)],
      feeLevel: 'MEDIUM',
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(JSON.stringify(data))
  return data.data
}

async function contractCall(walletId: string, contractAddress: string, callData: string) {
  const ciphertext = await getEntitySecretCiphertext()
  const resp = await fetch(`${CIRCLE_API}/developer/transactions/contractExecution`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: ciphertext,
      walletId,
      contractAddress,
      callData,
      feeLevel: 'MEDIUM',
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(JSON.stringify(data))
  return data.data
}

async function pollCircleTx(txId: string, maxWait = 45000): Promise<string> {
  if (!txId) return 'UNKNOWN'
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 2000))
    const resp = await fetch(`${CIRCLE_API}/transactions/${txId}`, {
      headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}` },
    })
    const d = await resp.json()
    const state = d?.data?.transaction?.state || d?.data?.state
    if (state === 'COMPLETE' || state === 'CONFIRMED') return state
    if (state === 'FAILED' || state === 'CANCELLED') throw new Error(`Transaction ${state}: ${d?.data?.transaction?.errorReason}`)
  }
  return 'TIMEOUT'
}



export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { senderEmail, recipientEmail, amount, note, walletId, walletAddress } = req.body
  if (!senderEmail || !recipientEmail || !amount || !walletId)
    return res.status(400).json({ error: 'Missing required fields' })

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

  const { data: recipient } = await db
    .from('users')
    .select('wallet_address, wallet_id')
    .eq('email', recipientEmail)
    .maybeSingle()

  try {
    if (!recipient?.wallet_address) {
      // NEW RECIPIENT — lock funds in escrow contract (fire-and-forget worker)
      const claimKey = '0x' + crypto.randomBytes(32).toString('hex')
      const senderAddress = walletAddress || ''

      // Save transaction record immediately
      const { data: saved } = await db.from('transactions').insert({
        sender_email: senderEmail,
        recipient_email: recipientEmail,
        amount: String(amount),
        currency: 'USDC',
        message: note || '',
        status: 'PENDING_CLAIM',
        claim_key: claimKey,
      }).select().maybeSingle()

      // Fire escrow worker in background — do NOT await
      const workerUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/wallet/escrow-worker`
      fetch(workerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletId, walletAddress: senderAddress, claimKey, amount, transactionDbId: saved?.id }),
      }).catch(e => console.error('[escrow-worker fire]', e))

      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const emailResult = await resend.emails.send({
          from: 'Avero <noreply@useavero.xyz>',
          to: recipientEmail,
          subject: `You have USDC waiting on Avero`,
          html: `<p><strong>${senderEmail}</strong> sent you <strong>$${amount} USDC</strong> on Avero.</p><p><a href="https://useavero.xyz/pay/claim?key=${encodeURIComponent(claimKey)}">Click here to claim your USDC</a> — funds are held securely in an escrow smart contract on Arc.</p>${note ? `<p>Note: ${note}</p>` : ''}`,
        })
        console.log('[Resend escrow email]', JSON.stringify(emailResult))
      } catch (emailErr) { console.error('[Resend escrow error]', emailErr) }

      return res.status(200).json({
        transactionId: saved?.id || circleTransactionId,
        status: 'PENDING_CLAIM',
        escrowAddress: ESCROW_ADDRESS,
        message: 'Funds locked in escrow — recipient will receive an email to claim',
      })
    }

    // EXISTING RECIPIENT — direct Circle transfer
    const tx = await circleTransfer(walletId, recipient.wallet_address, amount)
    const circleTransactionId = tx?.id || tx?.transaction?.id
    const status = tx?.state || tx?.transaction?.state || 'INITIATED'

    const { data: saved } = await db.from('transactions').insert({
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      amount: String(amount),
      currency: 'USDC',
      message: note || '',
      status,
      circle_transaction_id: circleTransactionId,
      block_explorer_url: circleTransactionId
        ? `https://explorer.testnet.arc.io/tx/${circleTransactionId}`
        : null,
    }).select().maybeSingle()

    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const emailResult = await resend.emails.send({
        from: 'Avero <noreply@useavero.xyz>',
        to: recipientEmail,
        subject: `You received USDC on Avero`,
        html: `<p><strong>${senderEmail}</strong> sent you <strong>$${amount} USDC</strong> on Avero.</p><p><a href="https://useavero.xyz">View in your dashboard</a>.</p>${note ? `<p>Note: ${note}</p>` : ''}`,
      })
      console.log('[Resend direct email]', JSON.stringify(emailResult))
    } catch (emailErr) { console.error('[Resend direct error]', emailErr) }

    return res.status(200).json({ transactionId: circleTransactionId || saved?.id, status })
  } catch (e) {
    console.error('[send error]', e)
    return res.status(500).json({ error: String(e) })
  }
}
