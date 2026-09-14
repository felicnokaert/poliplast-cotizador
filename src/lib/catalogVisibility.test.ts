import { describe, expect, it } from 'vitest'
import { isKitPresentation, withoutKits } from './catalogVisibility'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'

const variant = (name: string): VariantWithPricing => ({
  id: name, product_id: 'p1', sku: name, name, unit: 'unidad', attributes: {}, active: true,
  prices: [], hasTechnicalDoc: false,
})

const product = (name: string, variants: VariantWithPricing[]): ProductWithVariants => ({
  id: name, canonical_key: name, name, brand: 'Resinplast', family: 'Resinas', subfamily: '',
  status: 'vigente', source: 'test', source_updated_at: null, variants,
})

describe('visibilidad del catálogo del cotizador', () => {
  it('detecta kits y combos sin confundir palabras parciales', () => {
    expect(isKitPresentation('Kit resina epoxi', variant('1 kg'))).toBe(true)
    expect(isKitPresentation('Resina epoxi', variant('Combo x 2'))).toBe(true)
    expect(isKitPresentation('Mosquitero', variant('Unidad'))).toBe(false)
  })

  it('quita solo las presentaciones kit y conserva las unitarias', () => {
    const result = withoutKits([product('Resina', [variant('Unidad'), variant('Kit x 2')])])
    expect(result).toHaveLength(1)
    expect(result[0].variants.map((item) => item.name)).toEqual(['Unidad'])
  })

  it('quita el producto cuando todas sus presentaciones son kits', () => {
    expect(withoutKits([product('Kit almohadas', [variant('x 2'), variant('x 4')])])).toEqual([])
  })
})
