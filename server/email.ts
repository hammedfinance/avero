/**
 * Avero — Resend email notifications
 * Sends branded transaction receipt emails to payment recipients.
 */

import { Resend } from 'resend'

let _resend: Resend | null = null

function getResend(): Resend {
  if (_resend) return _resend
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('RESEND_NOT_CONFIGURED')
  _resend = new Resend(apiKey)
  return _resend
}

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.VITE_FROM_EMAIL)
}

function fromAddress(): string {
  return process.env.VITE_FROM_EMAIL ?? 'onboarding@resend.dev'
}

// ── Send "you have USDC waiting" notification ─────────────────

export async function sendPaymentNotification(params: {
  recipientEmail: string
  senderEmail: string
  amount: string
  message?: string
  txId: string
  explorerUrl?: string | null
}): Promise<void> {
  const resend = getResend()
  const from = fromAddress()
  const displayAmount = parseFloat(params.amount).toFixed(2)
  const appUrl = 'https://avero.app'

  await resend.emails.send({
    from,
    to: params.recipientEmail,
    subject: `You received ${displayAmount} USDC on Avero`,
    html: buildPaymentEmail({
      recipientEmail: params.recipientEmail,
      senderEmail: params.senderEmail,
      amount: displayAmount,
      message: params.message,
      txId: params.txId,
      explorerUrl: params.explorerUrl,
      appUrl,
    }),
    text: buildPlainTextEmail({
      recipientEmail: params.recipientEmail,
      senderEmail: params.senderEmail,
      amount: displayAmount,
      message: params.message,
      appUrl,
    }),
  })
}

// ── HTML email template ───────────────────────────────────────

function buildPaymentEmail(p: {
  recipientEmail: string
  senderEmail: string
  amount: string
  message?: string
  txId: string
  explorerUrl?: string | null
  appUrl: string
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You received USDC on Avero</title>
</head>
<body style="margin:0;padding:0;background:#050505;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #242424;border-radius:16px;overflow:hidden;max-width:520px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 36px 24px;border-bottom:1px solid #1A1A1A;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:18px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;">Avero</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Amount hero -->
          <tr>
            <td style="padding:36px 36px 28px;text-align:center;border-bottom:1px solid #1A1A1A;">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A3A3A3;">You received</p>
              <p style="margin:0;font-size:56px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:1;">${p.amount}</p>
              <p style="margin:4px 0 0;font-size:16px;color:#A3A3A3;font-weight:500;">USDC</p>
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:24px 36px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;">
                    <span style="font-size:12px;color:#A3A3A3;">From</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;">
                    <span style="font-size:12px;font-weight:600;color:#D4D4D4;">${escHtml(p.senderEmail)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;">
                    <span style="font-size:12px;color:#A3A3A3;">To</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;">
                    <span style="font-size:12px;font-weight:600;color:#D4D4D4;">${escHtml(p.recipientEmail)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;">
                    <span style="font-size:12px;color:#A3A3A3;">Network</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;">
                    <span style="font-size:12px;font-weight:600;color:#D4D4D4;">Arc Testnet</span>
                  </td>
                </tr>
                ${p.message ? `
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;">
                    <span style="font-size:12px;color:#A3A3A3;">Note</span>
                  </td>
                  <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;">
                    <span style="font-size:12px;font-weight:600;color:#D4D4D4;">${escHtml(p.message)}</span>
                  </td>
                </tr>` : ''}
                ${p.explorerUrl ? `
                <tr>
                  <td style="padding:10px 0;">
                    <span style="font-size:12px;color:#A3A3A3;">Transaction</span>
                  </td>
                  <td style="padding:10px 0;text-align:right;">
                    <a href="${p.explorerUrl}" style="font-size:12px;font-weight:600;color:#ffffff;text-decoration:underline;">View on Arc</a>
                  </td>
                </tr>` : ''}
              </table>
            </td>
          </tr>

          <!-- CTA -->
          <tr>
            <td style="padding:0 36px 36px;text-align:center;">
              <a href="${p.appUrl}/auth"
                style="display:inline-block;background:#ffffff;color:#050505;font-size:14px;font-weight:700;letter-spacing:-0.01em;text-decoration:none;padding:14px 32px;border-radius:10px;">
                Open Avero
              </a>
              <p style="margin:20px 0 0;font-size:11px;color:#A3A3A3;line-height:1.5;">
                This is a testnet transaction. No real funds were moved.<br/>
                Avero — Move money intelligently.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function buildPlainTextEmail(p: {
  recipientEmail: string
  senderEmail: string
  amount: string
  message?: string
  appUrl: string
}): string {
  return [
    'Avero — You received USDC',
    '',
    `${p.senderEmail} sent you ${p.amount} USDC on Arc Testnet.`,
    ...(p.message ? [`Note: ${p.message}`, ''] : ['']),
    `Sign in to Avero to view your balance: ${p.appUrl}/auth`,
    '',
    'This is a testnet transaction. No real funds were moved.',
    'Avero — Move money intelligently.',
  ].join('\n')
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
