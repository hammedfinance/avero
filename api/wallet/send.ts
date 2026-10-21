import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import * as crypto from 'crypto'

const ESCROW_ADDRESS = process.env.VITE_ESCROW_ADDRESS!
const USDC_TOKEN_ID = '15dc2b5d-0994-58b0-bf8c-3a0501148ee8'
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

async function circleTransfer(walletId: string, destinationAddress: string, amount: string, ciphertext: string) {
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

const USDC_CONTRACT = '0x3600000000000000000000000000000000000000'

async function approveUsdc(walletId: string, amount: string, ciphertext: string) {
  // Encode approve(address spender, uint256 amount)
  // selector: keccak256("approve(address,uint256)") = 0x095ea7b3
  const selector = '095ea7b3'
  const spender = ESCROW_ADDRESS.replace('0x', '').padStart(64, '0')
  const amountWei = BigInt(Math.round(parseFloat(amount) * 1_000_000)).toString(16).padStart(64, '0')
  const calldata = `0x${selector}${spender}${amountWei}`

  const resp = await fetch(`${CIRCLE_API}/developer/transactions/contractExecution`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: ciphertext,
      walletId,
      contractAddress: USDC_CONTRACT,
      callData: calldata,
      feeLevel: 'MEDIUM',
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`Approve failed: ${JSON.stringify(data)}`)
  // Wait briefly for approval to land
  await new Promise(r => setTimeout(r, 3000))
  return data.data
}

async function escrowDeposit(walletId: string, amount: string, claimKey: string, ciphertext: string) {
  // First approve USDC spending
  await approveUsdc(walletId, amount, ciphertext)

  // Encode deposit(bytes32 claimKey, uint256 amount)
  // selector: keccak256("deposit(bytes32,uint256)") = 0x47e7ef24
  const selector = '47e7ef24'
  const keyHex = claimKey.replace('0x', '').padStart(64, '0')
  const amountWei = BigInt(Math.round(parseFloat(amount) * 1_000_000)).toString(16).padStart(64, '0')
  const calldata = `0x${selector}${keyHex}${amountWei}`

  const resp = await fetch(`${CIRCLE_API}/developer/transactions/contractExecution`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      idempotencyKey: crypto.randomUUID(),
      entitySecretCiphertext: ciphertext,
      walletId,
      contractAddress: ESCROW_ADDRESS,
      callData: calldata,
      feeLevel: 'MEDIUM',
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(`Deposit failed: ${JSON.stringify(data)}`)
  return data.data
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { senderEmail, recipientEmail, amount, note, walletId } = req.body
  if (!senderEmail || !recipientEmail || !amount || !walletId)
    return res.status(400).json({ error: 'Missing required fields' })

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

  const { data: recipient } = await db
    .from('users')
    .select('wallet_address, wallet_id')
    .eq('email', recipientEmail)
    .maybeSingle()

  try {
    const ciphertext = await getEntitySecretCiphertext()

    if (!recipient?.wallet_address) {
      // NEW RECIPIENT — lock funds in escrow contract
      const claimKey = '0x' + crypto.randomBytes(32).toString('hex')
      const tx = await escrowDeposit(walletId, amount, claimKey, ciphertext)
      const circleTransactionId = tx?.id || tx?.transaction?.id

      const { data: saved } = await db.from('transactions').insert({
        sender_email: senderEmail,
        recipient_email: recipientEmail,
        amount: String(amount),
        currency: 'USDC',
        message: note || '',
        status: 'PENDING_CLAIM',
        circle_transaction_id: circleTransactionId,
        claim_key: claimKey,
        block_explorer_url: circleTransactionId
          ? `https://explorer.testnet.arc.io/tx/${circleTransactionId}`
          : null,
      }).select().maybeSingle()

      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        const emailResult = await resend.emails.send({
          from: 'Avero <noreply@useavero.xyz>',
          to: recipientEmail,
          subject: `${senderEmail} sent you $${amount} USDC on Avero`,
          html: `<p><strong>${senderEmail}</strong> sent you <strong>$${amount} USDC</strong> on Avero.</p><p><a href="https://useavero.xyz/pay/claim?key=${encodeURIComponent(claimKey)}">Click here to claim your USDC</a> — funds are held securely in an escrow smart contract.</p>${note ? `<p>Note: ${note}</p>` : ''}`,
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
    const tx = await circleTransfer(walletId, recipient.wallet_address, amount, ciphertext)
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
        subject: `You received $${amount} USDC from ${senderEmail}`,
        html: `<p><strong>${senderEmail}</strong> sent you <strong>$${amount} USDC</strong> on Avero.</p><p><a href="https://useavero.xyz">View in your dashboard</a>.</p>${note ? `<p>Note: ${note}</p>` : ''}`,
      })
      console.log('[Resend direct email]', JSON.stringify(emailResult))
    } catch (emailErr) { console.error('[Resend direct error]', emailErr) }

    return res.status(200).json({ transactionId: circleTransactionId || saved?.id, status })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
