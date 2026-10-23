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

    // 2. ALWAYS look up by email — this is the canonical key
    //    The Dynamic ID and Supabase ID may differ; email is the truth
    const user = await getUserByEmail(email)
    if (!user) {
      return res.status(500).json({ error: 'Failed to find user after upsert.' })
    }

    // 3. Create a Circle wallet if none exists yet — use the Supabase user.id
    if (!user.wallet_id && isCircleConfigured()) {
      try {
        const { walletId, address } = await createUserWallet(user.id)
        // Update using the SUPABASE user.id not the Dynamic id
        await updateUserWallet(user.id, walletId, address)
        const updated = await getUserByEmail(email)
        return res.json({ user: updated, walletProvisioned: true })
      } catch (walletErr) {
        console.error('[/auth/upsert] wallet creation failed:', walletErr)
        return res.json({ user, walletProvisioned: false, walletError: String(walletErr) })
      }
    }

    return res.json({ user, walletProvisioned: !!user.wallet_id })
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
  if (!email && !userId) return res.status(400).json({ error: 'email or userId is required.' })

  if (!isCircleConfigured()) {
    return missingEnv(res, 'Circle', ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'CIRCLE_WALLET_SET_ID'])
  }

  try {
    // Resolve the real Supabase user by email first
    let supabaseUserId = userId ?? ''
    if (email && isSupabaseConfigured()) {
      const user = await getUserByEmail(email)
      if (user) {
        // Already has a wallet — return it directly
        if (user.wallet_id) {
          return res.json({ walletId: user.wallet_id, address: user.wallet_address, existing: true })
        }
        supabaseUserId = user.id
      }
    }

    const { walletId, address } = await createUserWallet(supabaseUserId)

    if (isSupabaseConfigured() && email) {
      const user = await getUserByEmail(email)
      if (user) await updateUserWallet(user.id, walletId, address)
    }

    return res.json({ walletId, address })
  } catch (err) {
    console.error('[/wallet/create] error:', err)
    return res.status(500).json({ error: 'Failed to create wallet.' })
  }
})

// ── Wallet: balance ───────────────────────────────────────────

async function handleBalance(walletId: string | undefined, email: string | undefined, res: import('express').Response) {
  if (!walletId && email && isSupabaseConfigured()) {
    const user = await getUserByEmail(email)
    if (user?.wallet_id) walletId = user.wallet_id
  }
  if (!walletId) return res.status(400).json({ error: 'walletId is required.' })
  if (!isCircleConfigured()) return missingEnv(res, 'Circle', ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET'])
  try {
    const { usdcBalance, nativeBalance } = await getWalletBalance(walletId)
    return res.json({
      balance: usdcBalance,
      tokenBalances: [{ amount: usdcBalance, token: { symbol: 'USDC' } }],
      nativeBalance,
      nativeSymbol: 'USDC',
    })
  } catch (err) {
    console.error('[/wallet/balance] error:', err)
    return res.status(500).json({ error: 'Failed to fetch balance.' })
  }
}

app.post('/wallet/balance', async (req, res) => {
  const { walletId, email } = req.body as { walletId?: string; email?: string }
  return handleBalance(walletId, email, res)
})

app.get('/wallet/balance', async (req, res) => {
  const { walletId, email } = req.query as { walletId?: string; email?: string }
  return handleBalance(walletId, email, res)
})

// ── Payments: send ────────────────────────────────────────────

// ── Escrow helpers ────────────────────────────────────────────

const CIRCLE_API = 'https://api.circle.com/v1/w3s'
const USDC_CONTRACT = '0x3600000000000000000000000000000000000000'

async function getEntitySecretCiphertext(): Promise<string> {
  const { generateEntitySecretCiphertext } = await import('@circle-fin/developer-controlled-wallets')
  return generateEntitySecretCiphertext(process.env.CIRCLE_ENTITY_SECRET!)
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
  const data = await resp.json() as { data?: { id?: string; transaction?: { id?: string } } }
  if (!resp.ok) throw new Error(JSON.stringify(data))
  return data.data
}

async function pollCircleTx(txId: string, maxWait = 90000): Promise<string> {
  if (!txId) return 'UNKNOWN'
  const start = Date.now()
  while (Date.now() - start < maxWait) {
    await new Promise(r => setTimeout(r, 3000))
    const resp = await fetch(`${CIRCLE_API}/transactions/${txId}`, {
      headers: { Authorization: `Bearer ${process.env.CIRCLE_API_KEY}` },
    })
    const d = await resp.json() as { data?: { transaction?: { state?: string; errorReason?: string }; state?: string } }
    const state = d?.data?.transaction?.state || d?.data?.state
    if (state === 'COMPLETE' || state === 'CONFIRMED') return state
    if (state === 'FAILED' || state === 'CANCELLED') throw new Error(`Transaction ${state}: ${d?.data?.transaction?.errorReason}`)
  }
  return 'TIMEOUT'
}

async function runEscrow(walletId: string, depositorAddress: string, claimKey: string, amount: string, txDbId: string) {
  const supabase = getSupabase()
  try {
    const ESCROW = process.env.VITE_ESCROW_ADDRESS!
    const amountWei = BigInt(Math.round(parseFloat(amount) * 1_000_000)).toString(16).padStart(64, '0')
    const spenderPadded = ESCROW.replace('0x', '').toLowerCase().padStart(64, '0')
    // approve(address,uint256) = 0x095ea7b3
    const approveTx = await contractCall(walletId, USDC_CONTRACT, `0x095ea7b3${spenderPadded}${amountWei}`)
    const approveTxId = (approveTx as { id?: string })?.id
    console.log('[escrow] approve tx:', approveTxId)
    await pollCircleTx(approveTxId!)
    console.log('[escrow] approve confirmed')
    // depositFor(address,bytes32,uint256) = 0xcd5bff7e
    const depositorPadded = depositorAddress.replace('0x', '').toLowerCase().padStart(64, '0')
    const keyHex = claimKey.replace('0x', '').padStart(64, '0')
    const depositTx = await contractCall(walletId, ESCROW, `0xcd5bff7e${depositorPadded}${keyHex}${amountWei}`)
    const depositTxId = (depositTx as { id?: string })?.id
    console.log('[escrow] deposit tx:', depositTxId)
    await pollCircleTx(depositTxId!)
    console.log('[escrow] deposit confirmed — ESCROW LOCKED')
    await supabase.from('transactions').update({ status: 'ESCROW_LOCKED', circle_transaction_id: depositTxId }).eq('id', txDbId)
  } catch (e) {
    console.error('[escrow runEscrow error]', e)
    await supabase.from('transactions').update({ status: 'ESCROW_FAILED' }).eq('id', txDbId)
  }
}

// ── Escrow test endpoint ──────────────────────────────────────
app.post('/escrow/test', async (req, res) => {
  const { walletId, walletAddress, amount } = req.body as { walletId?: string; walletAddress?: string; amount?: string }
  if (!walletId || !walletAddress || !amount) return res.status(400).json({ error: 'walletId, walletAddress, amount required' })
  const claimKey = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')
  try {
    const ESCROW = process.env.VITE_ESCROW_ADDRESS!
    const amountWei = BigInt(Math.round(parseFloat(amount) * 1_000_000)).toString(16).padStart(64, '0')
    const spenderPadded = ESCROW.replace('0x', '').toLowerCase().padStart(64, '0')
    console.log('[escrow/test] starting approve...')
    const approveTx = await contractCall(walletId, USDC_CONTRACT, `0x095ea7b3${spenderPadded}${amountWei}`)
    const approveTxId = (approveTx as { id?: string })?.id
    console.log('[escrow/test] approve tx:', approveTxId)
    const approveStatus = await pollCircleTx(approveTxId!)
    console.log('[escrow/test] approve status:', approveStatus)
    const depositorPadded = walletAddress.replace('0x', '').toLowerCase().padStart(64, '0')
    const keyHex = claimKey.replace('0x', '').padStart(64, '0')
    console.log('[escrow/test] starting depositFor...')
    const depositTx = await contractCall(walletId, ESCROW, `0xcd5bff7e${depositorPadded}${keyHex}${amountWei}`)
    const depositTxId = (depositTx as { id?: string })?.id
    console.log('[escrow/test] deposit tx:', depositTxId)
    const depositStatus = await pollCircleTx(depositTxId!)
    console.log('[escrow/test] deposit status:', depositStatus)
    return res.json({ success: true, approveTxId, depositTxId, depositStatus, claimKey })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[escrow/test error]', msg)
    return res.status(500).json({ error: msg })
  }
})

app.post('/wallet/send', async (req, res) => {
  const body = req.body as {
    senderEmail?: string
    recipientEmail?: string
    amount?: string | number
    note?: string
    walletId?: string
    walletAddress?: string
  }
  const { senderEmail, recipientEmail, amount, note, walletId: bodyWalletId, walletAddress } = body

  if (!senderEmail || !recipientEmail || !amount) {
    return res.status(400).json({ error: 'senderEmail, recipientEmail, and amount are required.' })
  }
  if (senderEmail === recipientEmail) {
    return res.status(400).json({ error: 'You cannot send money to yourself.' })
  }

  const amountStr = String(amount)

  if (!isSupabaseConfigured()) return missingEnv(res, 'Supabase', ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'])
  if (!isCircleConfigured()) return missingEnv(res, 'Circle', ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'CIRCLE_WALLET_SET_ID'])

  try {
    const sender = await getUserByEmail(senderEmail)
    if (!sender?.wallet_id) return res.status(400).json({ error: 'Sender does not have a provisioned wallet.' })

    const recipient = await getUserByEmail(recipientEmail)

    // NEW RECIPIENT — use escrow contract
    if (!recipient?.wallet_address && process.env.VITE_ESCROW_ADDRESS) {
      const claimKey = '0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')
      const supabase = getSupabase()
      const { data: saved } = await supabase.from('transactions').insert({
        sender_email: senderEmail,
        recipient_email: recipientEmail,
        amount: amountStr,
        currency: 'USDC',
        message: note || '',
        status: 'PENDING_CLAIM',
        claim_key: claimKey,
      }).select().maybeSingle()

      // Run escrow async — Railway has no timeout
      const senderWalletId = bodyWalletId || sender.wallet_id
      const senderAddress = walletAddress || sender.wallet_address || ''
      runEscrow(senderWalletId, senderAddress, claimKey, amountStr, saved?.id).catch(e => console.error('[escrow bg]', e))

      // Send claim email
      if (isEmailConfigured()) {
        sendPaymentNotification({
          recipientEmail,
          senderEmail,
          amount: amountStr,
          message: note ?? undefined,
          txId: saved?.id || '',
          explorerUrl: `https://useavero.xyz/pay/claim?key=${encodeURIComponent(claimKey)}`,
        }).catch((e: unknown) => console.error('[escrow email]', e))
      }

      return res.json({
        transactionId: saved?.id,
        status: 'PENDING_CLAIM',
        escrowAddress: process.env.VITE_ESCROW_ADDRESS,
        message: 'Funds being locked in escrow — recipient will receive an email to claim',
      })
    }

    // EXISTING RECIPIENT — direct Circle transfer
    const recipientAddress = recipient?.wallet_address || ''
    const tx = await createTransaction({
      senderEmail,
      senderId: sender.id,
      recipientEmail,
      amount: amountStr,
      message: note ?? undefined,
      status: 'INITIATED',
    })

    const { circleTransactionId, status } = await sendUsdc({
      senderWalletId: sender.wallet_id,
      recipientAddress,
      amount: amountStr,
      idempotencyKey: tx.id,
    })

    await updateTransaction(tx.id, { circleTransactionId, status })

    if (isEmailConfigured()) {
      sendPaymentNotification({ recipientEmail, senderEmail, amount: amountStr, message: note ?? undefined, txId: tx.id, explorerUrl: null })
        .catch((e: unknown) => console.error('[email]', e))
      sendPaymentReceipt({ senderEmail, recipientEmail, amount: amountStr, message: note ?? undefined, txId: tx.id, explorerUrl: null })
        .catch((e: unknown) => console.error('[email]', e))
    }

    return res.json({ success: true, transactionId: tx.id, circleTransactionId, status })
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
