import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'email required' })
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
  const { data: user } = await db.from('users').select('id').eq('email', email as string).maybeSingle()
  if (!user) return res.status(200).json({ links: [] })
  const { data } = await db.from('payment_links').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  return res.status(200).json({ links: data || [] })
}
