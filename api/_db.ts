/**
 * Avero — Supabase client (shared across Vercel API routes)
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type User = {
  id: string
  email: string
  name: string | null
  wallet_id: string | null
  wallet_address: string | null
  created_at: string
}

export type Transaction = {
  id: string
  sender_id: string | null
  sender_email: string
  recipient_email: string
  amount: string
  currency: string
  message: string | null
  status: string
  circle_transaction_id: string | null
  tx_hash: string | null
  block_explorer_url: string | null
  created_at: string
}

export type PaymentLink = {
  id: string
  user_id: string
  slug: string
  title: string
  amount: number
  status: string
  created_at: string
}

function getClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED')
  return createClient(url, key)
}

// Alias for use in API route files
export function getSupabaseServer(): SupabaseClient {
  return getClient()
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const db = getClient()
  const { data } = await db.from('users').select('*').eq('email', email).maybeSingle()
  return data as User | null
}

export async function getUserById(id: string): Promise<User | null> {
  const db = getClient()
  const { data } = await db.from('users').select('*').eq('id', id).maybeSingle()
  return data as User | null
}

export async function upsertUser(params: {
  id: string; email: string; name?: string; walletId?: string; walletAddress?: string
}): Promise<void> {
  const db = getClient()
  const existing = await getUserByEmail(params.email)
  if (existing) {
    const updates: Record<string, string | null> = {}
    if (params.name) updates.name = params.name
    if (params.walletId) updates.wallet_id = params.walletId
    if (params.walletAddress) updates.wallet_address = params.walletAddress
    if (Object.keys(updates).length > 0) {
      await db.from('users').update(updates).eq('email', params.email)
    }
    return
  }
  await db.from('users').insert({
    id: params.id, email: params.email,
    name: params.name ?? null,
    wallet_id: params.walletId ?? null,
    wallet_address: params.walletAddress ?? null,
  })
}

export async function updateUserWallet(userId: string, walletId: string, walletAddress: string): Promise<void> {
  const db = getClient()
  await db.from('users').update({ wallet_id: walletId, wallet_address: walletAddress }).eq('id', userId)
}

export async function createTx(params: {
  senderEmail: string; senderId?: string; recipientEmail: string
  amount: string; currency?: string; message?: string
  status?: string; circleTransactionId?: string
}): Promise<Transaction> {
  const db = getClient()
  const { data, error } = await db.from('transactions').insert({
    sender_id: params.senderId ?? null,
    sender_email: params.senderEmail,
    recipient_email: params.recipientEmail,
    amount: params.amount,
    currency: params.currency ?? 'USDC',
    message: params.message ?? null,
    status: params.status ?? 'PENDING',
    circle_transaction_id: params.circleTransactionId ?? null,
  }).select().single()
  if (error) throw error
  return data as Transaction
}

export async function updateTx(id: string, updates: {
  status?: string; circleTransactionId?: string; txHash?: string; blockExplorerUrl?: string
}): Promise<void> {
  const db = getClient()
  await db.from('transactions').update({
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.circleTransactionId !== undefined ? { circle_transaction_id: updates.circleTransactionId } : {}),
    ...(updates.txHash !== undefined ? { tx_hash: updates.txHash } : {}),
    ...(updates.blockExplorerUrl !== undefined ? { block_explorer_url: updates.blockExplorerUrl } : {}),
  }).eq('id', id)
}

export async function getTxByEmail(email: string): Promise<Transaction[]> {
  const db = getClient()
  const { data } = await db.from('transactions').select('*')
    .or(`sender_email.eq.${email},recipient_email.eq.${email}`)
    .order('created_at', { ascending: false }).limit(100)
  return (data ?? []) as Transaction[]
}

export async function createPaymentLink(params: { userId: string; title: string; amount: number }): Promise<PaymentLink> {
  const db = getClient()
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const slug = Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  const { data, error } = await db.from('payment_links')
    .insert({ user_id: params.userId, slug, title: params.title, amount: params.amount })
    .select().single()
  if (error) throw error
  return data as PaymentLink
}

export async function getPaymentLinksByUser(userId: string): Promise<PaymentLink[]> {
  const db = getClient()
  const { data } = await db.from('payment_links').select('*').eq('user_id', userId)
    .order('created_at', { ascending: false })
  return (data ?? []) as PaymentLink[]
}
