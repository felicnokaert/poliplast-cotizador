import { describe, expect, it } from 'vitest'
import { mlPriceMap, rarePriceWarning } from './rarePrice'

describe('precio raro', () => {
  const ml = mlPriceMap([
    { sku: 'RE-608-0.450', price: 27000, sold_quantity: 10, title: 'Resina 450 g' },
    { sku: '', price: 50000, sold_quantity: 5, title: 'Guantes', variation_skus: [{ sku: 'gune-l' }] },
    { sku: 'RE-608-0.450', price: 99999, sold_quantity: 1, title: 'menos vendida' },
  ])
  it('toma la publicación que más vendió y también el SKU de cada variación', () => {
    expect(ml.get('RE-608-0.450')?.price).toBe(27000)
    expect(ml.get('GUNE-L')?.price).toBe(50000)
  })
  it('avisa cuando la lista y ML no cierran', () => {
    expect(rarePriceWarning(468.91, 'USD', ml.get('RE-608-0.450'), 1500)).toMatch(/la lista está 26(,\d)? veces más cara/)
    expect(rarePriceWarning(15, 'USD', ml.get('RE-608-0.450'), 1500)).toBeNull()
  })
  it('sin dólar o sin publicación no avisa', () => {
    expect(rarePriceWarning(468.91, 'USD', ml.get('RE-608-0.450'), 0)).toBeNull()
    expect(rarePriceWarning(468.91, 'USD', undefined, 1500)).toBeNull()
  })
})
