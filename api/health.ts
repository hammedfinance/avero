export default function handler(_req: object, res: { json: (data: object) => void }) {
  res.json({ ok: true, service: 'avero-api', timestamp: new Date().toISOString() })
}
