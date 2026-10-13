import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured, getTxByEmail } from '../_db.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { email } = req.query as { email?: string }
  if (!email) return res.status(400).json({ error: 'email required.' })

  if (!isSupabaseConfigured()) return res.status(501).json({ error: 'Supabase not configured.' })

  try {
    const transactions = await getTxByEmail(email)
    return res.json({ transactions })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
