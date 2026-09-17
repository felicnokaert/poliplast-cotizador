import { describe, expect, it } from 'vitest'
import { assembleCatalog, fetchAll, matchesDocument } from './catalog'
import type { CatalogProduct, CatalogVariant } from '../types/catalog'

function product(overrides: Partial<CatalogProduct> = {}): CatalogProduct {
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
    ...overrides,
  }
}

function variant(overrides: Partial<CatalogVariant> = {}): CatalogVariant {
  return {
    id: 'v1',
    product_id: 'p1',
    sku: 'SKU-1',
    name: 'ADHESIVO POLIURETANICO 1000CC',
    unit: 'unidad',
    attributes: {},
    active: true,
    ...overrides,
  }
}

describe('matchesDocument', () => {
  it('matches by exact SKU regardless of case/whitespace', () => {
    const doc = { id: 'd1', title: 't', family: '', product: '', sku: ' sku-1 ', status: 'vigente' }
    expect(matchesDocument(doc, variant(), product())).toBe(true)
  })

  it('matches by family + product name when SKU is absent', () => {
    const doc = {
      id: 'd1',
      title: 't',
      family: 'carrozados',
      product: 'adhesivo poliuretanico 1000cc',
      sku: '',
      status: 'vigente',
    }
    expect(matchesDocument(doc, variant({ sku: 'OTRO-SKU' }), product())).toBe(true)
  })

  it('does not match a document that is not vigente', () => {
    const doc = { id: 'd1', title: 't', family: '', product: '', sku: 'SKU-1', status: 'desactualizado' }
    expect(matchesDocument(doc, variant(), product())).toBe(false)
  })

  it('does not match unrelated family/product combos', () => {
    const doc = { id: 'd1', title: 't', family: 'PURMAC', product: 'OTRO PRODUCTO', sku: '', status: 'vigente' }
    expect(matchesDocument(doc, variant(), product())).toBe(false)
  })
})

describe('assembleCatalog', () => {
  it('agrupa variantes bajo su producto y resuelve el precio vigente', () => {
    const raw = {
      products: [product()],
      variants: [variant()],
      priceLists: [
        {
          id: 'pl1',
          name: 'Lista general',
          brand: 'Grupo Poliplast',
          currency: 'ARS' as const,
          vat_rate: null,
          valid_from: '2026-01-01',
          valid_until: null,
          status: 'vigente' as const,
        },
      ],
      prices: [
        {
          id: 'price1',
          price_list_id: 'pl1',
          variant_id: 'v1',
          min_quantity: 1,
          max_quantity: null,
          amount: 100,
          status: 'confirmado' as const,
        },
      ],
      docs: [],
    }

    const result = assembleCatalog(raw)
    expect(result.products).toHaveLength(1)
    expect(result.products[0].variants).toHaveLength(1)
    expect(result.products[0].variants[0].prices[0].amount).toBe(100)
    expect(result.families).toEqual(['CARROZADOS'])
    expect(result.brands).toEqual(['Grupo Poliplast'])
  })

  it('ignora precios de listas que no vinieron en la carga (join huérfano)', () => {
    const raw = {
      products: [product()],
      variants: [variant()],
      priceLists: [],
      prices: [
        {
          id: 'price1',
          price_list_id: 'lista-inexistente',
          variant_id: 'v1',
          min_quantity: 1,
          max_quantity: null,
          amount: 100,
          status: 'confirmado' as const,
        },
      ],
      docs: [],
    }

    const result = assembleCatalog(raw)
    expect(result.products[0].variants[0].prices).toHaveLength(0)
  })

  it('un producto sin variantes queda vacío pero visible', () => {
    const raw = { products: [product()], variants: [], priceLists: [], prices: [], docs: [] }
    const result = assembleCatalog(raw)
    expect(result.products[0].variants).toEqual([])
  })

  it('suma únicamente saldos aprobados de la misma unidad y conserva la fecha', () => {
    const raw = { products: [product()], variants: [variant()], priceLists: [], prices: [], docs: [], inventory: [
      { variant_id: 'v1', approved_quantity: 4, unit: 'kg', approved_at: '2026-09-10T10:00:00Z' },
      { variant_id: 'v1', approved_quantity: 6, unit: 'kg', approved_at: '2026-09-11T10:00:00Z' },
    ] }
    expect(assembleCatalog(raw).products[0].variants[0].approvedStock).toEqual({ quantity: 10, unit: 'kg', approvedAt: '2026-09-11T10:00:00Z' })
  })

  it('no inventa un total si dos depósitos usan unidades incompatibles', () => {
    const raw = { products: [product()], variants: [variant()], priceLists: [], prices: [], docs: [], inventory: [
      { variant_id: 'v1', approved_quantity: 4, unit: 'kg', approved_at: '2026-09-10T10:00:00Z' },
      { variant_id: 'v1', approved_quantity: 1, unit: 'unidad', approved_at: '2026-09-11T10:00:00Z' },
    ] }
    expect(assembleCatalog(raw).products[0].variants[0].approvedStock).toBeNull()
  })

  it('no muestra una variante desactivada en Administración', () => {
    const raw = { products: [product()], variants: [variant({ id: 'v1', active: true }), variant({ id: 'v2', sku: 'SKU-2', active: false })], priceLists: [], prices: [], docs: [] }
    const result = assembleCatalog(raw)
    expect(result.products[0].variants.map((v) => v.id)).toEqual(['v1'])
  })

  it('no muestra un producto marcado como excluido', () => {
    const raw = { products: [product({ status: 'excluido' })], variants: [variant()], priceLists: [], prices: [], docs: [] }
    expect(assembleCatalog(raw).products).toHaveLength(0)
  })

  it('solo confirma una ficha cuando existe un vínculo formal y el documento está vigente', () => {
    const doc = { id: 'd1', title: 'Ficha', family: 'CARROZADOS', product: 'ADHESIVO POLIURETANICO 1000CC', sku: 'SKU-1', status: 'vigente' }
    const withoutLink = assembleCatalog({ products: [product()], variants: [variant()], priceLists: [], prices: [], docs: [doc] })
    expect(withoutLink.products[0].variants[0].hasTechnicalDoc).toBe(false)
    const linked = assembleCatalog({ products: [product()], variants: [variant()], priceLists: [], prices: [], docs: [doc], documentLinks: [{ document_id: 'd1', scope_type: 'variant', variant_id: 'v1', product_id: null, family: null, subfamily: null }] })
    expect(linked.products[0].variants[0].hasTechnicalDoc).toBe(true)
    expect(linked.products[0].variants[0].technicalDocuments?.[0].title).toBe('Ficha')
  })
})

describe('fetchAll', () => {
  it('junta todas las páginas hasta que una vuelve más corta que el tamaño de página', async () => {
    const pageSize = 1000
    const page1 = Array.from({ length: pageSize }, (_, i) => i)
    const page2 = Array.from({ length: 50 }, (_, i) => pageSize + i)
    const calls: [number, number][] = []
    const build = (from: number, to: number) => {
      calls.push([from, to])
      const data = from === 0 ? page1 : page2
      return Promise.resolve({ data, error: null })
    }
    const result = await fetchAll(build)
    expect(result).toHaveLength(pageSize + 50)
    expect(calls).toEqual([[0, 999], [1000, 1999]])
  })

  it('con una sola página corta, no pide una segunda', async () => {
    const build = (from: number, to: number) => {
      expect(from).toBe(0)
      expect(to).toBe(999)
      return Promise.resolve({ data: [1, 2, 3], error: null })
    }
    expect(await fetchAll(build)).toEqual([1, 2, 3])
  })

  it('propaga el error de una página sin devolver datos parciales', async () => {
    const build = () => Promise.resolve({ data: null, error: { message: 'boom' } })
    await expect(fetchAll(build)).rejects.toEqual({ message: 'boom' })
  })
})
