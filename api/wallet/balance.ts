import { createClient } from '@supabase/supabase-js'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

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
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    })
    const resp = await client.getWalletTokenBalance({ id: wId })
    const balances = resp.data?.tokenBalances || []
    const usdc = balances.find((b) => b.token?.symbol === 'USDC' || b.token?.name?.includes('USD'))
    return res.status(200).json({ balance: usdc?.amount || '0', tokenBalances: balances })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
