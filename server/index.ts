import express from 'express'
import cors from 'cors'
import {
  isSupabaseConfigured,
  getSupabase,
  upsertUser,
  getUserByEmail,
  getUserById,
  updateUserWallet,
  createTransaction,
  updateTransaction,
  getTransactionsByEmail,
  createPaymentLink,
  getPaymentLinksByUser,
} from './db'

import {
  isCircleConfigured,
  createUserWallet,
  getWalletBalance,
  sendUsdc,
} from './circle'

import {
  isEmailConfigured,
  sendPaymentNotification,
  sendPaymentReceipt,
  sendRequestNotification,
} from './email'

const app = express()
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001

app.use(cors({ origin: true, credentials: true }))
app.use(express.json())

// ── Helpers ───────────────────────────────────────────────────

function missingEnv(res: express.Response, boundary: string, envVars: string[]) {
  return res.status(501).json({
    error: `${boundary} is not configured. Add the required env vars and restart the server.`,
    boundary,
    requiredEnv: envVars,
  })
}

// ── Health ────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'avero-api',
    timestamp: new Date().toISOString(),
    supabase: isSupabaseConfigured(),
    circle: isCircleConfigured(),
    email: isEmailConfigured(),
  })
})

// ── Auth: upsert user on Dynamic login ───────────────────────
// Called by the frontend after Dynamic auth to persist the user
// and provision a Circle wallet if they don't have one yet.

app.post('/auth/upsert', async (req, res) => {
  const { id, email, name } = req.body as { id?: string; email?: string; name?: string }
  if (!id || !email) return res.status(400).json({ error: 'id and email are required.' })

  if (!isSupabaseConfigured()) {
    return missingEnv(res, 'Supabase', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  }

  try {
    // 1. Upsert user record (handles existing email gracefully)
    await upsertUser({ id, email, name })

    // 2. Fetch full user — look up by email since the Supabase ID may differ
    //    from the Dynamic user ID when the user was first created before Dynamic
    let user = await getUserByEmail(email)
    if (!user) user = await getUserById(id)

    // 3. Create a Circle wallet if none exists yet
    if (!user?.wallet_id && isCircleConfigured()) {
      try {
        const { walletId, address } = await createUserWallet(id)
        await updateUserWallet(id, walletId, address)
        const updated = await getUserById(id)
        return res.json({
          user: updated,
          walletProvisioned: true,
        })
      } catch (walletErr) {
        console.error('[/auth/upsert] wallet creation failed:', walletErr)
        // Non-fatal — user is saved, wallet will be retried later
        return res.json({ user, walletProvisioned: false, walletError: String(walletErr) })
      }
    }

    return res.json({ user, walletProvisioned: false })
  } catch (err) {
    console.error('[/auth/upsert] error:', err)
    return res.status(500).json({ error: 'Failed to upsert user.' })
  }
})

// ── Auth: legacy register / login (stub — Dynamic handles auth) ──

app.post('/auth/register', (_req, res) => {
  return res.status(410).json({
    error: 'Password auth is disabled. Avero uses Dynamic.xyz email login.',
  })
})

app.post('/auth/login', (_req, res) => {
  return res.status(410).json({
    error: 'Password auth is disabled. Avero uses Dynamic.xyz email login.',
  })
})

// ── Wallet: create (explicit, called if upsert missed it) ─────

app.post('/wallet/create', async (req, res) => {
  const { userId, email } = req.body as { userId?: string; email?: string }
  if (!userId) return res.status(400).json({ error: 'userId is required.' })

  if (!isCircleConfigured()) {
    return missingEnv(res, 'Circle', ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'CIRCLE_WALLET_SET_ID'])
  }

  try {
    const { walletId, address } = await createUserWallet(userId)

    if (isSupabaseConfigured()) {
      await upsertUser({ id: userId, email: email ?? '', walletId, walletAddress: address })
    }

    return res.json({ walletId, address })
  } catch (err) {
    console.error('[/wallet/create] error:', err)
    return res.status(500).json({ error: 'Failed to create wallet.' })
  }
})

// ── Wallet: balance ───────────────────────────────────────────

app.post('/wallet/balance', async (req, res) => {
  const { walletId } = req.body as { walletId?: string; address?: string }

  if (!walletId) return res.status(400).json({ error: 'walletId is required.' })

  if (!isCircleConfigured()) {
    return missingEnv(res, 'Circle', ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET'])
  }

  try {
    const { usdcBalance, nativeBalance } = await getWalletBalance(walletId)
    return res.json({
      balances: [{ amount: usdcBalance, token: { symbol: 'USDC' } }],
      nativeBalance,
      nativeSymbol: 'USDC',
    })
  } catch (err) {
    console.error('[/wallet/balance] error:', err)
    return res.status(500).json({ error: 'Failed to fetch balance.' })
  }
})

// ── Payments: send ────────────────────────────────────────────

app.post('/wallet/send', async (req, res) => {
  const body = req.body as {
    senderEmail?: string
    recipientEmail?: string
    amount?: string | number
    message?: string
  }
  const { senderEmail, recipientEmail, amount, message } = body

  if (!senderEmail || !recipientEmail || !amount) {
    return res.status(400).json({ error: 'senderEmail, recipientEmail, and amount are required.' })
  }
  if (senderEmail === recipientEmail) {
    return res.status(400).json({ error: 'You cannot send money to yourself.' })
  }

  const amountStr = String(amount)

  // Both Supabase AND Circle required for real sends
  if (!isSupabaseConfigured()) {
    return missingEnv(res, 'Supabase', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  }
  if (!isCircleConfigured()) {
    return missingEnv(res, 'Circle', ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'CIRCLE_WALLET_SET_ID'])
  }

  try {
    // 1. Resolve sender wallet
    const sender = await getUserByEmail(senderEmail)
    if (!sender?.wallet_id) {
      return res.status(400).json({ error: 'Sender does not have a provisioned wallet. Please visit the Wallet page first.' })
    }

    // 2. Resolve or prepare recipient
    let recipientAddress: string
    let recipient = await getUserByEmail(recipientEmail)

    if (recipient?.wallet_address) {
      recipientAddress = recipient.wallet_address
    } else {
      // Recipient not yet on Avero — provision a waiting wallet
      // Use a deterministic uuid-shaped ID derived from the email
      const { walletId, address } = await createUserWallet(`pending-${recipientEmail}`)
      recipientAddress = address
      // Generate a valid UUID for the pending user via Supabase
      const supabase = getSupabase()
      const { data: uuidRow } = await supabase.rpc('gen_random_uuid').single()
      const pendingId: string = (uuidRow as string | null) ?? crypto.randomUUID()
      await upsertUser({
        id: pendingId,
        email: recipientEmail,
        walletId,
        walletAddress: address,
      })
      recipient = await getUserByEmail(recipientEmail)
    }

    // 3. Create pending transaction record
    const tx = await createTransaction({
      senderEmail,
      senderId: sender.id,
      recipientEmail,
      amount: amountStr,
      message: message ?? undefined,
      status: 'PENDING',
    })

    // 4. Execute Circle transfer
    const { circleTransactionId, status } = await sendUsdc({
      senderWalletId: sender.wallet_id,
      recipientAddress,
      amount: amountStr,
      idempotencyKey: tx.id,
    })

    // 5. Update transaction record with Circle ID
    await updateTransaction(tx.id, { circleTransactionId, status })

    // 6. Fire email notifications (non-blocking)
    if (isEmailConfigured()) {
      // Notify recipient
      sendPaymentNotification({
        recipientEmail,
        senderEmail,
        amount: amountStr,
        message: message ?? undefined,
        txId: tx.id,
        explorerUrl: null,
      }).catch((err: unknown) => {
        console.error('[/wallet/send] recipient email failed:', err)
      })
      // Send receipt to sender
      sendPaymentReceipt({
        senderEmail,
        recipientEmail,
        amount: amountStr,
        message: message ?? undefined,
        txId: tx.id,
        explorerUrl: null,
      }).catch((err: unknown) => {
        console.error('[/wallet/send] sender receipt failed:', err)
      })
    }

    return res.json({
      success: true,
      transactionId: tx.id,
      circleTransactionId,
      status,
    })
  } catch (err) {
    console.error('[/wallet/send] error:', err)
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Payment failed.' })
  }
})

// ── Wallet: transaction status ────────────────────────────────

app.get('/wallet/status/:circleTransactionId', async (req, res) => {
  const { circleTransactionId } = req.params

  if (!process.env.CIRCLE_API_KEY || !process.env.CIRCLE_ENTITY_SECRET) {
    return missingEnv(res, 'Circle', ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET'])
  }

  if (!circleTransactionId || circleTransactionId === 'demo') {
    return res.json({ status: 'CONFIRMED', txHash: null, blockExplorerUrl: null })
  }

  try {
    const circleRes = await fetch(
      `https://api.circle.com/v1/w3s/transactions/${circleTransactionId}`,
      { headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`, 'Content-Type': 'application/json' } }
    )

    if (!circleRes.ok) {
      const errBody = await circleRes.json().catch(() => ({})) as { message?: string }
      return res.status(circleRes.status).json({ error: errBody.message ?? 'Circle API error' })
    }

    const body = await circleRes.json() as { data?: { transaction?: { state?: string; txHash?: string } } }
    const data = body.data?.transaction ?? {}
    const txHash = data.txHash ?? null
    const chainStatus = data.state ?? 'PENDING'
    const ARC_TESTNET_EXPLORER = 'https://explorer.testnet.arc.io'
    const blockExplorerUrl = txHash ? `${ARC_TESTNET_EXPLORER}/tx/${txHash}` : null

    // Update Supabase record if confirmed and we have a hash
    if (isSupabaseConfigured() && (chainStatus === 'CONFIRMED' || chainStatus === 'COMPLETE' || chainStatus === 'SENT')) {
      try {
        const supabase = getSupabase()
        await supabase
          .from('transactions')
          .update({ status: chainStatus, tx_hash: txHash, block_explorer_url: blockExplorerUrl })
          .eq('circle_transaction_id', circleTransactionId)
      } catch { /* non-fatal */ }
    }

    return res.json({ status: chainStatus, txHash, blockExplorerUrl })
  } catch (err) {
    console.error('[/wallet/status] error:', err)
    return res.status(500).json({ error: 'Failed to fetch transaction status.' })
  }
})

// ── Payment links: create ─────────────────────────────────────

app.post('/payments/create', async (req, res) => {
  const { userId, userEmail, title, amount } = req.body as { userId?: string; userEmail?: string; title?: string; amount?: number }
  if (!title || !amount || (!userId && !userEmail)) {
    return res.status(400).json({ error: 'title, amount, and userId or userEmail are required.' })
  }
  if (!isSupabaseConfigured()) {
    return missingEnv(res, 'Supabase', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  }

  try {
    // Resolve the correct Supabase UUID — look up by email if provided
    let resolvedUserId = userId ?? ''
    if (userEmail) {
      const user = await getUserByEmail(userEmail)
      if (user) resolvedUserId = user.id
    }
    const link = await createPaymentLink({ userId: resolvedUserId, title, amount })
    const baseUrl = process.env.VITE_APP_URL ?? 'https://avero.app'
    return res.json({
      id: link.id,
      slug: link.slug,
      url: `${baseUrl}/pay/${link.slug}`,
    })
  } catch (err) {
    console.error('[/payments/create] error:', err)
    return res.status(500).json({ error: 'Failed to create payment link.' })
  }
})

// ── Payment links: list ───────────────────────────────────────

app.get('/payments/list', async (req, res) => {
  const { userId } = req.query as { userId?: string }
  if (!userId) return res.status(400).json({ error: 'userId is required.' })

  if (!isSupabaseConfigured()) {
    return missingEnv(res, 'Supabase', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  }

  try {
    const links = await getPaymentLinksByUser(userId)
    return res.json({ links })
  } catch (err) {
    console.error('[/payments/list] error:', err)
    return res.status(500).json({ error: 'Failed to list payment links.' })
  }
})

// ── Transactions: list ────────────────────────────────────────

app.get('/transactions/list', async (req, res) => {
  const { userId } = req.query as { userId?: string }
  if (!userId) return res.status(400).json({ error: 'userId is required.' })

  if (!isSupabaseConfigured()) {
    return missingEnv(res, 'Supabase', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  }

  try {
    // userId is the email in our query — check both
    const user = await getUserById(userId).catch(() => null)
    const email = user?.email ?? userId
    const transactions = await getTransactionsByEmail(email)
    return res.json({ transactions })
  } catch (err) {
    console.error('[/transactions/list] error:', err)
    return res.status(500).json({ error: 'Failed to list transactions.' })
  }
})

// ── User: lookup by email ─────────────────────────────────────

app.get('/user/lookup', async (req, res) => {
  const { email } = req.query as { email?: string }
  if (!email) return res.status(400).json({ error: 'email is required.' })

  if (!isSupabaseConfigured()) {
    return missingEnv(res, 'Supabase', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  }

  try {
    const user = await getUserByEmail(email)
    return res.json({ user: user ?? null })
  } catch (err) {
    console.error('[/user/lookup] error:', err)
    return res.status(500).json({ error: 'Failed to look up user.' })
  }
})

// ── Payment requests: create ──────────────────────────────────

app.post('/requests/create', async (req, res) => {
  const { requesterEmail, requesterId, recipientEmail, amount, note } = req.body as {
    requesterEmail?: string
    requesterId?: string
    recipientEmail?: string
    amount?: string
    note?: string
  }

  if (!requesterEmail || !requesterId || !amount) {
    return res.status(400).json({ error: 'requesterEmail, requesterId, and amount are required.' })
  }

  if (!isSupabaseConfigured()) {
    return missingEnv(res, 'Supabase', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  }

  try {
    const supabase = getSupabase()
    const id = crypto.randomUUID()
    const slug = crypto.randomUUID().replace(/-/g, '').slice(0, 10)
    const appUrl = process.env.VITE_APP_URL ?? 'https://useavero.xyz'
    const url = `${appUrl}/request/${slug}`

    await supabase.from('payment_requests').insert({
      id,
      requester_id: requesterId,
      requester_email: requesterEmail,
      recipient_email: recipientEmail ?? null,
      amount,
      note: note ?? null,
      slug,
      status: 'pending',
    })

    // Send email if recipient provided
    if (recipientEmail && isEmailConfigured()) {
      sendRequestNotification({
        requesterEmail,
        recipientEmail,
        amount,
        note,
        requestUrl: url,
      }).catch((err: unknown) => {
        console.error('[/requests/create] email failed:', err)
      })
    }

    return res.json({ id, slug, url })
  } catch (err) {
    console.error('[/requests/create] error:', err)
    return res.status(500).json({ error: 'Failed to create payment request.' })
  }
})

// ── Payment requests: list ────────────────────────────────────

app.get('/requests/list', async (req, res) => {
  const { userId } = req.query as { userId?: string }
  if (!userId) return res.status(400).json({ error: 'userId is required.' })

  if (!isSupabaseConfigured()) {
    return missingEnv(res, 'Supabase', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  }

  try {
    const supabase = getSupabase()
    const { data, error } = await supabase
      .from('payment_requests')
      .select('*')
      .eq('requester_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error
    return res.json({ requests: data ?? [] })
  } catch (err) {
    console.error('[/requests/list] error:', err)
    return res.status(500).json({ error: 'Failed to list requests.' })
  }
})

// ── Start ─────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[avero-api] running on http://localhost:${PORT}`)
  console.log(`  supabase: ${isSupabaseConfigured() ? 'configured' : 'NOT CONFIGURED'}`)
  console.log(`  circle:   ${isCircleConfigured() ? 'configured' : 'NOT CONFIGURED'}`)
  console.log(`  email:    ${isEmailConfigured() ? 'configured' : 'NOT CONFIGURED'}`)
})
