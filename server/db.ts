/**
 * Avero — Supabase client (server-side)
 * Uses the anon key via VITE_SUPABASE_ANON_KEY (shared with frontend).
 * All privileged mutations go through service functions here;
 * RLS enforcement is deferred until Dynamic JWTs are forwarded.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string | null
          wallet_id: string | null
          wallet_address: string | null
          created_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          wallet_id?: string | null
          wallet_address?: string | null
        }
        Update: {
          name?: string | null
          wallet_id?: string | null
          wallet_address?: string | null
        }
      }
      transactions: {
        Row: {
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
        Insert: {
          id?: string
          sender_id?: string | null
          sender_email: string
          recipient_email: string
          amount: string
          currency?: string
          message?: string | null
          status?: string
          circle_transaction_id?: string | null
          tx_hash?: string | null
          block_explorer_url?: string | null
        }
        Update: {
          status?: string
          circle_transaction_id?: string | null
          tx_hash?: string | null
          block_explorer_url?: string | null
        }
      }
      payment_links: {
        Row: {
          id: string
          user_id: string
          slug: string
          title: string
          amount: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          slug: string
          title: string
          amount: number
          status?: string
        }
        Update: {
          status?: string
        }
      }
    }
  }
}

let _client: SupabaseClient<Database> | null = null

export function getSupabase(): SupabaseClient<Database> {
  if (_client) return _client
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('SUPABASE_NOT_CONFIGURED')
  _client = createClient<Database>(url, key)
  return _client
}

export function isSupabaseConfigured(): boolean {
  return !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)
}

// ── User helpers ──────────────────────────────────────────────

export async function upsertUser(params: {
  id: string
  email: string
  name?: string
  walletId?: string
  walletAddress?: string
}) {
  const db = getSupabase()
  // Check if user exists by email first (Dynamic IDs differ from Supabase UUIDs)
  const existing = await getUserByEmail(params.email)
  if (existing) {
    // Update the existing record — preserve the original id
    const updates: Record<string, string | null> = {}
    if (params.name) updates.name = params.name
    if (params.walletId) updates.wallet_id = params.walletId
    if (params.walletAddress) updates.wallet_address = params.walletAddress
    if (Object.keys(updates).length > 0) {
      const { error } = await db.from('users').update(updates).eq('email', params.email)
      if (error) throw error
    }
    return
  }
  // Insert new user
  const { error } = await db.from('users').insert({
    id: params.id,
    email: params.email,
    name: params.name ?? null,
    wallet_id: params.walletId ?? null,
    wallet_address: params.walletAddress ?? null,
  })
  if (error) throw error
}

export async function getUserByEmail(email: string) {
  const db = getSupabase()
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function getUserById(id: string) {
  const db = getSupabase()
  const { data, error } = await db
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function updateUserWallet(userId: string, walletId: string, walletAddress: string) {
  const db = getSupabase()
  const { error } = await db
    .from('users')
    .update({ wallet_id: walletId, wallet_address: walletAddress })
    .eq('id', userId)
  if (error) throw error
}

// ── Transaction helpers ───────────────────────────────────────

export async function createTransaction(params: {
  senderEmail: string
  senderId?: string
  recipientEmail: string
  amount: string
  currency?: string
  message?: string
  status?: string
  circleTransactionId?: string
}) {
  const db = getSupabase()
  const { data, error } = await db
    .from('transactions')
    .insert({
      sender_id: params.senderId ?? null,
      sender_email: params.senderEmail,
      recipient_email: params.recipientEmail,
      amount: params.amount,
      currency: params.currency ?? 'USDC',
      message: params.message ?? null,
      status: params.status ?? 'PENDING',
      circle_transaction_id: params.circleTransactionId ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTransaction(
  id: string,
  updates: {
    status?: string
    circleTransactionId?: string
    txHash?: string
    blockExplorerUrl?: string
  }
) {
  const db = getSupabase()
  const { error } = await db
    .from('transactions')
    .update({
      ...(updates.status !== undefined ? { status: updates.status } : {}),
      ...(updates.circleTransactionId !== undefined ? { circle_transaction_id: updates.circleTransactionId } : {}),
      ...(updates.txHash !== undefined ? { tx_hash: updates.txHash } : {}),
      ...(updates.blockExplorerUrl !== undefined ? { block_explorer_url: updates.blockExplorerUrl } : {}),
    })
    .eq('id', id)
  if (error) throw error
}

export async function getTransactionsByEmail(email: string) {
  const db = getSupabase()
  const { data, error } = await db
    .from('transactions')
    .select('*')
    .or(`sender_email.eq.${email},recipient_email.eq.${email}`)
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data ?? []
}

// ── Payment link helpers ──────────────────────────────────────

export async function createPaymentLink(params: {
  userId: string
  title: string
  amount: number
}) {
  const db = getSupabase()
  const slug = generateSlug()
  const { data, error } = await db
    .from('payment_links')
    .insert({ user_id: params.userId, slug, title: params.title, amount: params.amount })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getPaymentLinksByUser(userId: string) {
  const db = getSupabase()
  const { data, error } = await db
    .from('payment_links')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

// ── Helpers ───────────────────────────────────────────────────

function generateSlug(length = 10): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}
