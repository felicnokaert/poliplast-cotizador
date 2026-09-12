import { describe, expect, it } from 'vitest'
import { commercialPrices, currentPrice, hasVigentPrice } from './pricing'
import type { VariantWithPricing } from '../types/catalog'

function priceList(overrides: Partial<VariantWithPricing['prices'][number]['price_list']> = {}) {
  return {
    id: 'pl1',
    name: 'Lista',
    brand: 'Grupo Poliplast',
    currency: 'ARS' as const,
    vat_rate: null,
    valid_from: '2026-01-01',
    valid_until: null,
    status: 'vigente' as const,
    ...overrides,
  }
}

function variantWith(prices: VariantWithPricing['prices']): VariantWithPricing {
  return {
    id: 'v1',
    product_id: 'p1',
    sku: 'SKU-1',
    name: 'Producto',
    unit: 'unidad',
    attributes: {},
    active: true,
    prices,
    hasTechnicalDoc: false,
  }
}

describe('currentPrice', () => {
  it('devuelve el precio confirmado de una lista vigente', () => {
    const v = variantWith([
      { id: 'pr1', price_list_id: 'pl1', variant_id: 'v1', min_quantity: 1, max_quantity: null, amount: 50, status: 'confirmado', price_list: priceList() },
    ])
    expect(currentPrice(v)?.amount).toBe(50)
  })

  it('ignora precios de listas vencidas o en borrador', () => {
    const v = variantWith([
      { id: 'pr1', price_list_id: 'pl1', variant_id: 'v1', min_quantity: 1, max_quantity: null, amount: 50, status: 'confirmado', price_list: priceList({ status: 'vencida' }) },
    ])
    expect(currentPrice(v)).toBeUndefined()
  })

  it('ignora precios marcados como excepcion_manual sin confirmar', () => {
    const v = variantWith([
      { id: 'pr1', price_list_id: 'pl1', variant_id: 'v1', min_quantity: 1, max_quantity: null, amount: 50, status: 'pendiente', price_list: priceList() },
    ])
    expect(currentPrice(v)).toBeUndefined()
  })

  it('sin ningún precio cargado, no hay precio vigente', () => {
    expect(currentPrice(variantWith([]))).toBeUndefined()
  })

  it('elige la lista más nueva y respeta vigencias, no el orden de Supabase', () => {
    const v = variantWith([
      { id: 'old', price_list_id: 'old-list', variant_id: 'v1', min_quantity: 1, max_quantity: null, amount: 50, status: 'confirmado', price_list: priceList({ id: 'old-list', valid_from: '2026-01-01' }) },
      { id: 'future', price_list_id: 'future-list', variant_id: 'v1', min_quantity: 1, max_quantity: null, amount: 90, status: 'confirmado', price_list: priceList({ id: 'future-list', valid_from: '2026-10-01' }) },
      { id: 'new', price_list_id: 'new-list', variant_id: 'v1', min_quantity: 1, max_quantity: null, amount: 60, status: 'confirmado', price_list: priceList({ id: 'new-list', valid_from: '2026-09-01' }) },
    ])
    expect(currentPrice(v, '2026-09-12')?.amount).toBe(60)
  })
})

describe('hasVigentPrice', () => {
  it('es true si alguna lista asociada está vigente, sin importar el estado del precio', () => {
    const v = variantWith([
      { id: 'pr1', price_list_id: 'pl1', variant_id: 'v1', min_quantity: 1, max_quantity: null, amount: 50, status: 'pendiente', price_list: priceList() },
    ])
    expect(hasVigentPrice(v)).toBe(true)
  })

  it('es false cuando no hay ninguna lista vigente asociada', () => {
    expect(hasVigentPrice(variantWith([]))).toBe(false)
  })
})

describe('commercialPrices', () => {
  it('separa consumidor final y mayorista sin confundir las listas', () => {
    const v = variantWith([
      { id: 'cf', price_list_id: 'cf-list', variant_id: 'v1', min_quantity: 1, max_quantity: null, amount: 10, status: 'confirmado', price_list: priceList({ id: 'cf-list', name: 'Catálogo Maestro' }) },
      { id: 'may', price_list_id: 'may-list', variant_id: 'v1', min_quantity: 1, max_quantity: null, amount: 7.8, status: 'confirmado', price_list: priceList({ id: 'may-list', name: 'Resinplast Mayorista 2026' }) },
    ])
    expect(commercialPrices(v).consumer?.amount).toBe(10)
    expect(commercialPrices(v).wholesale?.amount).toBe(7.8)
  })
})
