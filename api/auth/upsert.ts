import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

async function createCircleWallet(email: string): Promise<{ id: string; address: string } | null> {
  try {
    const resp = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.CIRCLE_API_KEY}`,
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
    return data.data?.wallets?.[0] ?? null
  } catch {
    return null
  }
}

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
      const wallet = await createCircleWallet(email)
      if (wallet) {
        await db.from('users').update({
          wallet_id: wallet.id,
          wallet_address: wallet.address,
          name: name || existing.name,
        }).eq('email', email)
        return res.status(200).json({
          id: existing.id,
          email: existing.email,
          name: existing.name,
          walletId: wallet.id,
          walletAddress: wallet.address,
        })
      }
    }
    return res.status(200).json({
      id: existing.id,
      email: existing.email,
      name: existing.name,
      walletId: existing.wallet_id ?? null,
      walletAddress: existing.wallet_address ?? null,
    })
  }

  // Create new user
  const newUser = {
    id: crypto.randomUUID(),
    email,
    name: name || '',
    dynamic_id: dynamicUserId || '',
  }
  const { error: insertError } = await db.from('users').insert(newUser)
  if (insertError) return res.status(500).json({ error: insertError.message })

  // Create Circle wallet for new user
  const wallet = await createCircleWallet(email)
  if (wallet) {
    await db.from('users').update({ wallet_id: wallet.id, wallet_address: wallet.address }).eq('email', email)
    return res.status(200).json({
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      walletId: wallet.id,
      walletAddress: wallet.address,
    })
  }

  return res.status(200).json({
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    walletId: null,
    walletAddress: null,
  })
}
