export default function handler(_req, res) {
  const supabase = !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)
  const circle = !!(process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET)
  const email = !!process.env.RESEND_API_KEY
  res.status(200).json({ ok: true, service: 'avero-api', supabase, circle, email, timestamp: new Date().toISOString() })
}
