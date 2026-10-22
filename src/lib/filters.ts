import type { ProductWithVariants } from '../types/catalog'
import { hasVigentPrice } from './pricing'

export type PriceFilter = 'todos' | 'con_precio' | 'precio_pendiente'

export interface CatalogFilters {
  search: string
  family: string
  subfamily?: string
  brand: string
  priceFilter: PriceFilter
}

function filterVariantsByPrice(product: ProductWithVariants, filter: PriceFilter): ProductWithVariants | null {
  if (filter === 'todos') return product
  const variants = product.variants.filter((v) => {
    const hasPrice = hasVigentPrice(v)
    return filter === 'con_precio' ? hasPrice : !hasPrice
  })
  if (variants.length === 0) return null
  return { ...product, variants }
}

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** ¿Las dos palabras difieren en a lo sumo una letra (cambiada, sobrante, faltante o dos letras cruzadas)? */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  if (Math.abs(a.length - b.length) > 1) return false
  if (a.length === b.length) {
    let diffs = 0
    let first = -1
    for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) { diffs += 1; if (first < 0) first = i; if (diffs > 2) return false }
    if (diffs <= 1) return true
    return diffs === 2 && a[first] === b[first + 1] && a[first + 1] === b[first]
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a]
  let i = 0
  while (i < short.length && short[i] === long[i]) i += 1
  return short.slice(i) === long.slice(i + 1)
}

/**
 * Búsqueda tolerante: sin acentos ni mayúsculas, con las palabras en cualquier orden y perdonando un error de tipeo
 * en palabras de 5 letras o más ("poliuretno" encuentra poliuretano). Devuelve 0 si no coincide; más alto = mejor.
 */
function searchScore(product: ProductWithVariants, term: string): number {
  if (!term) return 1
  const haystack = normalize([product.name, product.family, product.subfamily, product.brand, ...product.variants.map((v) => `${v.sku} ${v.name}`)].join(' '))
  const words = new Set(haystack.split(/[^a-z0-9]+/).filter(Boolean))
  const name = normalize(product.name)
  let score = 0
  for (const token of normalize(term).split(/\s+/).filter(Boolean)) {
    if (haystack.includes(token)) score += name.includes(token) ? 3 : 2
    else if (token.length >= 5 && !/[0-9]/.test(token) && [...words].some((word) => word.length >= 4 && withinOneEdit(token, word))) score += 1
    else return 0
  }
  return score
}

/** Aplica búsqueda y filtros de familia/marca/precio sobre el catálogo cargado. Función pura, sin estado de React. */
export function filterCatalog(products: ProductWithVariants[], filters: CatalogFilters): ProductWithVariants[] {
  const term = filters.search.trim()

  return products
    .filter((p) => p.status === 'vigente')
    .filter((p) => (filters.family === 'todas' ? true : p.family === filters.family))
    .filter((p) => (!filters.subfamily || filters.subfamily === 'todas' ? true : p.subfamily === filters.subfamily))
    .filter((p) => (filters.brand === 'todas' ? true : p.brand === filters.brand))
    .map((product) => filterVariantsByPrice(product, filters.priceFilter))
    .filter((product): product is ProductWithVariants => product !== null)
    .map((product) => ({ product, score: searchScore(product, term) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => (term ? b.score - a.score : 0))
    .map((item) => item.product)
}

export function paginateCatalog<T>(items: T[], page: number, pageSize: number) {
  const safeSize = Math.max(1, Math.floor(pageSize))
  const pageCount = Math.max(1, Math.ceil(items.length / safeSize))
  const safePage = Math.min(Math.max(1, Math.floor(page)), pageCount)
  const start = (safePage - 1) * safeSize
  return { items: items.slice(start, start + safeSize), page: safePage, pageCount, total: items.length }
}
