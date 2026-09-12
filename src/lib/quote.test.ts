import { describe, expect, it } from 'vitest'
import { addQuoteLine, createQuoteNumber, priceForQuantity, quoteExpiry, quoteTotals, serializeQuoteForWhatsApp } from './quote'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'

const variant = {
  id: 'v1', product_id: 'p1', sku: 'SKU-1', name: 'Producto', unit: 'u', attributes: {}, active: true,
  hasTechnicalDoc: false,
  prices: [{
    id: 'vp1', price_list_id: 'pl1', variant_id: 'v1', min_quantity: 1, max_quantity: null,
    amount: 100, status: 'confirmado',
    price_list: { id: 'pl1', name: 'Base', brand: 'Grupo Poliplast', currency: 'USD', vat_rate: 0.21, valid_from: '2026-01-01', valid_until: null, status: 'vigente' },
  }, {
    id: 'vp2', price_list_id: 'pl1', variant_id: 'v1', min_quantity: 10, max_quantity: null,
    amount: 80, status: 'confirmado', price_list: { id: 'pl1', name: 'Base', brand: 'Grupo Poliplast', currency: 'USD', vat_rate: 0.21, valid_from: '2026-01-01', valid_until: null, status: 'vigente' },
  }],
} satisfies VariantWithPricing

const product = {
  id: 'p1', canonical_key: 'p1', name: 'Producto', brand: 'Grupo Poliplast', family: 'Otros', subfamily: '', status: 'vigente', source: 'test', source_updated_at: null,
  variants: [variant],
} satisfies ProductWithVariants

describe('quote', () => {
  it('genera numeración comercial legible', () => expect(createQuoteNumber(new Date('2026-09-11T12:34:00Z'))).toBe('GP-2609111234'))
  it('agrega una variante y acumula la cantidad al repetirla', () => {
    const once = addQuoteLine([], variant, product)
    const twice = addQuoteLine(once, variant, product)
    expect(twice).toHaveLength(1)
    expect(twice[0].quantity).toBe(2)
  })

  it('elige el tramo correspondiente a la cantidad', () => {
    expect(priceForQuantity(variant, 2)?.amount).toBe(100)
    expect(priceForQuantity(variant, 12)?.amount).toBe(80)
  })

  it('calcula descuento, recargo, IVA y conversión por separado', () => {
    const lines = addQuoteLine([], variant, product).map((line) => ({ ...line, quantity: 10 }))
    const totals = quoteTotals(lines, 10, 5, 1000, 'ARS')
    expect(totals.subtotal).toBe(800)
    expect(totals.discount).toBe(80)
    expect(totals.surcharge).toBe(36)
    expect(totals.vat).toBe(168)
    expect(totals.convertedTotal).toBe(924000)
  })

  it('calcula vigencia', () => expect(quoteExpiry('2026-09-11T00:00:00Z', 10).toISOString().slice(0, 10)).toBe('2026-09-21'))

  it('genera texto compartible y trazable', () => {
    const lines = addQuoteLine([], variant, product)
    const text = serializeQuoteForWhatsApp({ meta: { number: 'GP-1', client: 'Cliente', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status: 'borrador', createdAt: '2026-09-11T00:00:00Z' }, lines, updatedAt: '2026-09-11T00:00:00Z' })
    expect(text).toContain('GP-1')
    expect(text).toContain('SKU-1')
  })
})
