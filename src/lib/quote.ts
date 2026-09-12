import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'

export type QuoteStatus = 'borrador' | 'enviada' | 'aceptada' | 'rechazada'
export type PaymentMethod = 'transferencia' | 'contado' | 'cuenta_corriente' | 'tarjeta'

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

export function priceForQuantity(variant: VariantWithPricing, quantity: number) {
  return variant.prices
    .filter((price) => price.price_list.status === 'vigente' && price.status === 'confirmado' && quantity >= price.min_quantity && (price.max_quantity == null || quantity <= price.max_quantity))
    .sort((a, b) => b.min_quantity - a.min_quantity)[0]
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

export function quoteTotals(lines: QuoteLine[], discountPercent = 0, surchargePercent = 0, exchangeRate = 1, outputCurrency: 'USD' | 'ARS' = 'USD') {
  const raw = lines.reduce(
    (totals, line) => {
      const price = priceForQuantity(line.variant, line.quantity)
      if (!price) {
        totals.pendingLines += 1
        return totals
      }
      const net = price.amount * line.quantity
      const vatRate = price.price_list.vat_rate ?? 0
      totals.subtotal += net
      totals.vat += net * vatRate
      totals.currencies.add(price.price_list.currency)
      return totals
    },
    { subtotal: 0, vat: 0, pendingLines: 0, currencies: new Set<string>() },
  )

  const discount = raw.subtotal * Math.max(0, discountPercent) / 100
  const surcharge = (raw.subtotal - discount) * Math.max(0, surchargePercent) / 100
  const total = raw.subtotal - discount + surcharge + raw.vat
  const conversion = outputCurrency === 'ARS' ? Math.max(0, exchangeRate) : 1
  return { ...raw, discount, surcharge, total, convertedTotal: total * conversion }
}

export function quoteExpiry(createdAt: string, validDays: number): Date {
  const date = new Date(createdAt)
  date.setDate(date.getDate() + validDays)
  return date
}

export function serializeQuoteForWhatsApp(quote: SavedQuote): string {
  const { meta, lines } = quote
  const totals = quoteTotals(lines, meta.discountPercent, meta.surchargePercent, meta.exchangeRate, meta.outputCurrency)
  const money = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: meta.outputCurrency }).format(amount)
  const conversion = meta.outputCurrency === 'ARS' ? meta.exchangeRate : 1
  const body = lines.map((line) => {
    const price = priceForQuantity(line.variant, line.quantity)
    return `• ${line.productName} (${line.variant.sku}) — ${line.quantity} ${line.variant.unit}: ${price ? money(price.amount * line.quantity * conversion) : 'consultar'}`
  }).join('\n')
  return `*Grupo Poliplast — Cotización ${meta.number}*\n${meta.client ? `Cliente: ${meta.client}\n` : ''}${body}\n\n*Total: ${money(totals.convertedTotal)}*\nValidez: ${meta.validDays} días.${meta.notes ? `\nObservaciones: ${meta.notes}` : ''}`
}
