import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const { slug } = req.query
  if (!slug) return res.status(400).json({ error: 'slug required' })
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
  const { data } = await db.from('payment_links').select('*, users(email, name)').eq('slug', slug).maybeSingle()
  if (!data) return res.status(404).json({ error: 'Payment link not found' })
  return res.status(200).json({ link: data })
}
