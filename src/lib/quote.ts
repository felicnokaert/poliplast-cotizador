import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import type { CommercialRule } from '../types/commercialRules'
import { formatRuleLabel, resolveCommercialRule } from './commercialRules'
import { packGroupOf, parsePackMultiplierFromName, unitsPerPack } from './packs'

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

/**
 * Un SKU puede representar un pack. Evita contar un pack x20 como una unidad
 * física. Fallback por nombre únicamente (sin `attributes.units_per_pack`
 * persistido) — se mantiene para compatibilidad y para el diagnóstico de
 * migración; la resolución real de precios usa `unitsPerPack` (packs.ts),
 * que prioriza el atributo persistido.
 */
export function unitsPerSellUnit(line: Pick<QuoteLine, 'productName' | 'family'>): number {
  return parsePackMultiplierFromName(line.productName) ?? 1
}

function physicalUnits(line: QuoteLine): number {
  return line.quantity * unitsPerPack({ name: line.productName, attributes: line.variant.attributes })
}

function sumPhysicalUnits(lines: QuoteLine[]): number {
  return lines.reduce((sum, item) => sum + physicalUnits(item), 0)
}

export function createQuoteNumber(now = new Date()): string {
  const digits = now.toISOString().replace(/\D/g, '')
  return `GP-${digits.slice(2, 8)}-${digits.slice(8, 14)}-${digits.slice(14, 17)}`
}

function listMatchesMode(name: string, mode: PriceMode) {
  const normalized = name.toLocaleLowerCase('es-AR')
  if (mode === 'mayorista') return /mayorista|distribuidor/.test(normalized)
  if (mode === 'consumidor_final') return /consumidor|\bcf\b|minorista/.test(normalized)
  return true
}

export function priceForQuantity(variant: VariantWithPricing, quantity: number, mode: PriceMode = 'automatico') {
  const today = new Date().toISOString().slice(0, 10)
  const candidates = variant.prices
    .filter((price) => price.price_list.status === 'vigente' && price.status === 'confirmado' && price.price_list.valid_from <= today && (!price.price_list.valid_until || price.price_list.valid_until >= today) && quantity >= price.min_quantity && (price.max_quantity == null || quantity <= price.max_quantity))
    .sort((a, b) => b.min_quantity - a.min_quantity || b.price_list.valid_from.localeCompare(a.price_list.valid_from))
  return candidates.find((price) => listMatchesMode(price.price_list.name, mode)) ?? candidates[0]
}

/**
 * Precio final de una línea (IVA incluido), resolviendo primero contra las
 * reglas comerciales vigentes y recién si ninguna aplica, contra las listas
 * de precio normales. `rules` se carga una vez por sesión desde
 * `commercial_rules`; si no llegó ninguna (por ejemplo, falló la carga) la
 * línea usa el precio de lista normal, nunca inventa una condición.
 *
 * Cuatro categorías de regla, en este orden de precedencia:
 * 1. SKU puntual, cantidad propia (`scope_type='sku'`, sin agregación).
 * 2. SKU puntual, cantidad agregada por presentaciones hermanas del mismo
 *    producto (`aggregate_by_pack_group`, ej. Penosil x1/x3/x6/x12).
 * 3. SKU puntual, cantidad agregada por toda la familia (`aggregate_by_family`,
 *    ej. Baldes: el tramo lo define el total de baldes, el precio es por SKU).
 * 4. Familia completa, un solo precio para todos los SKU (ej. Almohadas).
 *
 * El monto de la regla (`gross_amount`) siempre se interpreta como precio
 * final por UNIDAD FÍSICA, y se multiplica por las unidades físicas de esta
 * línea (`unitsPerPack`) — así un pack x4 cobra 4 veces el precio unitario
 * sin necesidad de una fila de regla por cada tamaño de pack.
 */
export function resolvedLinePrice(line: QuoteLine, mode: PriceMode = 'automatico', rules: CommercialRule[] = [], contextLines: QuoteLine[] = [line]) {
  const input = { variantId: line.variant.id, family: line.family }
  const sameFamily = contextLines.filter((item) => item.family === line.family)
  const familyPhysical = sumPhysicalUnits(sameFamily)

  const thisPackGroup = packGroupOf({ name: line.productName, attributes: line.variant.attributes })
  const packGroupPhysical = thisPackGroup
    ? sumPhysicalUnits(sameFamily.filter((item) => packGroupOf({ name: item.productName, attributes: item.variant.attributes }) === thisPackGroup))
    : 0

  const skuRulesPlain = rules.filter((r) => r.scope_type === 'sku' && !r.aggregate_by_family && !r.aggregate_by_pack_group)
  const skuRulesPackGroup = rules.filter((r) => r.scope_type === 'sku' && r.aggregate_by_pack_group)
  const skuRulesFamilyAgg = rules.filter((r) => r.scope_type === 'sku' && r.aggregate_by_family)
  const familyRules = rules.filter((r) => r.scope_type === 'family')

  const ruleMatch =
    resolveCommercialRule(skuRulesPlain, { ...input, quantity: physicalUnits(line) }) ??
    (thisPackGroup ? resolveCommercialRule(skuRulesPackGroup, { ...input, packGroup: thisPackGroup, quantity: packGroupPhysical }) : null) ??
    resolveCommercialRule(skuRulesFamilyAgg, { ...input, quantity: familyPhysical }) ??
    resolveCommercialRule(familyRules, { ...input, quantity: familyPhysical })

  if (ruleMatch) {
    return {
      amount: ruleMatch.rule.gross_amount * unitsPerPack({ name: line.productName, attributes: line.variant.attributes }),
      currency: ruleMatch.rule.currency,
      vatRate: ruleMatch.rule.vat_rate,
      listName: formatRuleLabel(ruleMatch.rule),
      specialRule: true,
      ruleId: ruleMatch.rule.id,
    }
  }
  const price = priceForQuantity(line.variant, line.quantity, mode)
  return price ? {
    amount: price.amount,
    currency: price.price_list.currency,
    vatRate: price.price_list.vat_rate ?? DEFAULT_VAT_RATE,
    listName: price.price_list.name,
    specialRule: false,
    ruleId: null,
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
      const price = resolvedLinePrice(line, appliedPriceMode, rules, lines)
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
    const price = resolvedLinePrice(line, totals.appliedPriceMode, rules, lines)
    const ruleNote = price?.specialRule ? ` [${price.listName}]` : ''
    return `• ${line.productName} (${line.variant.sku}) — ${line.quantity} ${line.variant.unit}: ${price ? money(price.amount * line.quantity * conversion) : 'consultar'}${ruleNote}`
  }).join('\n')
  return `*Grupo Poliplast — Cotización ${meta.number}*\n${meta.client ? `Cliente: ${meta.client}\n` : ''}${body}\n\n*Total: ${money(totals.convertedTotal)}*\nValidez: ${meta.validDays} días.${meta.notes ? `\nObservaciones: ${meta.notes}` : ''}`
}
