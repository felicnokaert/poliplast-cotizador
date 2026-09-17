import { describe, expect, it } from 'vitest'
import { buildCatalogReview, suggestedSkuBase } from './catalogReview'
import type { AdminCatalogRow } from './admin'

const row = (sku: string, producto: string): AdminCatalogRow => ({ product_id: sku, variant_id: sku, active: true, product_status: 'vigente', sku, producto, variante: producto, marca: 'Resinplast', familia: 'Resinas', subfamilia: '', unidad: 'kg', precio_consumidor_final: 1, precio_mayorista: '', moneda_precio: 'USD', costo: '', moneda_costo: '', stock: '', unidad_stock: '', fuente: '', photo_path: null })

describe('revisión asistida del catálogo', () => {
  it('obtiene la familia de presentaciones desde el SKU', () => {
    expect(suggestedSkuBase('RE-608-1')).toBe('RE-608')
    expect(suggestedSkuBase('RE-608-5')).toBe('RE-608')
  })

  it('detecta SKU idénticos, misma base y nombres reordenados', () => {
    const result = buildCatalogReview([
      row('RE-608-1', 'Resina epoxi 1 kg'), row('RE-608-5', 'Epoxi resina 5 kg'),
      row('DUP-1', 'Vidrio líquido cristal'), row('DUP-1', 'Vidrio líquido cristal'),
    ])
    expect(result.filter((item) => item.motivo_detectado === 'Mismo SKU base, distinta presentación')).toHaveLength(2)
    expect(result.filter((item) => item.motivo_detectado === 'SKU idéntico repetido')).toHaveLength(2)
  })
})
