import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured, getUserByEmail, upsertUser, createTx } from '../_db'
import { isCircleConfigured, sendUsdc } from '../_circle'
import { sendPaymentNotification, sendPaymentReceipt } from '../_email'
import { randomUUID } from 'crypto'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { senderEmail, recipientEmail, amount, message } = req.body as {
    senderEmail?: string; recipientEmail?: string; amount?: string | number; message?: string
  }

  if (!senderEmail || !recipientEmail || !amount) {
    return res.status(400).json({ error: 'senderEmail, recipientEmail, and amount are required.' })
  }
  if (senderEmail === recipientEmail) {
    return res.status(400).json({ error: 'You cannot send money to yourself.' })
  }

  if (!isSupabaseConfigured()) return res.status(501).json({ error: 'Supabase not configured.' })
  if (!isCircleConfigured()) return res.status(501).json({ error: 'Circle not configured.' })

  const amountStr = String(amount)

  try {
    const sender = await getUserByEmail(senderEmail)
    if (!sender?.wallet_id) {
      return res.status(400).json({ error: 'Sender wallet not provisioned. Please visit the Wallet page first.' })
    }

    let recipient = await getUserByEmail(recipientEmail)
    if (!recipient) {
      const newId = randomUUID()
      await upsertUser({ id: newId, email: recipientEmail })
      recipient = await getUserByEmail(recipientEmail)
    }

    const recipientAddress = recipient?.wallet_address ?? null

    const tx = await createTx({
      senderEmail, senderId: sender.id,
      recipientEmail, amount: amountStr,
      status: 'PENDING', message,
    })

    if (!recipientAddress) {
      await sendPaymentNotification({ recipientEmail, senderEmail, amount: amountStr, note: message })
      return res.json({
        transactionId: tx.id,
        status: 'PENDING_RECIPIENT',
        message: 'Recipient does not have a wallet yet. Funds will be sent when they sign up.',
      })
    }

    const { circleTransactionId, status } = await sendUsdc({
      senderWalletId: sender.wallet_id,
      recipientAddress,
      amount: amountStr,
      idempotencyKey: randomUUID(),
    })

    await sendPaymentNotification({ recipientEmail, senderEmail, amount: amountStr, note: message, circleTransactionId })
    await sendPaymentReceipt({ senderEmail, recipientEmail, amount: amountStr, note: message, circleTransactionId })

    return res.json({
      transactionId: tx.id,
      circleTransactionId,
      status,
    })
  } catch (err) {
    console.error('[wallet/send] error:', err)
    return res.status(500).json({ error: String(err) })
  }
}
