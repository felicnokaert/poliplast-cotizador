import { describe, expect, it } from 'vitest'
import { filterCatalog, paginateCatalog } from './filters'
import type { ProductWithVariants } from '../types/catalog'

function makeProduct(overrides: Partial<ProductWithVariants> = {}): ProductWithVariants {
  return {
    id: 'p1',
    canonical_key: 'SKU-1',
    name: 'ADHESIVO POLIURETANICO 1000CC',
    brand: 'Grupo Poliplast',
    family: 'CARROZADOS',
    subfamily: 'Adheplast',
    status: 'vigente',
    source: 'test',
    source_updated_at: null,
    variants: [
      {
        id: 'v1',
        product_id: 'p1',
        sku: 'SKU-1',
        name: 'ADHESIVO POLIURETANICO 1000CC',
        unit: 'unidad',
        attributes: {},
        active: true,
        hasTechnicalDoc: false,
        prices: [
          {
            id: 'pr1',
            price_list_id: 'pl1',
            variant_id: 'v1',
            min_quantity: 1,
            max_quantity: null,
            amount: 22.13,
            status: 'confirmado',
            price_list: {
              id: 'pl1',
              name: 'Lista',
              brand: 'Grupo Poliplast',
              currency: 'ARS',
              vat_rate: null,
              valid_from: '2026-01-01',
              valid_until: null,
              status: 'vigente',
            },
          },
        ],
      },
    ],
    ...overrides,
  }
}

function withPendingPrice(product: ProductWithVariants): ProductWithVariants {
  return { ...product, variants: product.variants.map((v) => ({ ...v, prices: [] })) }
}

describe('filterCatalog', () => {
  const purmacBase = makeProduct({ id: 'p2', family: 'PURMAC', brand: 'PURMAC', name: 'AIR CAP', canonical_key: 'AIRCAP' })
  const purmac = {
    ...purmacBase,
    variants: purmacBase.variants.map((v) => ({ ...v, sku: 'AIRCAP', name: 'AIR CAP' })),
  }
  const catalog = [makeProduct(), purmac, withPendingPrice(makeProduct({ id: 'p3', canonical_key: 'SKU-3', name: 'ALGO SIN PRECIO' }))]

  it('sin filtros devuelve todos los productos vigentes', () => {
    expect(filterCatalog(catalog, { search: '', family: 'todas', brand: 'todas', priceFilter: 'todos' })).toHaveLength(3)
  })

  it('excluye productos que no están vigentes', () => {
    const withExcluded = [...catalog, makeProduct({ id: 'p4', canonical_key: 'X', status: 'excluido' })]
    expect(filterCatalog(withExcluded, { search: '', family: 'todas', brand: 'todas', priceFilter: 'todos' })).toHaveLength(3)
  })

  it('filtra por familia exacta', () => {
    const result = filterCatalog(catalog, { search: '', family: 'PURMAC', brand: 'todas', priceFilter: 'todos' })
    expect(result.map((p) => p.id)).toEqual(['p2'])
  })

  it('filtra por marca exacta', () => {
    const result = filterCatalog(catalog, { search: '', family: 'todas', brand: 'Grupo Poliplast', priceFilter: 'todos' })
    expect(result.map((p) => p.id).sort()).toEqual(['p1', 'p3'])
  })

  it('busca por nombre, SKU y familia sin distinguir mayúsculas', () => {
    const bySku = filterCatalog(catalog, { search: 'aircap', family: 'todas', brand: 'todas', priceFilter: 'todos' })
    expect(bySku.map((p) => p.id)).toEqual(['p2'])

    const byFamily = filterCatalog(catalog, { search: 'carrozados', family: 'todas', brand: 'todas', priceFilter: 'todos' })
    expect(byFamily.map((p) => p.id).sort()).toEqual(['p1', 'p3'])
  })

  it('con_precio deja solo variantes con precio vigente', () => {
    const result = filterCatalog(catalog, { search: '', family: 'todas', brand: 'todas', priceFilter: 'con_precio' })
    expect(result.map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })

  it('precio_pendiente deja solo variantes sin precio vigente', () => {
    const result = filterCatalog(catalog, { search: '', family: 'todas', brand: 'todas', priceFilter: 'precio_pendiente' })
    expect(result.map((p) => p.id)).toEqual(['p3'])
  })
})

describe('paginateCatalog', () => {
  it('renderiza solo la página solicitada y limita páginas fuera de rango', () => {
    expect(paginateCatalog([1, 2, 3, 4, 5], 2, 2)).toEqual({ items: [3, 4], page: 2, pageCount: 3, total: 5 })
    expect(paginateCatalog([1, 2, 3], 99, 2).items).toEqual([3])
  })
})
