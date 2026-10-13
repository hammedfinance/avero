import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured, getUserByEmail, getPaymentLinksByUser } from '../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, email } = req.query as { userId?: string; email?: string }

  if (!isSupabaseConfigured()) return res.status(501).json({ error: 'Supabase not configured.' })

  try {
    let resolvedUserId = userId ?? ''
    if (email) {
      const user = await getUserByEmail(email)
      if (user) resolvedUserId = user.id
    }
    if (!resolvedUserId) return res.status(400).json({ error: 'userId or email required.' })

    const links = await getPaymentLinksByUser(resolvedUserId)
    return res.json({ links })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
