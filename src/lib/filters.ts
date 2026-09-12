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

function matchesSearch(product: ProductWithVariants, term: string): boolean {
  if (!term) return true
  const haystack = [
    product.name,
    product.family,
    product.subfamily,
    product.brand,
    ...product.variants.map((v) => `${v.sku} ${v.name}`),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(term)
}

/** Aplica búsqueda y filtros de familia/marca/precio sobre el catálogo cargado. Función pura, sin estado de React. */
export function filterCatalog(products: ProductWithVariants[], filters: CatalogFilters): ProductWithVariants[] {
  const term = filters.search.trim().toLowerCase()

  return products
    .filter((p) => p.status === 'vigente')
    .filter((p) => (filters.family === 'todas' ? true : p.family === filters.family))
    .filter((p) => (!filters.subfamily || filters.subfamily === 'todas' ? true : p.subfamily === filters.subfamily))
    .filter((p) => (filters.brand === 'todas' ? true : p.brand === filters.brand))
    .map((product) => filterVariantsByPrice(product, filters.priceFilter))
    .filter((product): product is ProductWithVariants => product !== null)
    .filter((product) => matchesSearch(product, term))
}
