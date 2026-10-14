export default async function handler(req, res) {
  const { id } = req.query
  if (!id) return res.status(400).json({ error: 'id required' })
  try {
    const resp = await fetch(`https://api.circle.com/v1/w3s/transactions/${id}`, {
      headers: { 'Authorization': `Bearer ${process.env.CIRCLE_API_KEY}` },
    })
    const data = await resp.json()
    const tx = data.data?.transaction
    if (!tx) return res.status(404).json({ error: 'Transaction not found' })
    return res.status(200).json({ id: tx.id, state: tx.state, txHash: tx.txHash })
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
