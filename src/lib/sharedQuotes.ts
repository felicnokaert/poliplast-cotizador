import { supabase } from './supabase'
import { resolvedLinePrice, type SavedQuote } from './quote'
import type { CommercialRule } from '../types/commercialRules'

type QuoteRow = Record<string, unknown> & { sales_quote_items?: Array<Record<string, unknown>> }

export function mergeQuoteHistories(local: SavedQuote[], remote: SavedQuote[]): SavedQuote[] {
  const merged = new Map<string, SavedQuote>()
  for (const quote of [...local, ...remote]) {
    const current = merged.get(quote.meta.number)
    if (!current || new Date(quote.updatedAt).getTime() > new Date(current.updatedAt).getTime()) merged.set(quote.meta.number, quote)
  }
  return [...merged.values()].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
}

export function quoteToDatabaseRows(quote: SavedQuote, userId: string, rules: CommercialRule[] = []) {
  const { meta, lines } = quote
  return {
    header: {
      quote_number: meta.number, owner_id: userId, client_name: meta.client, contact_name: meta.contact,
      phone: meta.phone, email: meta.email, notes: meta.notes, payment_method: meta.paymentMethod,
      payment_term_days: meta.paymentTermDays ?? 0,
      price_mode: meta.priceMode, valid_days: meta.validDays, discount_percent: meta.discountPercent,
      surcharge_percent: meta.surchargePercent, exchange_rate: meta.exchangeRate, output_currency: meta.outputCurrency,
      status: meta.status, issued_at: meta.createdAt, updated_by: userId, updated_at: quote.updatedAt,
    },
    items: lines.map((line) => {
      const price = resolvedLinePrice(line, meta.priceMode, rules, lines, meta.exchangeRate)
      return {
        line_key: line.id, variant_id: line.variant.id, product_id: line.productId, product_name: line.productName,
        sku: line.variant.sku, brand: line.brand, family: line.family, unit: line.variant.unit, quantity: line.quantity,
        unit_amount: price?.amount ?? null, currency: price?.currency ?? null, vat_rate: price?.vatRate ?? null,
        price_source: price?.listName ?? null, commercial_rule_id: price?.ruleId ?? null,
        line_snapshot: line, active: true, updated_at: quote.updatedAt,
      }
    }),
  }
}

export function databaseRowToQuote(row: QuoteRow): SavedQuote | null {
  const items = (row.sales_quote_items ?? []).filter((item) => item.active !== false)
  const lines = items.map((item) => item.line_snapshot).filter((line): line is SavedQuote['lines'][number] => Boolean(line && typeof line === 'object'))
  if (!row.quote_number || !row.issued_at) return null
  return {
    meta: {
      number: String(row.quote_number), client: String(row.client_name ?? ''), contact: String(row.contact_name ?? ''),
      phone: String(row.phone ?? ''), email: String(row.email ?? ''), notes: String(row.notes ?? ''),
      paymentMethod: String(row.payment_method ?? 'transferencia') as SavedQuote['meta']['paymentMethod'],
      paymentTermDays: Number(row.payment_term_days ?? 0),
      priceMode: String(row.price_mode ?? 'automatico') as SavedQuote['meta']['priceMode'],
      validDays: Number(row.valid_days ?? 7), discountPercent: Number(row.discount_percent ?? 0),
      surchargePercent: Number(row.surcharge_percent ?? 0), exchangeRate: Number(row.exchange_rate ?? 1),
      outputCurrency: 'USD',
      status: String(row.status ?? 'borrador') as SavedQuote['meta']['status'], createdAt: String(row.issued_at),
    },
    lines,
    updatedAt: String(row.updated_at ?? row.issued_at),
  }
}

export async function loadSharedQuotes(): Promise<SavedQuote[]> {
  const { data, error } = await supabase.from('sales_quotes').select('*, sales_quote_items(*)').order('updated_at', { ascending: false }).limit(200)
  if (error) throw error
  return (data ?? []).map((row) => databaseRowToQuote(row as QuoteRow)).filter((quote): quote is SavedQuote => Boolean(quote))
}

export async function saveSharedQuote(quote: SavedQuote, userId: string, rules: CommercialRule[] = []): Promise<void> {
  const rows = quoteToDatabaseRows(quote, userId, rules)
  const { data: header, error: headerError } = await supabase.from('sales_quotes').upsert(rows.header, { onConflict: 'quote_number' }).select('id').single()
  if (headerError) throw headerError

  const quoteId = String(header.id)
  const { data: existing, error: existingError } = await supabase.from('sales_quote_items').select('line_key').eq('quote_id', quoteId).eq('active', true)
  if (existingError) throw existingError
  const currentKeys = new Set(rows.items.map((item) => item.line_key))
  const removedKeys = (existing ?? []).map((item) => String(item.line_key)).filter((key) => !currentKeys.has(key))
  if (removedKeys.length) {
    const { error } = await supabase.from('sales_quote_items').update({ active: false, updated_at: quote.updatedAt }).eq('quote_id', quoteId).in('line_key', removedKeys)
    if (error) throw error
  }
  if (rows.items.length) {
    const payload = rows.items.map((item) => ({ ...item, quote_id: quoteId }))
    const { error } = await supabase.from('sales_quote_items').upsert(payload, { onConflict: 'quote_id,line_key' })
    if (error) throw error
  }
}

/** Borra la cotización de forma definitiva (renglones y encabezado). No hay vuelta atrás. */
export async function deleteSharedQuote(quoteNumber: string): Promise<void> {
  const { data: header, error: headerError } = await supabase.from('sales_quotes').select('id').eq('quote_number', quoteNumber).maybeSingle()
  if (headerError) throw headerError
  if (!header) return
  const { error: itemsError } = await supabase.from('sales_quote_items').delete().eq('quote_id', header.id)
  if (itemsError) throw itemsError
  const { error: quoteError } = await supabase.from('sales_quotes').delete().eq('id', header.id)
  if (quoteError) throw quoteError
}
