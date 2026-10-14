import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import * as crypto from 'crypto'

function generateEntitySecretCiphertext(entitySecret: string, publicKey: string): string {
  const entitySecretBytes = Buffer.from(entitySecret, 'hex')
  const pubKey = crypto.createPublicKey({
    key: Buffer.from(publicKey, 'base64'),
    format: 'der',
    type: 'spki',
  })
  const encrypted = crypto.publicEncrypt(
    { key: pubKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    entitySecretBytes
  )
  return encrypted.toString('base64')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { senderEmail, recipientEmail, amount, note, walletId } = req.body
  if (!senderEmail || !recipientEmail || !amount || !walletId)
    return res.status(400).json({ error: 'Missing required fields' })

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

  // Get recipient wallet address
  const { data: recipient } = await db.from('users').select('wallet_address, wallet_id').eq('email', recipientEmail).maybeSingle()

  // If no recipient wallet, create pending user
  let recipientAddress = recipient?.wallet_address
  if (!recipientAddress) {
    // Store pending transaction — recipient claims when they sign up
    const txId = crypto.randomUUID()
    await db.from('transactions').insert({
      id: txId,
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      amount: String(amount),
      currency: 'USDC',
      message: note || '',
      status: 'PENDING_CLAIM',
    })
    // Send claim email
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.VITE_FROM_EMAIL || 'onboarding@resend.dev',
        to: recipientEmail,
        subject: `${senderEmail} sent you USDC on Avero`,
        html: `<p>${senderEmail} sent you <strong>$${amount} USDC</strong> on Avero. <a href="https://useavero.xyz">Sign up to claim it</a>.</p>`,
      })
    } catch (_) {}
    return res.status(200).json({ transactionId: txId, status: 'PENDING_CLAIM', message: 'Recipient not yet on Avero — funds held pending claim' })
  }

  // Execute Circle transfer via REST
  try {
    const sendResp = await fetch('https://api.circle.com/v1/w3s/developer/transactions/transfer', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        entitySecretCiphertext: await (async () => {
          const pkResp = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
            headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` },
          })
          const pkData = await pkResp.json()
          return generateEntitySecretCiphertext(process.env.CIRCLE_ENTITY_SECRET!, pkData.data?.publicKey)
        })(),
        walletId,
        destinationAddress: recipientAddress,
        tokenId: '15dc2b5d-0994-58b0-bf8c-3a0501148ee8',
        amounts: [String(amount)],
        feeLevel: 'MEDIUM',
      }),
    })
    const sendData = await sendResp.json()
    if (!sendResp.ok) return res.status(500).json({ error: JSON.stringify(sendData) })

    const tx = sendData.data
    const circleTransactionId = tx?.id || tx?.transaction?.id
    const status = tx?.state || tx?.transaction?.state || 'INITIATED'

    // Save to Supabase
    const txRecord = {
      sender_email: senderEmail,
      recipient_email: recipientEmail,
      amount: String(amount),
      currency: 'USDC',
      message: note || '',
      status,
      circle_transaction_id: circleTransactionId,
      block_explorer_url: circleTransactionId ? `https://explorer.testnet.arc.io/tx/${circleTransactionId}` : null,
    }
    const { data: saved } = await db.from('transactions').insert(txRecord).select().maybeSingle()

    // Send notification email
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from: process.env.VITE_FROM_EMAIL || 'onboarding@resend.dev',
        to: recipientEmail,
        subject: `You received $${amount} USDC from ${senderEmail}`,
        html: `<p><strong>${senderEmail}</strong> sent you <strong>$${amount} USDC</strong> on Avero. <a href="https://useavero.xyz">View in your dashboard</a>.</p>${note ? `<p>Note: ${note}</p>` : ''}`,
      })
    } catch (_) {}

    return res.status(200).json({ transactionId: circleTransactionId || saved?.id, status })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
