import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured, getSupabaseServer } from '../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { slug } = req.query as { slug: string }
  if (!slug) return res.status(400).json({ error: 'slug required' })
  if (!isSupabaseConfigured()) return res.status(501).json({ error: 'Supabase not configured' })

  const db = getSupabaseServer()
  const { data, error } = await db
    .from('payment_links')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Payment link not found' })
  return res.json({ link: data })
}
