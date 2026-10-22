import { resolvedLinePrice, type QuoteLine, type SavedQuote } from './quote'
import type { CommercialRule } from '../types/commercialRules'
import type { ProductWithVariants } from '../types/catalog'

// Alertas de precio: una cotización guardada lleva una foto de los precios del día en que se armó. Si la lista de precios
// cambió después, mandarla tal cual puede ser un error. Esto compara cada renglón contra el catálogo de HOY (mismo tipo de
// cambio y mismas reglas, para medir solo el cambio de la lista) y dice qué subió, qué bajó y qué ya no se vende.

export type PriceChangeKind = 'subio' | 'bajo' | 'sin_precio' | 'discontinuado'

export interface PriceChange {
  lineId: string
  sku: string
  name: string
  kind: PriceChangeKind
  /** Precio unitario (con IVA, por presentación) guardado en la cotización. */
  before: number | null
  /** Precio de hoy; null si ya no tiene precio vigente o dejó de existir. */
  after: number | null
  /** Variación porcentual (positiva = sube). */
  pct: number | null
}

const round = (value: number) => Math.round(value * 100) / 100

/** Los renglones de la cotización con la variante (y por lo tanto el precio) del catálogo de hoy. Lo discontinuado queda igual. */
export function currentLines(lines: QuoteLine[], products: ProductWithVariants[]): QuoteLine[] {
  const variants = new Map(products.flatMap((product) => product.variants.map((variant) => [variant.id, variant] as const)))
  return lines.map((line) => {
    const variant = variants.get(line.variant.id)
    return variant ? { ...line, variant } : line
  })
}

export function quotePriceChanges(quote: SavedQuote, products: ProductWithVariants[], rules: CommercialRule[] = [], tolerance = 0.005): PriceChange[] {
  const known = new Set(products.flatMap((product) => product.variants.map((variant) => variant.id)))
  const today = currentLines(quote.lines, products)
  const { priceMode, exchangeRate } = quote.meta
  const changes: PriceChange[] = []
  quote.lines.forEach((line, index) => {
    const base = { lineId: line.id, sku: line.variant.sku, name: line.productName }
    const before = resolvedLinePrice(line, priceMode, rules, quote.lines, exchangeRate)
    if (!known.has(line.variant.id)) { changes.push({ ...base, kind: 'discontinuado', before: before ? round(before.amount) : null, after: null, pct: null }); return }
    const after = resolvedLinePrice(today[index], priceMode, rules, today, exchangeRate)
    if (!before && !after) return
    if (before && !after) { changes.push({ ...base, kind: 'sin_precio', before: round(before.amount), after: null, pct: null }); return }
    if (!before || !after) return
    if (before.currency !== after.currency) { changes.push({ ...base, kind: after.amount > before.amount ? 'subio' : 'bajo', before: round(before.amount), after: round(after.amount), pct: null }); return }
    const delta = (after.amount - before.amount) / (before.amount || 1)
    if (Math.abs(delta) < tolerance) return
    changes.push({ ...base, kind: delta > 0 ? 'subio' : 'bajo', before: round(before.amount), after: round(after.amount), pct: Math.round(delta * 1000) / 10 })
  })
  return changes
}

export const hasPriceChanges = (changes: PriceChange[]) => changes.length > 0

/** Resumen corto para una tarjeta: "2 subieron, 1 bajó". */
export function priceChangeSummary(changes: PriceChange[]): string {
  const count = (kind: PriceChangeKind) => changes.filter((change) => change.kind === kind).length
  const parts = [
    count('subio') && `${count('subio')} ${count('subio') === 1 ? 'subió' : 'subieron'}`,
    count('bajo') && `${count('bajo')} ${count('bajo') === 1 ? 'bajó' : 'bajaron'}`,
    count('sin_precio') && `${count('sin_precio')} sin precio vigente`,
    count('discontinuado') && `${count('discontinuado')} ya no ${count('discontinuado') === 1 ? 'está' : 'están'} en el catálogo`,
  ].filter(Boolean)
  return parts.join(', ')
}
