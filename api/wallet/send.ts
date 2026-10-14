import { createClient } from '@supabase/supabase-js'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'
import { Resend } from 'resend'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { senderEmail, recipientEmail, amount, message } = req.body
  if (!senderEmail || !recipientEmail || !amount) return res.status(400).json({ error: 'Missing required fields' })

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

  // Get sender wallet
  const { data: sender } = await db.from('users').select('*').eq('email', senderEmail).maybeSingle()
  if (!sender?.wallet_id) return res.status(400).json({ error: 'Sender wallet not found. Please provision your wallet first.' })

  // Get or create recipient user
  let { data: recipient } = await db.from('users').select('*').eq('email', recipientEmail).maybeSingle()
  if (!recipient) {
    const newId = crypto.randomUUID()
    await db.from('users').insert({ id: newId, email: recipientEmail, name: null, wallet_id: null, wallet_address: null })
    const { data: r } = await db.from('users').select('*').eq('email', recipientEmail).maybeSingle()
    recipient = r
  }

  // Create transaction record
  const txId = crypto.randomUUID()
  await db.from('transactions').insert({
    id: txId, sender_id: sender.id, sender_email: senderEmail,
    recipient_email: recipientEmail, amount, currency: 'USDC',
    message: message || null, status: 'INITIATED',
  })

  try {
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    })

    // Get recipient wallet address — create if needed
    let recipientAddress = recipient?.wallet_address
    if (!recipientAddress) {
      const rResp = await client.createWallets({
        blockchains: ['ARC-TESTNET'], count: 1,
        walletSetId: process.env.CIRCLE_WALLET_SET_ID!,
        idempotencyKey: `avero-recv-${recipientEmail}-${Date.now()}`,
      })
      const rWallet = rResp.data?.wallets?.[0]
      if (rWallet) {
        recipientAddress = rWallet.address
        await db.from('users').update({ wallet_id: rWallet.id, wallet_address: rWallet.address }).eq('email', recipientEmail)
      }
    }
    if (!recipientAddress) return res.status(500).json({ error: 'Could not provision recipient wallet' })

    // Send USDC
    const sendResp = await client.createTransaction({
      walletId: sender.wallet_id,
      tokenId: '15dc2b5d-0994-58b0-bf8c-3a0501148ee8',
      destinationAddress: recipientAddress,
      amounts: [amount],
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } },
      idempotencyKey: `avero-tx-${txId}`,
    })

    const tx = sendResp.data?.transaction || sendResp.data
    if (!tx?.id) return res.status(500).json({ error: 'Circle createTransaction returned no transaction' })

    const explorerUrl = `https://explorer.testnet.arc.io/tx/${tx.txHash || tx.id}`
    await db.from('transactions').update({
      status: tx.state || 'INITIATED',
      circle_transaction_id: tx.id,
      tx_hash: tx.txHash || null,
      block_explorer_url: tx.txHash ? explorerUrl : null,
    }).eq('id', txId)

    // Send notification email to recipient
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from: process.env.VITE_FROM_EMAIL || 'onboarding@resend.dev',
          to: recipientEmail,
          subject: `You received ${amount} USDC on Avero`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
            <h2 style="color:#050505">You have USDC waiting</h2>
            <p><strong>${senderEmail}</strong> sent you <strong>${amount} USDC</strong> on Avero.</p>
            ${message ? `<p style="color:#666;font-style:italic">"${message}"</p>` : ''}
            <a href="https://useavero.xyz" style="display:inline-block;background:#050505;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;margin-top:16px">Open Avero</a>
            <p style="color:#999;font-size:12px;margin-top:24px">Transaction ID: ${tx.id}</p>
          </div>`,
        })
      } catch (emailErr) { console.error('Email error:', emailErr) }
    }

    return res.status(200).json({ transactionId: tx.id, status: tx.state || 'INITIATED', explorerUrl })
  } catch (e) {
    await db.from('transactions').update({ status: 'FAILED' }).eq('id', txId)
    return res.status(500).json({ error: String(e) })
  }
}
