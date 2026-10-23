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

function isResend403(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as Record<string, unknown>
  return e['statusCode'] === 403 || (typeof e['message'] === 'string' && (e['message'] as string).includes('own email address'))
}

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
  const appUrl = process.env.VITE_APP_URL ?? 'https://useavero.xyz'

  try {
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
  } catch (err) {
    if (isResend403(err)) {
      console.warn('[email] Resend domain not verified — email skipped. Verify useavero.xyz in Resend to send to any address.')
      return
    }
    throw err
  }
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

// ── Send escrow "claim your USDC" email to new recipient ──────

export async function sendEscrowClaimEmail(params: {
  recipientEmail: string
  senderEmail: string
  amount: string
  message?: string
  claimUrl: string
}): Promise<void> {
  const resend = getResend()
  const from = fromAddress()
  const displayAmount = parseFloat(params.amount).toFixed(2)

  try {
    await resend.emails.send({
      from,
      to: params.recipientEmail,
      subject: `You have $${displayAmount} USDC waiting — claim it on Avero`,
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Claim your USDC</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #242424;border-radius:16px;overflow:hidden;max-width:520px;width:100%;">
        <tr><td style="padding:32px 36px 24px;border-bottom:1px solid #1A1A1A;">
          <span style="font-size:18px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;">Avero</span>
        </td></tr>
        <tr><td style="padding:36px 36px 28px;text-align:center;border-bottom:1px solid #1A1A1A;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A3A3A3;">You received</p>
          <p style="margin:0;font-size:56px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:1;">$${displayAmount}</p>
          <p style="margin:4px 0 0;font-size:16px;color:#A3A3A3;font-weight:500;">USDC</p>
        </td></tr>
        <tr><td style="padding:24px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:10px 0;border-bottom:1px solid #1A1A1A;"><span style="font-size:12px;color:#A3A3A3;">From</span></td>
              <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;"><span style="font-size:12px;font-weight:600;color:#D4D4D4;">${escHtml(params.senderEmail)}</span></td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #1A1A1A;"><span style="font-size:12px;color:#A3A3A3;">Network</span></td>
              <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;"><span style="font-size:12px;font-weight:600;color:#D4D4D4;">Arc Testnet</span></td></tr>
            ${params.message ? `<tr><td style="padding:10px 0;border-bottom:1px solid #1A1A1A;"><span style="font-size:12px;color:#A3A3A3;">Note</span></td>
              <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;"><span style="font-size:12px;font-weight:600;color:#D4D4D4;">${escHtml(params.message)}</span></td></tr>` : ''}
          </table>
        </td></tr>
        <tr><td style="padding:28px 36px 36px;text-align:center;">
          <a href="${params.claimUrl}" style="display:inline-block;background:#ffffff;color:#050505;font-size:15px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:10px;">Claim your USDC →</a>
          <p style="margin:20px 0 0;font-size:11px;color:#A3A3A3;">This link expires in 7 days. Avero — Move money intelligently.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
      text: `You have $${displayAmount} USDC waiting on Avero!\n\n${params.senderEmail} sent you money.\n${params.message ? `Note: ${params.message}\n` : ''}\nClaim your USDC: ${params.claimUrl}\n\nThis link expires in 7 days.\nAvero — Move money intelligently.`,
    })
  } catch (err) {
    if (isResend403(err)) {
      console.warn('[email] Resend domain not verified — claim email skipped.')
      return
    }
    throw err
  }
}

// ── Send receipt to the SENDER after a successful payment ─────

export async function sendPaymentReceipt(params: {
  senderEmail: string
  recipientEmail: string
  amount: string
  message?: string
  txId: string
  explorerUrl?: string | null
}): Promise<void> {
  const resend = getResend()
  const from = fromAddress()
  const displayAmount = parseFloat(params.amount).toFixed(2)

  await resend.emails.send({
    from,
    to: params.senderEmail,
    subject: `You sent $${displayAmount} USDC via Avero`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Payment Sent</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #242424;border-radius:16px;overflow:hidden;max-width:520px;width:100%;">
        <tr><td style="padding:32px 36px 24px;border-bottom:1px solid #1A1A1A;">
          <span style="font-size:18px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;">Avero</span>
        </td></tr>
        <tr><td style="padding:36px 36px 28px;text-align:center;border-bottom:1px solid #1A1A1A;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A3A3A3;">You sent</p>
          <p style="margin:0;font-size:56px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:1;">$${displayAmount}</p>
          <p style="margin:4px 0 0;font-size:16px;color:#A3A3A3;font-weight:500;">USDC</p>
        </td></tr>
        <tr><td style="padding:24px 36px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:10px 0;border-bottom:1px solid #1A1A1A;"><span style="font-size:12px;color:#A3A3A3;">To</span></td>
              <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;"><span style="font-size:12px;font-weight:600;color:#D4D4D4;">${escHtml(params.recipientEmail)}</span></td></tr>
            <tr><td style="padding:10px 0;border-bottom:1px solid #1A1A1A;"><span style="font-size:12px;color:#A3A3A3;">Network</span></td>
              <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;"><span style="font-size:12px;font-weight:600;color:#D4D4D4;">Arc Testnet</span></td></tr>
            ${params.message ? `<tr><td style="padding:10px 0;border-bottom:1px solid #1A1A1A;"><span style="font-size:12px;color:#A3A3A3;">Note</span></td>
              <td style="padding:10px 0;border-bottom:1px solid #1A1A1A;text-align:right;"><span style="font-size:12px;font-weight:600;color:#D4D4D4;">${escHtml(params.message)}</span></td></tr>` : ''}
            <tr><td style="padding:10px 0;"><span style="font-size:12px;color:#A3A3A3;">Reference</span></td>
              <td style="padding:10px 0;text-align:right;"><span style="font-size:11px;font-family:monospace;color:#A3A3A3;">${params.txId.slice(0, 8)}…</span></td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:0 36px 36px;text-align:center;">
          ${params.explorerUrl ? `<a href="${params.explorerUrl}" style="display:inline-block;background:#1A1A1A;color:#fff;font-size:13px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:8px;border:1px solid #242424;margin-bottom:16px;">View on Arc ↗</a><br/>` : ''}
          <p style="margin:16px 0 0;font-size:11px;color:#A3A3A3;">Avero — Move money intelligently.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `Avero — Payment Sent\n\nYou sent $${displayAmount} USDC to ${params.recipientEmail}.\n${params.message ? `Note: ${params.message}\n` : ''}Reference: ${params.txId}\n${params.explorerUrl ? `View on Arc: ${params.explorerUrl}\n` : ''}\nAvero — Move money intelligently.`,
  })
}

// ── Send payment request email ────────────────────────────────

export async function sendRequestNotification(params: {
  requesterEmail: string
  recipientEmail: string
  amount: string
  note?: string
  requestUrl: string
}): Promise<void> {
  const resend = getResend()
  const from = fromAddress()
  const displayAmount = parseFloat(params.amount).toFixed(2)

  await resend.emails.send({
    from,
    to: params.recipientEmail,
    subject: `${params.requesterEmail.split('@')[0]} is requesting $${displayAmount} USDC from you`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><title>Payment Request</title></head>
<body style="margin:0;padding:0;background:#050505;font-family:'DM Sans',Helvetica,Arial,sans-serif;color:#ffffff;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050505;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #242424;border-radius:16px;overflow:hidden;max-width:520px;width:100%;">
        <tr><td style="padding:32px 36px 24px;border-bottom:1px solid #1A1A1A;">
          <span style="font-size:18px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;">Avero</span>
        </td></tr>
        <tr><td style="padding:36px 36px 28px;text-align:center;border-bottom:1px solid #1A1A1A;">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:#A3A3A3;">Payment request</p>
          <p style="margin:0;font-size:56px;font-weight:800;letter-spacing:-0.04em;color:#ffffff;line-height:1;">$${displayAmount}</p>
          <p style="margin:8px 0 0;font-size:14px;color:#A3A3A3;">requested by <strong style="color:#fff;">${escHtml(params.requesterEmail)}</strong></p>
        </td></tr>
        ${params.note ? `<tr><td style="padding:20px 36px 0;">
          <div style="background:#0A0A0A;border:1px solid #1A1A1A;border-radius:10px;padding:16px;">
            <p style="margin:0 0 4px;font-size:11px;color:#A3A3A3;text-transform:uppercase;letter-spacing:0.08em;">Note</p>
            <p style="margin:0;font-size:14px;color:#fff;">${escHtml(params.note)}</p>
          </div>
        </td></tr>` : ''}
        <tr><td style="padding:28px 36px 36px;text-align:center;">
          <a href="${params.requestUrl}" style="display:inline-block;background:#ffffff;color:#050505;font-size:15px;font-weight:700;text-decoration:none;padding:16px 36px;border-radius:10px;">Pay now →</a>
          <p style="margin:20px 0 0;font-size:11px;color:#A3A3A3;">Avero — Move money intelligently.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
    text: `${params.requesterEmail} is requesting $${displayAmount} USDC from you.\n${params.note ? `Note: ${params.note}\n` : ''}\nPay now: ${params.requestUrl}\n\nAvero — Move money intelligently.`,
  })
}
