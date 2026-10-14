import { createClient } from '@supabase/supabase-js'
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { id, email, name } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  const supaUrl = process.env.VITE_SUPABASE_URL
  const supaKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!supaUrl || !supaKey) return res.status(503).json({ error: 'SUPABASE_NOT_CONFIGURED' })
  const db = createClient(supaUrl, supaKey)

  try {
    // Check if user exists
    const { data: existing } = await db.from('users').select('*').eq('email', email).maybeSingle()

    let userId = existing?.id || id || crypto.randomUUID()
    let walletId = existing?.wallet_id
    let walletAddress = existing?.wallet_address

    if (!existing) {
      await db.from('users').insert({ id: userId, email, name: name || null, wallet_id: null, wallet_address: null })
    } else if (name && !existing.name) {
      await db.from('users').update({ name }).eq('email', email)
    }

    // Create Circle wallet if not exists
    const apiKey = process.env.CIRCLE_API_KEY
    const entitySecret = process.env.CIRCLE_ENTITY_SECRET
    const walletSetId = process.env.CIRCLE_WALLET_SET_ID
    if (apiKey && entitySecret && walletSetId && !walletId) {
      try {
        const client = initiateDeveloperControlledWalletsClient({ apiKey, entitySecret })
        const resp = await client.createWallets({
          blockchains: ['ARC-TESTNET'],
          count: 1,
          walletSetId,
          idempotencyKey: `avero-${email}-${Date.now()}`,
        })
        const wallet = resp.data?.wallets?.[0]
        if (wallet) {
          walletId = wallet.id
          walletAddress = wallet.address
          await db.from('users').update({ wallet_id: walletId, wallet_address: walletAddress }).eq('email', email)
        }
      } catch (e) {
        console.error('Circle wallet creation error:', e)
      }
    }

    const { data: user } = await db.from('users').select('*').eq('email', email).maybeSingle()
    return res.status(200).json({ user })
  } catch (e) {
    console.error('upsert error:', e)
    return res.status(500).json({ error: String(e) })
  }
}
