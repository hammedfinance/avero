import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured, getUserByEmail, upsertUser, updateUserWallet } from '../_db'
import { isCircleConfigured, createUserWallet } from '../_circle'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email } = req.body as { userId?: string; email?: string }
  if (!email && !userId) return res.status(400).json({ error: 'email or userId is required.' })

  if (!isCircleConfigured()) {
    return res.status(501).json({ error: 'Circle not configured.', requiredEnv: ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'CIRCLE_WALLET_SET_ID'] })
  }

  try {
    if (email && isSupabaseConfigured()) {
      const user = await getUserByEmail(email)
      if (user?.wallet_id) {
        return res.json({ walletId: user.wallet_id, address: user.wallet_address, existing: true })
      }
      if (user) {
        const { walletId, address } = await createUserWallet(user.id)
        await updateUserWallet(user.id, walletId, address)
        return res.json({ walletId, address })
      }
    }

    const refId = userId ?? email ?? 'unknown'
    const { walletId, address } = await createUserWallet(refId)

    if (email && isSupabaseConfigured()) {
      await upsertUser({ id: refId, email, walletId, walletAddress: address })
    }

    return res.json({ walletId, address })
  } catch (err) {
    console.error('[wallet/create] error:', err)
    return res.status(500).json({ error: 'Failed to create wallet.' })
  }
}
