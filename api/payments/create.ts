import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { userEmail, title, amount } = req.body
  if (!userEmail || !title || !amount) return res.status(400).json({ error: 'Missing fields' })
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
  const { data: user } = await db.from('users').select('id').eq('email', userEmail).maybeSingle()
  if (!user) return res.status(404).json({ error: 'User not found' })
  const slug = Math.random().toString(36).substring(2, 10)
  const { data, error } = await db.from('payment_links').insert({
    user_id: user.id, slug, title, amount: parseFloat(amount), status: 'active',
  }).select().maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ link: data, url: `https://useavero.xyz/pay/${slug}` })
}
