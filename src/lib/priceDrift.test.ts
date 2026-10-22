import { describe, expect, it } from 'vitest'
import { currentLines, priceChangeSummary, quotePriceChanges } from './priceDrift'
import type { QuoteLine, SavedQuote } from './quote'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'

const list = { id: 'pl', name: 'Lista general', brand: 'X', currency: 'USD' as const, vat_rate: 0.21, valid_from: '2026-01-01', valid_until: null, status: 'vigente' as const }
const variant = (id: string, amount: number | null): VariantWithPricing => ({
  id, product_id: `p-${id}`, sku: `SKU-${id}`, name: id, unit: 'u', attributes: {}, active: true, hasTechnicalDoc: false,
  prices: amount === null ? [] : [{ id: `pr-${id}`, price_list_id: 'pl', variant_id: id, min_quantity: 1, max_quantity: null, amount, status: 'confirmado', price_list: list }],
})
const line = (v: VariantWithPricing): QuoteLine => ({ id: v.id, productId: v.product_id, productName: `Producto ${v.id}`, brand: 'X', family: 'F', quantity: 1, variant: v })
const product = (v: VariantWithPricing) => ({ id: v.product_id, variants: [v] }) as unknown as ProductWithVariants
const quote = (...lines: QuoteLine[]): SavedQuote => ({
  meta: { number: '1', client: 'C', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1000, outputCurrency: 'USD', status: 'enviada', createdAt: '2026-10-01T10:00:00Z' },
  lines, updatedAt: '2026-10-01T10:00:00Z',
})

describe('alertas de precio', () => {
  const a = variant('a', 10), b = variant('b', 20), c = variant('c', 30), d = variant('d', 40), e = variant('e', 50)
  const saved = quote(line(a), line(b), line(c), line(d), line(e))
  const today = [product(variant('a', 11)), product(variant('b', 20)), product(variant('c', 27)), product(variant('d', null))] // 'e' ya no existe
  it('detecta lo que subió, bajó, perdió precio o se discontinuó, y calla lo que no cambió', () => {
    const changes = quotePriceChanges(saved, today)
    expect(changes.map((change) => [change.sku, change.kind])).toEqual([['SKU-a', 'subio'], ['SKU-c', 'bajo'], ['SKU-d', 'sin_precio'], ['SKU-e', 'discontinuado']])
    expect(changes[0]).toMatchObject({ before: 10, after: 11, pct: 10 })
    expect(changes[1]).toMatchObject({ before: 30, after: 27, pct: -10 })
  })
  it('sin cambios no avisa nada', () => {
    expect(quotePriceChanges(quote(line(a)), [product(variant('a', 10))])).toEqual([])
    expect(quotePriceChanges(quote(line(a)), [product(variant('a', 10.001))])).toEqual([])
  })
  it('resume en una frase y reemplaza las variantes por las de hoy', () => {
    expect(priceChangeSummary(quotePriceChanges(saved, today))).toBe('1 subió, 1 bajó, 1 sin precio vigente, 1 ya no está en el catálogo')
    const refreshed = currentLines(saved.lines, today)
    expect(refreshed[0].variant.prices[0].amount).toBe(11)
    expect(refreshed[4].variant).toBe(saved.lines[4].variant)
  })
})
