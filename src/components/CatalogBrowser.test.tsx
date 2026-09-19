import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CatalogBrowser } from './CatalogBrowser'
import * as catalogLib from '../lib/catalog'
import type { PriceList, ProductWithVariants, VariantWithPricing } from '../types/catalog'

const list = (id: string, name: string): PriceList => ({ id, name, brand: 'Resinplast', currency: 'USD', vat_rate: .21, valid_from: '2026-01-01', valid_until: null, status: 'vigente' })
const variant = (id: string, name: string, prices: Array<{ id: string; name: string; amount: number }>): VariantWithPricing => ({
  id, product_id: id, sku: id, name, unit: 'kg', attributes: {}, active: true, hasTechnicalDoc: false,
  prices: prices.map((price) => ({ id: price.id, price_list_id: price.id, variant_id: id, min_quantity: 1, max_quantity: null, amount: price.amount, status: 'confirmado', price_list: list(price.id, price.name) })),
})
const product = (id: string, name: string, item: VariantWithPricing): ProductWithVariants => ({ id, canonical_key: id, name, brand: 'Resinplast', family: 'Resinas', subfamily: '', status: 'vigente', source: 'test', source_updated_at: null, variants: [item] })

afterEach(() => { cleanup(); vi.restoreAllMocks() })

describe('listas imprimibles del catálogo', () => {
  it('muestra los kits (lo oculto se controla con Activo en Administración) y en mayorista deja solo variantes con precio mayorista', async () => {
    vi.spyOn(catalogLib, 'loadCatalog').mockResolvedValue({
      products: [
        product('p1', 'Resina minorista', variant('SKU-MIN', 'Unidad', [{ id: 'cf1', name: 'Consumidor final', amount: 10 }])),
        product('p2', 'Resina mayorista', variant('SKU-MAY', 'Unidad', [{ id: 'cf2', name: 'Consumidor final', amount: 12 }, { id: 'may', name: 'Mayorista', amount: 8 }])),
        product('p3', 'Kit resina', variant('KT-RES-1', 'Kit x 2', [{ id: 'may2', name: 'Mayorista', amount: 15 }])),
      ], families: ['Resinas'], brands: ['Resinplast'],
    })
    render(<CatalogBrowser allowPriceListPrint exchangeRate={1500} />)
    expect((await screen.findAllByText('Resina minorista')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Resina mayorista').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Kit resina').length).toBeGreaterThan(0)
    fireEvent.change(screen.getByLabelText('Lista para imprimir'), { target: { value: 'wholesale' } })
    expect(screen.queryAllByText('Resina minorista')).toHaveLength(0)
    expect(screen.getAllByText('Resina mayorista').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Lista de precios mayorista').length).toBeGreaterThan(0)
  })
})
