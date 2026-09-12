import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import type { CommercialRule } from '../types/commercialRules'
import { formatRuleLabel, resolveCommercialRule } from './commercialRules'

export type QuoteStatus = 'borrador' | 'enviada' | 'aceptada' | 'rechazada'
export type PaymentMethod = 'transferencia' | 'contado' | 'cuenta_corriente' | 'tarjeta'
export type PriceMode = 'automatico' | 'consumidor_final' | 'mayorista'
export const RESINPLAST_WHOLESALE_THRESHOLD_USD = 1815
export const DEFAULT_VAT_RATE = 0.21

export interface QuoteLine {
  id: string
  productId: string
  productName: string
  brand: string
  family: string
  variant: VariantWithPricing
  quantity: number
}

export interface QuoteMeta {
  number: string
  client: string
  contact: string
  phone: string
  email: string
  notes: string
  paymentMethod: PaymentMethod
  priceMode: PriceMode
  validDays: number
  discountPercent: number
  surchargePercent: number
  exchangeRate: number
  outputCurrency: 'USD' | 'ARS'
  status: QuoteStatus
  createdAt: string
}

export interface SavedQuote { meta: QuoteMeta; lines: QuoteLine[]; updatedAt: string }

export function createQuoteNumber(now = new Date()): string {
  return `GP-${now.toISOString().replace(/\D/g, '').slice(2, 12)}`
}

function listMatchesMode(name: string, mode: PriceMode) {
  const normalized = name.toLocaleLowerCase('es-AR')
  if (mode === 'mayorista') return /mayorista|distribuidor/.test(normalized)
  if (mode === 'consumidor_final') return /consumidor|\bcf\b|minorista/.test(normalized)
  return true
}

export function priceForQuantity(variant: VariantWithPricing, quantity: number, mode: PriceMode = 'automatico') {
  const candidates = variant.prices
    .filter((price) => price.price_list.status === 'vigente' && price.status === 'confirmado' && quantity >= price.min_quantity && (price.max_quantity == null || quantity <= price.max_quantity))
    .sort((a, b) => b.min_quantity - a.min_quantity)
  return candidates.find((price) => listMatchesMode(price.price_list.name, mode)) ?? candidates[0]
}

/**
 * Precio final de una línea (IVA incluido), resolviendo primero contra las
 * reglas comerciales vigentes (SKU > familia) y recién si ninguna aplica,
 * contra las listas de precio normales. `rules` se carga una vez por sesión
 * desde `commercial_rules`; si no llegó ninguna (por ejemplo, falló la carga)
 * la línea usa el precio de lista normal, nunca inventa una condición.
 */
export function resolvedLinePrice(line: QuoteLine, mode: PriceMode = 'automatico', rules: CommercialRule[] = []) {
  const ruleMatch = resolveCommercialRule(rules, {
    variantId: line.variant.id,
    family: line.family,
    quantity: line.quantity,
  })
  if (ruleMatch) {
    return {
      amount: ruleMatch.rule.gross_amount,
      currency: ruleMatch.rule.currency,
      vatRate: ruleMatch.rule.vat_rate,
      listName: formatRuleLabel(ruleMatch.rule),
      specialRule: true,
    }
  }
  const price = priceForQuantity(line.variant, line.quantity, mode)
  return price ? {
    amount: price.amount,
    currency: price.price_list.currency,
    vatRate: price.price_list.vat_rate ?? DEFAULT_VAT_RATE,
    listName: price.price_list.name,
    specialRule: false,
  } : null
}

export function resolveAutomaticPriceMode(lines: QuoteLine[]): Exclude<PriceMode, 'automatico'> {
  const resinplast = lines.filter((line) => line.brand.toLowerCase() === 'resinplast' || line.family.toLowerCase() === 'resinplast')
  if (!resinplast.length) return 'consumidor_final'
  const cfTotal = resinplast.reduce((sum, line) => {
    const price = priceForQuantity(line.variant, line.quantity, 'consumidor_final')
    return sum + (price?.price_list.currency === 'USD' ? price.amount * line.quantity : 0)
  }, 0)
  const wholesaleComplete = resinplast.every((line) => line.variant.prices.some((price) => listMatchesMode(price.price_list.name, 'mayorista')))
  return cfTotal >= RESINPLAST_WHOLESALE_THRESHOLD_USD && wholesaleComplete ? 'mayorista' : 'consumidor_final'
}

export function addQuoteLine(
  lines: QuoteLine[],
  variant: VariantWithPricing,
  product: ProductWithVariants,
): QuoteLine[] {
  const existing = lines.find((line) => line.variant.id === variant.id)
  if (existing) {
    return lines.map((line) =>
      line.variant.id === variant.id ? { ...line, quantity: line.quantity + 1 } : line,
    )
  }
  return [
    ...lines,
    {
      id: variant.id,
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      family: product.family,
      variant,
      quantity: 1,
    },
  ]
}

export function quoteLineNet(line: QuoteLine): number | null {
  const price = priceForQuantity(line.variant, line.quantity)
  return price ? price.amount * line.quantity : null
}

export function quoteTotals(lines: QuoteLine[], discountPercent = 0, surchargePercent = 0, exchangeRate = 1, outputCurrency: 'USD' | 'ARS' = 'USD', priceMode: PriceMode = 'automatico', rules: CommercialRule[] = []) {
  const appliedPriceMode = priceMode === 'automatico' ? resolveAutomaticPriceMode(lines) : priceMode
  const raw = lines.reduce(
    (totals, line) => {
      const price = resolvedLinePrice(line, appliedPriceMode, rules)
      if (!price) {
        totals.pendingLines += 1
        return totals
      }
      const gross = price.amount * line.quantity
      totals.subtotal += gross
      totals.vat += gross * price.vatRate / (1 + price.vatRate)
      totals.currencies.add(price.currency)
      return totals
    },
    { subtotal: 0, vat: 0, pendingLines: 0, currencies: new Set<string>() },
  )

  const discount = raw.subtotal * Math.max(0, discountPercent) / 100
  const surcharge = (raw.subtotal - discount) * Math.max(0, surchargePercent) / 100
  // Los importes comerciales son finales: el IVA está incluido y se informa,
  // pero nunca se suma por segunda vez.
  const total = raw.subtotal - discount + surcharge
  const conversion = outputCurrency === 'ARS' ? Math.max(0, exchangeRate) : 1
  return { ...raw, discount, surcharge, total, convertedTotal: total * conversion, appliedPriceMode }
}

export function quoteExpiry(createdAt: string, validDays: number): Date {
  const date = new Date(createdAt)
  date.setDate(date.getDate() + validDays)
  return date
}

export function serializeQuoteForWhatsApp(quote: SavedQuote, rules: CommercialRule[] = []): string {
  const { meta, lines } = quote
  const totals = quoteTotals(lines, meta.discountPercent, meta.surchargePercent, meta.exchangeRate, meta.outputCurrency, meta.priceMode, rules)
  const money = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: meta.outputCurrency }).format(amount)
  const conversion = meta.outputCurrency === 'ARS' ? meta.exchangeRate : 1
  const body = lines.map((line) => {
    const price = resolvedLinePrice(line, totals.appliedPriceMode, rules)
    const ruleNote = price?.specialRule ? ` [${price.listName}]` : ''
    return `• ${line.productName} (${line.variant.sku}) — ${line.quantity} ${line.variant.unit}: ${price ? money(price.amount * line.quantity * conversion) : 'consultar'}${ruleNote}`
  }).join('\n')
  return `*Grupo Poliplast — Cotización ${meta.number}*\n${meta.client ? `Cliente: ${meta.client}\n` : ''}${body}\n\n*Total: ${money(totals.convertedTotal)}*\nValidez: ${meta.validDays} días.${meta.notes ? `\nObservaciones: ${meta.notes}` : ''}`
}
