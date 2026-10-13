import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured, getUserByEmail, createPaymentLink } from '../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { userId, userEmail, title, amount } = req.body as {
    userId?: string; userEmail?: string; title?: string; amount?: number
  }

  if (!title || !amount || (!userId && !userEmail)) {
    return res.status(400).json({ error: 'title, amount, and userId or userEmail required.' })
  }
  if (!isSupabaseConfigured()) return res.status(501).json({ error: 'Supabase not configured.' })

  try {
    let resolvedUserId = userId ?? ''
    if (userEmail) {
      const user = await getUserByEmail(userEmail)
      if (user) resolvedUserId = user.id
    }

    const link = await createPaymentLink({ userId: resolvedUserId, title, amount })
    const baseUrl = process.env.VITE_APP_URL ?? 'https://useavero.xyz'
    return res.json({ id: link.id, slug: link.slug, url: `${baseUrl}/pay/${link.slug}` })
  } catch (err) {
    return res.status(500).json({ error: String(err) })
  }
}
