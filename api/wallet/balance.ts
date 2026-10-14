import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  const { walletId, email } = req.query
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

  let wId = walletId as string
  if (!wId && email) {
    const { data: user } = await db.from('users').select('wallet_id').eq('email', email).maybeSingle()
    wId = user?.wallet_id
  }
  if (!wId) return res.status(400).json({ error: 'walletId or email required' })

  try {
    const resp = await fetch(`https://api.circle.com/v1/w3s/wallets/${wId}/balances`, {
      headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` },
    })
    const data = await resp.json()
    const balances = data.data?.tokenBalances || []
    const usdc = balances.find((b) => b.token?.symbol === 'USDC' || b.token?.name?.includes('USD'))
    return res.status(200).json({ balance: usdc?.amount || '0', tokenBalances: balances })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
