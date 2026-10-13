import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured, getUserByEmail, upsertUser, updateUserWallet } from '../_db'
import { isCircleConfigured, createUserWallet } from '../_circle'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { id, email, name } = req.body as { id?: string; email?: string; name?: string }
  if (!id || !email) return res.status(400).json({ error: 'id and email are required.' })

  if (!isSupabaseConfigured()) {
    return res.status(501).json({ error: 'Supabase not configured.', requiredEnv: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'] })
  }

  try {
    await upsertUser({ id, email, name })
    const user = await getUserByEmail(email)
    if (!user) return res.status(500).json({ error: 'Failed to find user after upsert.' })

    if (!user.wallet_id && isCircleConfigured()) {
      try {
        const { walletId, address } = await createUserWallet(user.id)
        await updateUserWallet(user.id, walletId, address)
        const updated = await getUserByEmail(email)
        return res.json({ user: updated, walletProvisioned: true })
      } catch (walletErr) {
        console.error('[auth/upsert] wallet creation failed:', walletErr)
        return res.json({ user, walletProvisioned: false, walletError: String(walletErr) })
      }
    }

    return res.json({ user, walletProvisioned: !!user.wallet_id })
  } catch (err) {
    console.error('[auth/upsert] error:', err)
    return res.status(500).json({ error: 'Failed to upsert user.' })
  }
}
