import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isSupabaseConfigured } from './_db'
import { isCircleConfigured } from './_circle'
import { isEmailConfigured } from './_email'

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.json({
    ok: true,
    service: 'avero-api',
    timestamp: new Date().toISOString(),
    supabase: isSupabaseConfigured(),
    circle: isCircleConfigured(),
    email: isEmailConfigured(),
  })
}
