import { createClient } from '@supabase/supabase-js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email, name, dynamicUserId } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)

  // Check if user exists
  const { data: existing } = await db.from('users').select('*').eq('email', email).maybeSingle()
  if (existing) {
    // If no wallet yet, create one
    if (!existing.wallet_id) {
      try {
        const resp = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            idempotencyKey: `avero-${email}-${Date.now()}`,
            accountType: 'EOA',
            blockchains: ['ARC-TESTNET'],
            count: 1,
            walletSetId: process.env.CIRCLE_WALLET_SET_ID,
          }),
        })
        const data = await resp.json()
        const wallet = data.data?.wallets?.[0]
        if (wallet) {
          await db.from('users').update({ wallet_id: wallet.id, wallet_address: wallet.address, name: name || existing.name }).eq('email', email)
          return res.status(200).json({ ...existing, wallet_id: wallet.id, wallet_address: wallet.address })
        }
      } catch (_) {}
    }
    return res.status(200).json(existing)
  }

  // Create new user
  const newUser = { id: crypto.randomUUID(), email, name: name || '', dynamic_id: dynamicUserId || '' }
  const { error: insertError } = await db.from('users').insert(newUser)
  if (insertError) return res.status(500).json({ error: insertError.message })

  // Create Circle wallet
  try {
    const resp = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey: `avero-${email}-${Date.now()}`,
        accountType: 'EOA',
        blockchains: ['ARC-TESTNET'],
        count: 1,
        walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      }),
    })
    const data = await resp.json()
    const wallet = data.data?.wallets?.[0]
    if (wallet) {
      await db.from('users').update({ wallet_id: wallet.id, wallet_address: wallet.address }).eq('email', email)
      return res.status(200).json({ ...newUser, wallet_id: wallet.id, wallet_address: wallet.address })
    }
  } catch (_) {}

  return res.status(200).json(newUser)
}
