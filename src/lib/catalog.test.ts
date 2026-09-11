import { describe, expect, it } from 'vitest'
import { assembleCatalog, matchesDocument } from './catalog'
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
})
