import { createClient } from '@supabase/supabase-js'
import * as crypto from 'crypto'

function generateEntitySecretCiphertext(entitySecret: string, publicKey: string): string {
  const entitySecretBytes = Buffer.from(entitySecret, 'hex')
  const pubKey = crypto.createPublicKey({
    key: Buffer.from(publicKey, 'base64'),
    format: 'der',
    type: 'spki',
  })
  const encrypted = crypto.publicEncrypt(
    { key: pubKey, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    entitySecretBytes
  )
  return encrypted.toString('base64')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { email } = req.body
  if (!email) return res.status(400).json({ error: 'email required' })

  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
  const { data: user } = await db.from('users').select('*').eq('email', email).maybeSingle()
  if (user?.wallet_id) return res.status(200).json({ walletId: user.wallet_id, address: user.wallet_address })

  try {
    // Get Circle public key for entity secret encryption
    const pkResp = await fetch('https://api.circle.com/v1/w3s/config/entity/publicKey', {
      headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` },
    })
    const pkData = await pkResp.json()
    const publicKey = pkData.data?.publicKey
    if (!publicKey) return res.status(500).json({ error: 'Could not get Circle public key' })

    const entitySecret = process.env.CIRCLE_ENTITY_SECRET!
    const ciphertext = generateEntitySecretCiphertext(entitySecret, publicKey)

    const resp = await fetch('https://api.circle.com/v1/w3s/developer/wallets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        idempotencyKey: crypto.randomUUID(),
        entitySecretCiphertext: ciphertext,
        accountType: 'EOA',
        blockchains: ['ARC-TESTNET'],
        count: 1,
        walletSetId: process.env.CIRCLE_WALLET_SET_ID,
      }),
    })
    const data = await resp.json()
    if (!resp.ok) return res.status(500).json({ error: JSON.stringify(data) })
    const wallet = data.data?.wallets?.[0]
    if (!wallet) return res.status(500).json({ error: 'No wallet returned', raw: data })
    await db.from('users').update({ wallet_id: wallet.id, wallet_address: wallet.address }).eq('email', email)
    return res.status(200).json({ walletId: wallet.id, address: wallet.address })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
