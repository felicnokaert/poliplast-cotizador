import { supabase } from './supabase'
import type { SavedQuote } from './quote'

// Ficha del cliente dentro del cotizador: qué compró y cuándo, según la copia de solo lectura de los comprobantes de
// Contabilium que mantiene el CRM (tabla contabilium_comprobantes). Mismas reglas que "Facturación" en el CRM:
// facturas (FC*) suman, notas de crédito (NC*) restan, cotizaciones (COT) no son ventas. No inventa nada: si no
// hay facturas con ese nombre, lo dice.

export interface ComprobanteRow { company: string; tipo: string; fecha: string; cliente: string; total: number | string | null; neto?: string | null }

const LEGAL_FORMS = /\b(s\.?\s?a\.?\s?s?|s\.?\s?r\.?\s?l\.?|s\.?\s?a\.?\s?c\.?\s?i\.?\s?f?\.?|sociedad anonima|sociedad de responsabilidad limitada|y cia|e hijos|hnos|hermanos)\b/g

/** Mismo criterio que el CRM: sin acentos, signos ni forma societaria, y con las palabras en cualquier orden. */
export function nameKey(value = ''): string {
  const text = String(value).toLocaleLowerCase('es-AR').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(LEGAL_FORMS, ' ')
  return text.split(/\s+/).filter(Boolean).sort().join(' ')
}

export function parseArNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const text = String(value ?? '').trim()
  if (!text) return null
  const number = Number(/,/.test(text) ? text.replace(/\./g, '').replace(',', '.') : text)
  return Number.isFinite(number) ? number : null
}

const amountOf = (row: ComprobanteRow) => parseArNumber(row.total) ?? parseArNumber(row.neto) ?? 0
const day = (value: string) => String(value || '').slice(0, 10)
const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${day(to)}T12:00:00Z`) - Date.parse(`${day(from)}T12:00:00Z`)) / 86_400_000)

export type CustomerStatus = 'activo' | 'dormido' | 'inactivo'

export interface CustomerHistory {
  purchaseCount: number
  lastPurchase: string
  daysSince: number | null
  status: CustomerStatus | null
  /** Compras y facturado (en pesos, tal cual Contabilium) de los últimos 24 meses. */
  purchases24: number
  total24: number
  frequencyDays: number | null
  /** Días de atraso respecto de su frecuencia habitual (positivo = ya debería haber comprado). */
  overdueDays: number | null
  quotesInContabilium: number
  lastQuote: string
  companies: string[]
}

function medianGap(dates: string[]): number | null {
  const sorted = [...dates].sort()
  const gaps: number[] = []
  for (let i = 1; i < sorted.length; i += 1) {
    const gap = daysBetween(sorted[i - 1], sorted[i])
    if (gap > 0) gaps.push(gap)
  }
  if (!gaps.length) return null
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  return gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2)
}

export function summarizeCustomer(rows: ComprobanteRow[], names: string[], today = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)): CustomerHistory | null {
  const keys = new Set(names.map(nameKey).filter(Boolean))
  if (!keys.size) return null
  const sales: { date: string; amount: number }[] = []
  const quotes: string[] = []
  const companies = new Set<string>()
  for (const row of rows) {
    if (!keys.has(nameKey(row.cliente))) continue
    const tipo = String(row.tipo || '').toUpperCase()
    const date = day(row.fecha)
    if (!date) continue
    if (/^FC[A-Z]?$/.test(tipo)) { sales.push({ date, amount: amountOf(row) }); if (row.company) companies.add(row.company) }
    else if (/^NC[A-Z]?$/.test(tipo)) sales.push({ date, amount: -amountOf(row) })
    else if (tipo === 'COT') quotes.push(date)
  }
  const invoices = sales.filter((sale) => sale.amount > 0)
  if (!invoices.length && !quotes.length) return null
  const d = new Date(`${today}T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 24)
  const since24 = d.toISOString().slice(0, 10)
  const recent = sales.filter((sale) => sale.date >= since24)
  const recentInvoices = invoices.filter((sale) => sale.date >= since24)
  const dates = invoices.map((sale) => sale.date).sort()
  const lastPurchase = dates.at(-1) ?? ''
  const daysSince = lastPurchase ? daysBetween(lastPurchase, today) : null
  const frequencyDays = medianGap(recentInvoices.map((sale) => sale.date))
  return {
    purchaseCount: invoices.length,
    lastPurchase,
    daysSince,
    status: daysSince === null ? null : daysSince <= 90 ? 'activo' : daysSince <= 365 ? 'dormido' : 'inactivo',
    purchases24: recentInvoices.length,
    total24: Math.round(recent.reduce((sum, sale) => sum + sale.amount, 0)),
    frequencyDays,
    overdueDays: frequencyDays && daysSince !== null ? daysSince - frequencyDays : null,
    quotesInContabilium: quotes.length,
    lastQuote: quotes.sort().at(-1) ?? '',
    companies: [...companies].sort(),
  }
}

/** Palabras más largas del nombre (sin acentos, de 4 letras o más), con comodín `_` en lo que no sea letra o número, para ilike. */
export function searchWords(name: string, count = 2): string[] {
  const words = name.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter((word) => word.length >= 4)
  return [...new Set(words)].sort((a, b) => b.length - a.length).slice(0, count)
}

/** Compatibilidad: la palabra más larga. */
export const searchWord = (name: string): string => searchWords(name, 1)[0] ?? ''

/** Si una consulta devuelve esta cantidad de filas puede haberse cortado: el resumen quedaría incompleto. */
export const COMPROBANTES_LIMIT = 1000

/**
 * Trae los comprobantes cuyo cliente contiene las 2 palabras más características del nombre (si con 2 no hay nada, con 1);
 * el emparejado fino se hace después con nameKey. Dos palabras evitan traer 1000 facturas de clientes distintos cuando el
 * nombre tiene una palabra genérica ("distribuidora", "construcciones").
 */
export async function loadCustomerComprobantes(names: string[]): Promise<ComprobanteRow[]> {
  const base = names.map((name) => name.trim()).filter((name) => searchWords(name).length > 0).sort((a, b) => b.length - a.length)[0]
  if (!base) return []
  const words = searchWords(base)
  const run = async (used: string[]) => {
    let query = supabase.from('contabilium_comprobantes').select('company,tipo,fecha,cliente,total,neto:raw->>ImporteTotalNeto')
    for (const word of used) query = query.ilike('cliente', `%${word.replace(/[^A-Za-z0-9]/g, '_')}%`)
    const { data, error } = await query.order('fecha', { ascending: false }).limit(COMPROBANTES_LIMIT)
    if (error) throw error
    return (data ?? []) as ComprobanteRow[]
  }
  const rows = await run(words)
  return rows.length === 0 && words.length > 1 ? run(words.slice(0, 1)) : rows
}

/** Cotizaciones de este cotizador para el mismo cliente (por nombre). */
export function ownQuotesFor(quotes: SavedQuote[], names: string[], excludeNumber = ''): SavedQuote[] {
  const keys = new Set(names.map(nameKey).filter(Boolean))
  return quotes.filter((quote) => quote.meta.number !== excludeNumber && keys.has(nameKey(quote.meta.client)) && quote.meta.status !== 'borrador')
}

/** Frases listas para leer de un vistazo, siempre con datos reales; si no hay nada que decir, no devuelve nada. */
export function customerInsights(history: CustomerHistory | null, ownQuotes: SavedQuote[]): string[] {
  const out: string[] = []
  if (history?.status === 'dormido' || history?.status === 'inactivo') out.push(`No compra hace ${history.daysSince} días: buen momento para retomar el contacto.`)
  else if (history?.overdueDays !== null && history?.overdueDays !== undefined && history.overdueDays > 15 && history.frequencyDays) out.push(`Suele comprar cada ~${history.frequencyDays} días y ya pasaron ${history.daysSince}: puede estar por reponer.`)
  const accepted = ownQuotes.filter((quote) => quote.meta.status === 'aceptada').length
  if (ownQuotes.length >= 3 && accepted === 0) out.push(`Ya le hicieron ${ownQuotes.length} cotizaciones en el cotizador y ninguna se aceptó: preguntá qué lo frena (precio, plazo, cantidad).`)
  if (history && history.purchaseCount === 0 && history.quotesInContabilium > 0) out.push('Tiene cotizaciones en Contabilium pero ninguna factura todavía.')
  return out
}
