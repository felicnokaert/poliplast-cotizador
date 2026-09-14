import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import type { CommercialRule } from '../types/commercialRules'
import type { PaymentPolicy } from './paymentPolicies'
import { formatRuleLabel, resolveCommercialRule } from './commercialRules'
import { packGroupOf, parsePackMultiplierFromName, unitsPerPack } from './packs'

export type QuoteStatus = 'borrador' | 'enviada' | 'aceptada' | 'rechazada'
export type PaymentMethod = string
export type PriceMode = 'automatico' | 'consumidor_final' | 'mayorista'
export const RESINPLAST_WHOLESALE_THRESHOLD_USD = 1815
export const PENOSIL_WHOLESALE_THRESHOLD_NET_USD = 1800
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
  paymentTermDays?: number
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

export function whatsappUrl(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.startsWith('15')) digits = digits.slice(2)
  if (digits && !digits.startsWith('54')) digits = `54${digits}`
  const query = `text=${encodeURIComponent(message)}`
  return digits ? `https://wa.me/${digits}?${query}` : `https://api.whatsapp.com/send?${query}`
}

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

export function physicalUnits(line: QuoteLine): number {
  return line.quantity * unitsPerPack({ name: line.productName, attributes: line.variant.attributes })
}

function sumPhysicalUnits(lines: QuoteLine[]): number {
  return lines.reduce((sum, item) => sum + physicalUnits(item), 0)
}

function isPenosil(line: QuoteLine): boolean {
  return line.brand.toLowerCase() === 'penosil' || line.family.toLowerCase() === 'penosil'
}

function penosilNetTotal(lines: QuoteLine[]): number {
  return lines.filter(isPenosil).reduce((sum, line) => {
    const price = priceForQuantity(line.variant, line.quantity, 'consumidor_final')
    if (!price || price.price_list.currency !== 'USD') return sum
    return sum + price.amount * line.quantity / (1 + (price.price_list.vat_rate ?? DEFAULT_VAT_RATE))
  }, 0)
}

export function createQuoteNumber(_now = new Date(), existingNumbers: string[] = []): string {
  const highest = existingNumbers.reduce((max, value) => {
    const match = value.match(/^(?:GP-)?(\d{1,})$/)
    return match ? Math.max(max, Number(match[1])) : max
  }, 0)
  return String(highest + 1).padStart(4, '0')
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
export function resolvedLinePrice(line: QuoteLine, mode: PriceMode = 'automatico', rules: CommercialRule[] = [], contextLines: QuoteLine[] = [line], exchangeRate = 1) {
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

  const penosilWholesale = isPenosil(line) && (mode === 'mayorista' || (mode === 'automatico' && penosilNetTotal(contextLines) >= PENOSIL_WHOLESALE_THRESHOLD_NET_USD))
  const ruleMatch = isPenosil(line)
    ? (penosilWholesale && thisPackGroup ? resolveCommercialRule(skuRulesPackGroup, { ...input, packGroup: thisPackGroup, quantity: Number.MAX_SAFE_INTEGER }) : null)
    : resolveCommercialRule(skuRulesPlain, { ...input, quantity: physicalUnits(line) }) ??
      (thisPackGroup ? resolveCommercialRule(skuRulesPackGroup, { ...input, packGroup: thisPackGroup, quantity: packGroupPhysical }) : null) ??
      resolveCommercialRule(skuRulesFamilyAgg, { ...input, quantity: familyPhysical }) ??
      resolveCommercialRule(familyRules, { ...input, quantity: familyPhysical })

  if (ruleMatch) {
    if (ruleMatch.rule.currency === 'ARS' && exchangeRate <= 0) return null
    return {
      amount: ruleMatch.rule.gross_amount * unitsPerPack({ name: line.productName, attributes: line.variant.attributes }) / (ruleMatch.rule.currency === 'ARS' ? exchangeRate : 1),
      currency: 'USD' as const,
      vatRate: ruleMatch.rule.vat_rate,
      listName: formatRuleLabel(ruleMatch.rule, 'USD', ruleMatch.rule.gross_amount / (ruleMatch.rule.currency === 'ARS' ? exchangeRate : 1)),
      specialRule: true,
      ruleId: ruleMatch.rule.id,
    }
  }
  const effectiveMode = mode === 'automatico' ? resolveAutomaticPriceMode(contextLines) : mode
  const price = priceForQuantity(line.variant, line.quantity, effectiveMode)
  if (price?.price_list.currency === 'ARS' && exchangeRate <= 0) return null
  return price ? {
    amount: price.amount / (price.price_list.currency === 'ARS' ? exchangeRate : 1),
    currency: 'USD' as const,
    vatRate: price.price_list.vat_rate ?? DEFAULT_VAT_RATE,
    listName: price.price_list.name,
    specialRule: false,
    ruleId: null,
  } : null
}

export interface LinePricingDetails {
  price: ReturnType<typeof resolvedLinePrice>
  physicalUnits: number
  unitsPerPack: number
  countedUnits: number
  countScope: 'renglón' | 'producto' | 'familia'
  priceLabel: string
  condition: string
  outcome: string
  netUnitAmount: number | null
  grossUnitAmount: number | null
}

function isResinplast(line: QuoteLine): boolean {
  return line.brand.toLowerCase() === 'resinplast' || line.family.toLowerCase() === 'resinplast'
}

function matchesRuleScope(rule: CommercialRule, line: QuoteLine): boolean {
  if (rule.scope_type === 'family') return rule.family === line.family
  if (rule.aggregate_by_pack_group) {
    const group = packGroupOf({ name: line.productName, attributes: line.variant.attributes })
    return !!group && rule.pack_group === group
  }
  return rule.variant_id === line.variant.id
}

function thresholdText(rule: CommercialRule): string {
  return `${rule.quantity_comparator === 'gt' ? 'más de' : 'desde'} ${rule.min_quantity}`
}

/**
 * Fuente única de la explicación comercial consumida por pantalla, PDF y WhatsApp.
 * No decide precios por segunda vez: parte siempre de resolvedLinePrice().
 */
export function linePricingDetails(
  line: QuoteLine,
  mode: PriceMode = 'automatico',
  rules: CommercialRule[] = [],
  contextLines: QuoteLine[] = [line],
  exchangeRate = 0,
): LinePricingDetails {
  const price = resolvedLinePrice(line, mode, rules, contextLines, exchangeRate)
  const perPack = unitsPerPack({ name: line.productName, attributes: line.variant.attributes })
  const linePhysical = physicalUnits(line)
  const familyLines = contextLines.filter((item) => item.family === line.family)
  const familyPhysical = sumPhysicalUnits(familyLines)
  const group = packGroupOf({ name: line.productName, attributes: line.variant.attributes })
  const groupPhysical = group
    ? sumPhysicalUnits(familyLines.filter((item) => packGroupOf({ name: item.productName, attributes: item.variant.attributes }) === group))
    : linePhysical
  const applicableRules = rules.filter((rule) => rule.status === 'confirmado' && matchesRuleScope(rule, line) && !isPenosil(line))
  const appliedRule = price?.ruleId ? applicableRules.find((rule) => rule.id === price.ruleId) : undefined
  const usesFamilyCount = !!appliedRule?.aggregate_by_family || appliedRule?.scope_type === 'family'
  const usesGroupCount = !!appliedRule?.aggregate_by_pack_group
  const countScope = usesFamilyCount ? 'familia' : usesGroupCount ? 'producto' : 'renglón'
  const countedUnits = usesFamilyCount ? familyPhysical : usesGroupCount ? groupPhysical : linePhysical
  const vatRate = price?.vatRate ?? DEFAULT_VAT_RATE
  const grossUnitAmount = price ? price.amount / perPack : null
  const netUnitAmount = grossUnitAmount == null ? null : grossUnitAmount / (1 + vatRate)

  if (price?.ruleId && isPenosil(line)) {
    const netTotal = penosilNetTotal(contextLines)
    return {
      price,
      physicalUnits: linePhysical,
      unitsPerPack: perPack,
      countedUnits: netTotal,
      countScope: 'producto',
      priceLabel: 'Mayorista Penosil · mezcla de cajas habilitada',
      condition: `USD ${netTotal.toFixed(2)} netos de Penosil computados; condición desde USD ${PENOSIL_WHOLESALE_THRESHOLD_NET_USD.toFixed(2)} netos + IVA.`,
      outcome: 'Mayorista Penosil aplicado.',
      netUnitAmount,
      grossUnitAmount,
    }
  }

  if (appliedRule && price) {
    const nextRule = applicableRules
      .filter((rule) => rule.min_quantity > appliedRule.min_quantity)
      .sort((a, b) => a.min_quantity - b.min_quantity)[0]
    const nextRequired = nextRule ? nextRule.min_quantity + (nextRule.quantity_comparator === 'gt' ? 1 : 0) : 0
    const nextNote = nextRule && countedUnits < nextRequired
      ? ` Próximo tramo: faltan ${nextRequired - countedUnits} unidades físicas para ${thresholdText(nextRule)}.`
      : ''
    return {
      price,
      physicalUnits: linePhysical,
      unitsPerPack: perPack,
      countedUnits,
      countScope,
      priceLabel: price.listName,
      condition: `${countedUnits} unidades físicas computadas por ${countScope}; condición ${thresholdText(appliedRule)}.`,
      outcome: `Regla aplicada.${nextNote}`,
      netUnitAmount,
      grossUnitAmount,
    }
  }

  const nextRule = applicableRules
    .map((rule) => {
      const scopeUnits = rule.aggregate_by_family || rule.scope_type === 'family' ? familyPhysical : rule.aggregate_by_pack_group ? groupPhysical : linePhysical
      const required = rule.min_quantity + (rule.quantity_comparator === 'gt' ? 1 : 0)
      return { rule, scopeUnits, required, missing: Math.max(0, required - scopeUnits) }
    })
    .filter((candidate) => candidate.missing > 0)
    .sort((a, b) => a.missing - b.missing)[0]

  let condition = `${linePhysical} unidades físicas en este renglón.`
  let outcome = price ? `Se usa ${price.listName}; no hay una regla especial aplicable.` : 'Precio pendiente: no hay una lista confirmada aplicable.'
  if (nextRule) {
    const scope = nextRule.rule.aggregate_by_family || nextRule.rule.scope_type === 'family' ? 'familia' : nextRule.rule.aggregate_by_pack_group ? 'producto' : 'renglón'
    condition = `${nextRule.scopeUnits} unidades físicas computadas por ${scope}; condición ${thresholdText(nextRule.rule)}.`
    outcome = `Se usa ${price?.listName ?? 'precio pendiente'}; faltan ${nextRule.missing} unidades físicas para el siguiente precio.`
  } else if (isPenosil(line) && mode === 'automatico') {
    const netTotal = penosilNetTotal(contextLines)
    condition = `Penosil: USD ${netTotal.toFixed(2)} netos computados entre todas las cajas; mayorista desde USD ${PENOSIL_WHOLESALE_THRESHOLD_NET_USD.toFixed(2)} netos + IVA.`
    outcome = netTotal >= PENOSIL_WHOLESALE_THRESHOLD_NET_USD
      ? `Umbral alcanzado, pero el precio mayorista de este SKU está pendiente; se mantiene ${price?.listName ?? 'precio pendiente'}.`
      : `Se usa ${price?.listName ?? 'precio pendiente'}; faltan USD ${(PENOSIL_WHOLESALE_THRESHOLD_NET_USD - netTotal).toFixed(2)} netos para mayorista.`
  } else if (isResinplast(line) && mode === 'consumidor_final') {
    const resinLines = contextLines.filter(isResinplast)
    const cfTotal = resinLines.reduce((sum, item) => {
      const cf = priceForQuantity(item.variant, item.quantity, 'consumidor_final')
      return sum + (cf?.price_list.currency === 'USD' ? cf.amount * item.quantity : 0)
    }, 0)
    const missingWholesale = resinLines.filter((item) => !item.variant.prices.some((candidate) => candidate.status === 'confirmado' && listMatchesMode(candidate.price_list.name, 'mayorista')))
    condition = `Resinplast: USD ${cfTotal.toFixed(2)} computados; mayorista desde USD ${RESINPLAST_WHOLESALE_THRESHOLD_USD.toFixed(2)}.`
    outcome = missingWholesale.length > 0 && cfTotal >= RESINPLAST_WHOLESALE_THRESHOLD_USD
      ? `Se usa consumidor final: mayorista pendiente en ${missingWholesale.length} SKU de la cotización.`
      : `Se usa consumidor final: faltan USD ${Math.max(0, RESINPLAST_WHOLESALE_THRESHOLD_USD - cfTotal).toFixed(2)} para el mínimo mayorista.`
  }

  return { price, physicalUnits: linePhysical, unitsPerPack: perPack, countedUnits: nextRule?.scopeUnits ?? linePhysical, countScope: 'renglón', priceLabel: price?.listName ?? 'Sin precio confirmado', condition, outcome, netUnitAmount, grossUnitAmount }
}

export function automaticPricingSummary(lines: QuoteLine[], appliedMode: Exclude<PriceMode, 'automatico'>, rules: CommercialRule[] = []): string {
  const penosilLines = lines.filter(isPenosil)
  if (penosilLines.length) {
    const netTotal = penosilNetTotal(lines)
    const pending = penosilLines.filter((line) => !rules.some((rule) => rule.status === 'confirmado' && rule.aggregate_by_pack_group && matchesRuleScope(rule, line))).length
    if (netTotal >= PENOSIL_WHOLESALE_THRESHOLD_NET_USD && pending > 0) return `Penosil alcanzó USD ${netTotal.toFixed(2)} netos, pero hay ${pending} SKU con precio mayorista pendiente.`
    return netTotal >= PENOSIL_WHOLESALE_THRESHOLD_NET_USD
      ? `Mayorista Penosil aplicado: USD ${netTotal.toFixed(2)} netos entre todas las cajas mezcladas + IVA.`
      : `Penosil consumidor final: USD ${netTotal.toFixed(2)} netos entre cajas; faltan USD ${(PENOSIL_WHOLESALE_THRESHOLD_NET_USD - netTotal).toFixed(2)} netos para mayorista.`
  }
  const resinLines = lines.filter(isResinplast)
  if (!resinLines.length) return 'Cada renglón usa su lista vigente y las reglas confirmadas de cantidad, producto o familia.'
  const cfTotal = resinLines.reduce((sum, line) => {
    const price = priceForQuantity(line.variant, line.quantity, 'consumidor_final')
    return sum + (price?.price_list.currency === 'USD' ? price.amount * line.quantity : 0)
  }, 0)
  const pending = resinLines.filter((line) => !line.variant.prices.some((price) => price.status === 'confirmado' && listMatchesMode(price.price_list.name, 'mayorista'))).length
  if (appliedMode === 'mayorista') return `Mayorista Resinplast aplicado: USD ${cfTotal.toFixed(2)} y todos los SKU tienen precio mayorista confirmado.`
  if (cfTotal < RESINPLAST_WHOLESALE_THRESHOLD_USD) return `Consumidor final Resinplast: USD ${cfTotal.toFixed(2)}; faltan USD ${(RESINPLAST_WHOLESALE_THRESHOLD_USD - cfTotal).toFixed(2)} para llegar a USD ${RESINPLAST_WHOLESALE_THRESHOLD_USD.toFixed(2)}.`
  return `Consumidor final Resinplast: se alcanzó USD ${RESINPLAST_WHOLESALE_THRESHOLD_USD.toFixed(2)}, pero hay ${pending} SKU con mayorista pendiente.`
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

export function quoteTotals(lines: QuoteLine[], discountPercent = 0, surchargePercent = 0, exchangeRate = 1, _outputCurrency: 'USD' | 'ARS' = 'USD', priceMode: PriceMode = 'automatico', rules: CommercialRule[] = []) {
  const appliedPriceMode = priceMode === 'automatico' ? resolveAutomaticPriceMode(lines) : priceMode
  const raw = lines.reduce(
    (totals, line) => {
      const price = resolvedLinePrice(line, priceMode, rules, lines, exchangeRate)
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
  return { ...raw, discount, surcharge, total, convertedTotal: total, appliedPriceMode }
}

export function quoteExpiry(createdAt: string, validDays: number): Date {
  const date = new Date(createdAt)
  date.setDate(date.getDate() + validDays)
  return date
}

export function serializeQuoteForWhatsApp(quote: SavedQuote, rules: CommercialRule[] = [], paymentPolicy?: PaymentPolicy): string {
  const { meta, lines } = quote
  const totals = quoteTotals(lines, meta.discountPercent, meta.surchargePercent, meta.exchangeRate, meta.outputCurrency, meta.priceMode, rules)
  const money = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: meta.outputCurrency }).format(amount)
  const conversion = 1
  const body = lines.map((line) => {
    const details = linePricingDetails(line, meta.priceMode, rules, lines, meta.exchangeRate)
    const price = details.price
    return `• ${line.productName} (${line.variant.sku}) — ${line.quantity} ${line.variant.unit} / ${details.physicalUnits} u. físicas: ${price ? money(price.amount * line.quantity * conversion) : 'consultar'}\n  ${details.priceLabel}. ${details.condition} ${details.outcome}`
  }).join('\n')
  const policy = meta.priceMode === 'automatico' ? automaticPricingSummary(lines, totals.appliedPriceMode, rules) : `Lista seleccionada: ${meta.priceMode === 'mayorista' ? 'Mayorista' : 'Consumidor final'}.`
  const pesoReference = totals.currencies.size === 1 && totals.currencies.has('USD') && meta.exchangeRate > 0
    ? `\nEquivalente estimado: ${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(totals.total * meta.exchangeRate)} (${new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(meta.exchangeRate)} por USD).`
    : ''
  const paymentName = paymentPolicy?.name ?? meta.paymentMethod.replace('_', ' ')
  const paymentTerm = meta.paymentMethod === 'cheque' ? ` a ${meta.paymentTermDays ?? 0} días` : ''
  const paymentText = paymentPolicy?.customerText ? ` ${paymentPolicy.customerText}` : ''
  return `*Grupo Poliplast — Cotización ${meta.number}*\n${meta.client ? `Cliente: ${meta.client}\n` : ''}Política: ${policy}\n\n${body}\n\n*Total: ${money(totals.convertedTotal)}* (IVA incluido)${pesoReference}\nForma de pago: ${paymentName}${paymentTerm}.${paymentText}\nValidez: ${meta.validDays} días.${meta.notes ? `\nObservaciones: ${meta.notes}` : ''}`
}
