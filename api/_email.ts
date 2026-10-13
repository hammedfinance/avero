/**
 * Avero — Resend email helper (Vercel API routes)
 */
import { Resend } from 'resend'

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY)
}

function getResend() {
  const key = process.env.RESEND_API_KEY
  if (!key) throw new Error('RESEND_NOT_CONFIGURED')
  return new Resend(key)
}

const FROM = () => process.env.VITE_FROM_EMAIL ?? 'onboarding@resend.dev'
const APP_URL = () => process.env.VITE_APP_URL ?? 'https://useavero.xyz'

export async function sendPaymentNotification(params: {
  recipientEmail: string; senderEmail: string; amount: string; note?: string
  txHash?: string; circleTransactionId?: string
}): Promise<void> {
  if (!isEmailConfigured()) return
  const resend = getResend()
  const explorerUrl = params.txHash ? `https://explorer.testnet.arc.io/tx/${params.txHash}` : null

  await resend.emails.send({
    from: `Avero Payments <${FROM()}>`,
    to: params.recipientEmail,
    subject: `You received ${params.amount} USDC on Avero`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:#111;padding:32px;border-bottom:1px solid #242424">
          <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px">Avero</h1>
          <p style="margin:4px 0 0;color:#a3a3a3;font-size:13px">Move money intelligently</p>
        </div>
        <div style="padding:32px">
          <p style="font-size:15px;color:#a3a3a3;margin:0 0 8px">You received</p>
          <p style="font-size:40px;font-weight:700;margin:0 0 4px;letter-spacing:-1px">${params.amount} <span style="font-size:20px;color:#a3a3a3">USDC</span></p>
          <p style="font-size:14px;color:#a3a3a3;margin:0 0 24px">from ${params.senderEmail}</p>
          ${params.note ? `<div style="background:#161616;border:1px solid #242424;border-radius:8px;padding:16px;margin-bottom:24px"><p style="margin:0;font-size:14px;color:#d4d4d4">"${params.note}"</p></div>` : ''}
          <a href="${APP_URL()}" style="display:inline-block;background:#fff;color:#050505;padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px">Open Avero</a>
          ${explorerUrl ? `<p style="margin:16px 0 0;font-size:12px;color:#a3a3a3">Transaction: <a href="${explorerUrl}" style="color:#a3a3a3">${params.txHash?.slice(0, 12)}...</a></p>` : ''}
        </div>
      </div>
    `,
  })
}

export async function sendPaymentReceipt(params: {
  senderEmail: string; recipientEmail: string; amount: string; note?: string
  txHash?: string; circleTransactionId?: string
}): Promise<void> {
  if (!isEmailConfigured()) return
  const resend = getResend()
  const explorerUrl = params.txHash ? `https://explorer.testnet.arc.io/tx/${params.txHash}` : null

  await resend.emails.send({
    from: `Avero Payments <${FROM()}>`,
    to: params.senderEmail,
    subject: `Payment sent: ${params.amount} USDC to ${params.recipientEmail}`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:#111;padding:32px;border-bottom:1px solid #242424">
          <h1 style="margin:0;font-size:24px;font-weight:700;letter-spacing:-0.5px">Avero</h1>
          <p style="margin:4px 0 0;color:#a3a3a3;font-size:13px">Payment Receipt</p>
        </div>
        <div style="padding:32px">
          <p style="font-size:15px;color:#a3a3a3;margin:0 0 8px">You sent</p>
          <p style="font-size:40px;font-weight:700;margin:0 0 4px;letter-spacing:-1px">${params.amount} <span style="font-size:20px;color:#a3a3a3">USDC</span></p>
          <p style="font-size:14px;color:#a3a3a3;margin:0 0 24px">to ${params.recipientEmail}</p>
          ${explorerUrl ? `<p style="margin:16px 0 0;font-size:12px;color:#a3a3a3">View on Arc: <a href="${explorerUrl}" style="color:#a3a3a3">${params.txHash?.slice(0, 12)}...</a></p>` : ''}
        </div>
      </div>
    `,
  })
}

export async function sendRequestNotification(params: {
  recipientEmail: string; requesterEmail: string; amount: string; note?: string; requestUrl: string
}): Promise<void> {
  if (!isEmailConfigured()) return
  const resend = getResend()

  await resend.emails.send({
    from: `Avero Payments <${FROM()}>`,
    to: params.recipientEmail,
    subject: `${params.requesterEmail} is requesting ${params.amount} USDC`,
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;background:#0a0a0a;color:#fff;border-radius:12px;overflow:hidden">
        <div style="background:#111;padding:32px;border-bottom:1px solid #242424">
          <h1 style="margin:0;font-size:24px;font-weight:700">Avero</h1>
        </div>
        <div style="padding:32px">
          <p style="font-size:15px;color:#a3a3a3;margin:0 0 8px">Payment request</p>
          <p style="font-size:40px;font-weight:700;margin:0 0 4px">${params.amount} <span style="font-size:20px;color:#a3a3a3">USDC</span></p>
          <p style="font-size:14px;color:#a3a3a3;margin:0 0 24px">from ${params.requesterEmail}</p>
          ${params.note ? `<div style="background:#161616;border:1px solid #242424;border-radius:8px;padding:16px;margin-bottom:24px"><p style="margin:0;font-size:14px;color:#d4d4d4">"${params.note}"</p></div>` : ''}
          <a href="${params.requestUrl}" style="display:inline-block;background:#fff;color:#050505;padding:12px 24px;border-radius:8px;font-weight:600;text-decoration:none;font-size:14px">Pay now</a>
        </div>
      </div>
    `,
  })
}
