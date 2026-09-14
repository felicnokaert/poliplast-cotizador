import type { AdminCatalogRow } from './admin'

const fold = (value: unknown) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9+]+/g, ' ').trim()
const bundlePattern = /\b(?:KITS?|COMBOS?|SETS?)\b/
const stopWords = new Set(['DE', 'DEL', 'LA', 'EL', 'PARA', 'POR', 'CON', 'SIN', 'X', 'KG', 'KGS', 'GR', 'GRAMOS', 'LT', 'LTS', 'LITROS', 'ML', 'CC', 'UNIDAD', 'UNIDADES'])

export function suggestedSkuBase(sku: string): string {
  return sku.trim().toUpperCase().replace(/([._-])(?:0?\.\d+|\d+(?:[.,]\d+)?)$/, '').replace(/[._-]+$/, '')
}

export function isCombinedCatalogRow(row: AdminCatalogRow): boolean {
  const description = `${row.producto} ${row.variante} ${row.subfamilia}`
  return bundlePattern.test(fold(description)) || /^KT-/i.test(row.sku) || description.includes('+')
}

const nameTokens = (row: AdminCatalogRow) => [...new Set(fold(`${row.producto} ${row.variante}`).split(' ').filter((token) => token.length > 1 && !stopWords.has(token) && !/^\d+$/.test(token)))]
const similarity = (a: string[], b: string[]) => {
  const right = new Set(b)
  return a.filter((token) => right.has(token)).length / Math.max(new Set([...a, ...b]).size, 1)
}

export interface CatalogReviewRow extends AdminCatalogRow {
  grupo_sugerido: string
  confianza: 'Alta' | 'Media'
  motivo_detectado: string
  accion_sugerida: string
  decision_felipe: string
  nombre_corregido: string
  sku_base_confirmado: string
  observaciones: string
}

export function buildCatalogReview(catalog: AdminCatalogRow[]): CatalogReviewRow[] {
  const exactCounts = new Map<string, number>()
  const baseCounts = new Map<string, number>()
  for (const row of catalog) {
    exactCounts.set(`${fold(row.marca)}|${fold(row.sku)}`, (exactCounts.get(`${fold(row.marca)}|${fold(row.sku)}`) ?? 0) + 1)
    const base = suggestedSkuBase(row.sku)
    baseCounts.set(`${fold(row.marca)}|${base}`, (baseCounts.get(`${fold(row.marca)}|${base}`) ?? 0) + 1)
  }
  const parent = catalog.map((_, index) => index)
  const find = (value: number): number => parent[value] === value ? value : (parent[value] = find(parent[value]))
  const join = (a: number, b: number) => { const aa = find(a); const bb = find(b); if (aa !== bb) parent[bb] = aa }
  const buckets = new Map<string, number[]>()
  catalog.forEach((row, index) => {
    const key = `${fold(row.marca)}|${fold(row.familia)}`
    buckets.set(key, [...(buckets.get(key) ?? []), index])
  })
  for (const indexes of buckets.values()) for (let a = 0; a < indexes.length; a += 1) for (let b = a + 1; b < indexes.length; b += 1) {
    const left = catalog[indexes[a]], right = catalog[indexes[b]]
    const leftBase = suggestedSkuBase(left.sku), rightBase = suggestedSkuBase(right.sku)
    if (leftBase && leftBase === rightBase && (baseCounts.get(`${fold(left.marca)}|${leftBase}`) ?? 0) > 1) join(indexes[a], indexes[b])
    else if (!isCombinedCatalogRow(left) && !isCombinedCatalogRow(right) && similarity(nameTokens(left), nameTokens(right)) >= .82) join(indexes[a], indexes[b])
  }
  const sizes = new Map<number, number>()
  catalog.forEach((_, index) => sizes.set(find(index), (sizes.get(find(index)) ?? 0) + 1))
  const groupNames = new Map<number, string>()
  let sequence = 0
  catalog.forEach((_, index) => { const root = find(index); if ((sizes.get(root) ?? 0) > 1 && !groupNames.has(root)) groupNames.set(root, `G-${String(++sequence).padStart(4, '0')}`) })

  return catalog.flatMap((row, index) => {
    const exact = (exactCounts.get(`${fold(row.marca)}|${fold(row.sku)}`) ?? 0) > 1
    const combined = isCombinedCatalogRow(row)
    const base = suggestedSkuBase(row.sku)
    const sameBase = (baseCounts.get(`${fold(row.marca)}|${base}`) ?? 0) > 1
    const similar = (sizes.get(find(index)) ?? 0) > 1
    if (!exact && !combined && !sameBase && !similar) return []
    const motivo = exact ? 'SKU idéntico repetido' : combined ? 'Kit, set, combo o producto compuesto' : sameBase ? 'Mismo SKU base, distinta presentación' : 'Nombre muy similar dentro de marca y familia'
    const confianza: CatalogReviewRow['confianza'] = exact || combined || sameBase ? 'Alta' : 'Media'
    return [{
      ...row,
      grupo_sugerido: groupNames.get(find(index)) ?? '',
      confianza,
      motivo_detectado: motivo,
      accion_sugerida: exact ? 'Desactivar duplicado' : combined ? 'Ocultar cotizador' : sameBase ? 'Agrupar presentaciones' : 'Revisar posible duplicado',
      decision_felipe: 'Pendiente', nombre_corregido: '', sku_base_confirmado: base, observaciones: '',
    }]
  }).sort((a, b) => a.marca.localeCompare(b.marca, 'es') || a.grupo_sugerido.localeCompare(b.grupo_sugerido) || a.sku.localeCompare(b.sku))
}
