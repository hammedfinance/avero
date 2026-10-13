import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isCircleConfigured, getTransactionStatus } from '../_circle'
import { isSupabaseConfigured, updateTx } from '../_db'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const { id, dbId } = req.query as { id?: string; dbId?: string }
  if (!id) return res.status(400).json({ error: 'id (circle transaction id) required.' })

  if (!isCircleConfigured()) {
    return res.status(501).json({ error: 'Circle not configured.' })
  }

  try {
    const { status, txHash, blockExplorerUrl } = await getTransactionStatus(id)

    const isTerminal = ['COMPLETE', 'FAILED', 'CANCELLED'].includes(status)
    const isSuccess = status === 'COMPLETE' || status === 'SENT'

    if (dbId && isTerminal && isSupabaseConfigured()) {
      await updateTx(dbId, {
        status: isSuccess ? 'COMPLETED' : 'FAILED',
        circleTransactionId: id,
        txHash: txHash ?? undefined,
        blockExplorerUrl: blockExplorerUrl ?? undefined,
      })
    }

    return res.json({ status, txHash, blockExplorerUrl, isTerminal, isSuccess })
  } catch (err) {
    console.error('[wallet/status] error:', err)
    return res.status(500).json({ error: 'Failed to fetch transaction status.' })
  }
}
