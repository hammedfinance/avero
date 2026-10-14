import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets'

export default async function handler(req, res) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id required' })
  try {
    const client = initiateDeveloperControlledWalletsClient({
      apiKey: process.env.CIRCLE_API_KEY!,
      entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
    })
    const resp = await client.getTransaction({ id: id as string })
    const tx = resp.data?.transaction
    if (!tx) return res.status(404).json({ error: 'Transaction not found' })
    return res.status(200).json({ id: tx.id, state: tx.state, txHash: tx.txHash })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
