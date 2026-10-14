export default function handler(_req, res) {
  res.status(200).json({
    ok: true,
    service: 'avero-api',
    timestamp: new Date().toISOString(),
    supabase: !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY),
    circle: !!(process.env.CIRCLE_API_KEY && process.env.CIRCLE_ENTITY_SECRET),
    email: !!process.env.RESEND_API_KEY,
  })
}
