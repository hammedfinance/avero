import { createClient } from '@supabase/supabase-js'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
  const { data: user } = await db.from('users').select('*').eq('email', email).maybeSingle()
  if (user?.wallet_id) return res.status(200).json({ walletId: user.wallet_id, address: user.wallet_address })

  try {
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    })
    const resp = await client.createWallets({
      blockchains: ['ARC-TESTNET'],
      count: 1,
      walletSetId: process.env.CIRCLE_WALLET_SET_ID!,
      idempotencyKey: `avero-create-${email}-${Date.now()}`,
    })
    const wallet = resp.data?.wallets?.[0]
    if (!wallet) return res.status(500).json({ error: 'Circle createWallets returned no wallet' })
    await db.from('users').update({ wallet_id: wallet.id, wallet_address: wallet.address }).eq('email', email)
    return res.status(200).json({ walletId: wallet.id, address: wallet.address })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
