import { quoteTotals, type SavedQuote } from './quote'
import { monthKeyAR } from './dates'
import type { CommercialRule } from '../types/commercialRules'

// Resumen del historial de cotizaciones (mismas ideas que el historial de Ventas del CRM): cuánto se
// cotizó por mes en dólares y en qué estado están. Una cotización no es una venta: esto mide lo
// propuesto, no lo vendido.
export interface MonthBar { key: string; label: string; usd: number; count: number }

const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

export function quoteUsd(quote: SavedQuote, rules: CommercialRule[] = []): number {
  const { meta, lines } = quote
  const totals = quoteTotals(lines, meta.discountPercent, meta.surchargePercent, meta.exchangeRate, 'USD', meta.priceMode, rules)
  if (totals.currencies.size !== 1) return 0
  const [currency] = [...totals.currencies]
  if (currency === 'USD') return totals.total
  return meta.exchangeRate > 0 ? totals.total / meta.exchangeRate : 0
}

export function quoteInsights(quotes: SavedQuote[], rules: CommercialRule[] = [], today = new Date(), months = 6) {
  const bars: MonthBar[] = []
  for (let back = months - 1; back >= 0; back -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - back, 1)
    bars.push({ key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`, label: MONTHS[date.getMonth()], usd: 0, count: 0 })
  }
  const byKey = new Map(bars.map((bar) => [bar.key, bar]))
  for (const quote of quotes) {
    const bar = byKey.get(quote.meta.createdAt ? monthKeyAR(quote.meta.createdAt) : '')
    if (!bar) continue
    bar.usd += quoteUsd(quote, rules)
    bar.count += 1
  }
  const current = bars.at(-1)!
  const sent = quotes.filter((quote) => quote.meta.status === 'enviada').length
  const accepted = quotes.filter((quote) => quote.meta.status === 'aceptada').length
  const rejected = quotes.filter((quote) => quote.meta.status === 'rechazada').length
  return {
    bars,
    monthCount: current.count,
    monthUsd: current.usd,
    waiting: sent,
    acceptance: accepted + rejected ? Math.round((accepted / (accepted + rejected)) * 100) : null,
    accepted,
  }
}

const DAY = 86_400_000

export interface FollowUp { quote: SavedQuote; days: number; usd: number }

/** Cotizaciones enviadas que llevan `minDays` o más sin movimiento: las más viejas primero. */
export function followUps(quotes: SavedQuote[], rules: CommercialRule[] = [], today = new Date(), minDays = 3): FollowUp[] {
  return quotes
    .filter((quote) => quote.meta.status === 'enviada')
    .map((quote) => ({ quote, days: Math.floor((today.getTime() - new Date(quote.updatedAt || quote.meta.createdAt).getTime()) / DAY), usd: quoteUsd(quote, rules) }))
    .filter((item) => Number.isFinite(item.days) && item.days >= minDays)
    .sort((a, b) => b.days - a.days)
}

export function followUpMessage(quote: SavedQuote): string {
  const name = (quote.meta.contact || '').trim().split(/\s+/)[0]
  const created = new Date(quote.meta.createdAt).toLocaleDateString('es-AR')
  return `Hola${name ? ` ${name}` : ''}, ¿cómo estás? Te escribo por la cotización ${quote.meta.number} que te pasamos el ${created}. ¿Pudiste verla? Si querés ajustamos cantidades o armamos otra opción.`
}

const STATUS_ORDER: SavedQuote['meta']['status'][] = ['borrador', 'enviada', 'aceptada', 'rechazada']

/** Cantidad de cotizaciones por estado, siempre en el mismo orden (para el gráfico de dona). */
export function statusBreakdown(quotes: SavedQuote[]) {
  return STATUS_ORDER.map((status) => ({ status, count: quotes.filter((quote) => quote.meta.status === status).length }))
}

/** Productos más cotizados (por cantidad de cotizaciones en que aparecen, no por unidades). */
export function topProducts(quotes: SavedQuote[], limit = 5) {
  const counts = new Map<string, { name: string; quotes: number }>()
  for (const quote of quotes) {
    for (const productId of new Set(quote.lines.map((line) => line.productId))) {
      const line = quote.lines.find((item) => item.productId === productId)!
      const entry = counts.get(productId) ?? { name: line.productName, quotes: 0 }
      entry.quotes += 1
      counts.set(productId, entry)
    }
  }
  return [...counts.values()].sort((a, b) => b.quotes - a.quotes || a.name.localeCompare(b.name)).slice(0, limit)
}

export interface RepeatQuoter { client: string; quotes: number; lastDays: number; lastNumber: string; totalUsd: number }

const clientKey = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Clientes que piden cotización seguido y nunca cierran: `minQuotes` o más cotizaciones (sin contar borradores)
 * y ninguna aceptada. Una señal para llamar y entender qué frena (precio, plazo, cantidad), no una venta perdida segura.
 */
export function repeatQuoters(quotes: SavedQuote[], rules: CommercialRule[] = [], today = new Date(), minQuotes = 3): RepeatQuoter[] {
  const byClient = new Map<string, SavedQuote[]>()
  for (const quote of quotes) {
    const key = clientKey(quote.meta.client || '')
    if (!key || quote.meta.status === 'borrador') continue
    byClient.set(key, [...(byClient.get(key) ?? []), quote])
  }
  const result: RepeatQuoter[] = []
  for (const list of byClient.values()) {
    if (list.length < minQuotes || list.some((quote) => quote.meta.status === 'aceptada')) continue
    const last = [...list].sort((a, b) => new Date(b.updatedAt || b.meta.createdAt).getTime() - new Date(a.updatedAt || a.meta.createdAt).getTime())[0]
    result.push({
      client: last.meta.client,
      quotes: list.length,
      lastDays: Math.max(0, Math.floor((today.getTime() - new Date(last.updatedAt || last.meta.createdAt).getTime()) / DAY)),
      lastNumber: last.meta.number,
      totalUsd: list.reduce((sum, quote) => sum + quoteUsd(quote, rules), 0),
    })
  }
  return result.sort((a, b) => b.quotes - a.quotes || b.totalUsd - a.totalUsd)
}
