import type { QuoteLine, SavedQuote } from './quote'

export interface TogetherSuggestion {
  productId: string
  name: string
  /** Variante que más se cotizó de este producto (para sugerir la presentación habitual). */
  variantId: string
  /** En cuántas cotizaciones anteriores apareció junto con lo que ya está en esta. */
  together: number
  /** Del total de cotizaciones que tenían algo de lo actual, qué parte incluyó este producto (0 a 1). */
  share: number
}

/**
 * "Se suele cotizar junto": mira el historial de cotizaciones guardadas y, para lo que ya hay en la cotización
 * en curso, propone los productos que más veces los acompañaron. No inventa nada: si no hay historial
 * suficiente (`minTogether` coincidencias) no sugiere. `excludeNumber` evita contar la propia cotización
 * cuando se está editando una ya guardada.
 */
export function frequentlyTogether(
  quotes: SavedQuote[],
  lines: QuoteLine[],
  { limit = 4, minTogether = 2, excludeNumber = '' }: { limit?: number; minTogether?: number; excludeNumber?: string } = {},
): TogetherSuggestion[] {
  const current = new Set(lines.map((line) => line.productId))
  if (current.size === 0) return []
  const counts = new Map<string, { name: string; together: number; variants: Map<string, number> }>()
  let related = 0
  for (const quote of quotes) {
    if (excludeNumber && quote.meta.number === excludeNumber) continue
    const ids = new Set(quote.lines.map((line) => line.productId))
    if (![...current].some((id) => ids.has(id))) continue
    related += 1
    for (const line of quote.lines) {
      if (current.has(line.productId)) continue
      const entry = counts.get(line.productId) ?? { name: line.productName, together: 0, variants: new Map() }
      entry.variants.set(line.variant.id, (entry.variants.get(line.variant.id) ?? 0) + 1)
      counts.set(line.productId, entry)
    }
    for (const id of ids) {
      if (current.has(id)) continue
      const entry = counts.get(id)
      if (entry) entry.together += 1
    }
  }
  return [...counts.entries()]
    .filter(([, entry]) => entry.together >= minTogether)
    .map(([productId, entry]) => ({
      productId,
      name: entry.name,
      variantId: [...entry.variants.entries()].sort((a, b) => b[1] - a[1])[0][0],
      together: entry.together,
      share: related ? entry.together / related : 0,
    }))
    .sort((a, b) => b.together - a.together || b.share - a.share || a.name.localeCompare(b.name))
    .slice(0, limit)
}
