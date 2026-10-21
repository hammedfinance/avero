import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const { key } = req.query
  if (!key) return res.status(400).json({ error: 'Missing claim key' })

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

  const { data, error } = await db
    .from('transactions')
    .select('sender_email, amount, message, status')
    .eq('claim_key', key)
    .maybeSingle()

  if (error || !data) return res.status(404).json({ error: 'Claim not found or already used' })
  if (data.status !== 'PENDING_CLAIM') return res.status(400).json({ error: 'This USDC has already been claimed' })

  return res.status(200).json({
    senderEmail: data.sender_email,
    amount: data.amount,
    message: data.message || '',
    status: data.status,
  })
}
