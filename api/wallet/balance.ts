import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured, getUserByEmail } from '../_db.js'
import { isCircleConfigured, getWalletBalance } from '../_circle.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let { walletId, email } = req.body as { walletId?: string; email?: string }

  if (!walletId && email && isSupabaseConfigured()) {
    const user = await getUserByEmail(email)
    if (user?.wallet_id) walletId = user.wallet_id
  }

  if (!walletId) return res.status(400).json({ error: 'walletId or email required.' })

  if (!isCircleConfigured()) {
    return res.status(501).json({ error: 'Circle not configured.' })
  }

  try {
    const { usdcBalance } = await getWalletBalance(walletId)
    return res.json({
      balances: [{ amount: usdcBalance, token: { symbol: 'USDC' } }],
      nativeBalance: usdcBalance,
      nativeSymbol: 'USDC',
    })
  } catch (err) {
    console.error('[wallet/balance] error:', err)
    return res.status(500).json({ error: 'Failed to fetch balance.' })
  }
}
