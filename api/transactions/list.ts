import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const { email } = req.query
  if (!email) return res.status(400).json({ error: 'email required' })
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
  const { data, error } = await db.from('transactions')
    .select('*')
    .or(`sender_email.eq.${email},recipient_email.eq.${email}`)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return res.status(500).json({ error: error.message })
  return res.status(200).json({ transactions: data || [] })
}
