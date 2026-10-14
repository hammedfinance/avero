import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured } from './_db.js'
import { isCircleConfigured } from './_circle.js'
import { isEmailConfigured } from './_email.js'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(200).json({
    ok: true,
    service: 'avero-api',
    timestamp: new Date().toISOString(),
    supabase: isSupabaseConfigured(),
    circle: isCircleConfigured(),
    email: isEmailConfigured(),
  })
}
