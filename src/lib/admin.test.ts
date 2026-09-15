import { describe, expect, it } from 'vitest'
import { buildCostImportRows, buildPriceImportRows, csvEscape, parseAdminCsv, previewAdminImport, previewCatalogActiveReview, rowsToCsv, type AdminCatalogRow } from './admin'

describe('CSV administrativo', () => {
  it('escapa comas y comillas', () => expect(csvEscape('Resina, "A"')).toBe('"Resina, ""A"""'))
  it('exporta encabezados y filas', () => expect(rowsToCsv([{ sku: 'A1', costo: 10 }])).toBe('sku,costo\nA1,10'))
  it('tolera lotes vacíos', () => expect(rowsToCsv([])).toBe(''))
})

const catalog: AdminCatalogRow[] = [{ product_id: 'p1', variant_id: 'v1', active: true, product_status: 'vigente', sku: 'SKU-1', producto: 'Producto', variante: '', marca: 'Poliplast', familia: 'Resinas', subfamilia: '', unidad: 'kg', precio_consumidor_final: 12, precio_mayorista: '', moneda_precio: 'USD', costo: 8, moneda_costo: 'USD', stock: 10, unidad_stock: 'kg', fuente: 'Catálogo' }]

describe('vista previa de importación administrativa', () => {
  it('interpreta ACTIVE en español y valida variant_id contra SKU', () => {
    const preview = previewCatalogActiveReview('active;sku;variant_id\nFALSO;SKU-1;v1\nVERDADERO;SKU-1;otro', catalog)
    expect(preview[0]).toMatchObject({ status: 'cambio', requestedActive: false, currentActive: true })
    expect(preview[1].status).toBe('error')
  })
  it('lee CSV de Excel argentino con punto decimal o coma decimal', () => {
    expect(parseAdminCsv('sku;costo;fuente\nSKU-1;8,50;Lista')).toEqual([{ sku: 'SKU-1', costo: '8,50', fuente: 'Lista' }])
    expect(previewAdminImport('sku;costo;fuente\nSKU-1;8,50;Lista', catalog)[0].changes).toContain('costo: 8 → 8.5')
  })
  it('bloquea SKU desconocido, repetido y cambios sin fuente', () => {
    const preview = previewAdminImport('sku,costo,fuente\nSKU-1,9,\nSKU-1,10,Lista\nOTRO,2,Lista', catalog)
    expect(preview[0].errors).toContain('Todo cambio exige fuente')
    expect(preview[1].errors).toContain('SKU repetido en el archivo')
    expect(preview[2].errors).toContain('SKU desconocido')
  })
  it('no convierte celdas vacías en cero ni cambio', () => expect(previewAdminImport('sku,costo,fuente\nSKU-1,,', catalog)[0].status).toBe('sin_cambios'))
  it('arma únicamente revisiones de costo completas y conserva el cero', () => {
    const preview = previewAdminImport('sku;costo;moneda_costo;fuente\nSKU-1;0;USD;Lista septiembre', catalog)
    expect(buildCostImportRows(preview, '2026-09-12')).toEqual([{ row_number: 2, sku: 'SKU-1', amount: 0, currency: 'USD', source: 'Lista septiembre', valid_from: '2026-09-12' }])
  })
  it('detecta un cambio de moneda aunque el importe no cambie', () => {
    const row = previewAdminImport('sku;moneda_costo;fuente\nSKU-1;ARS;Corrección', catalog)[0]
    expect(row.status).toBe('cambio')
    expect(row.changes).toContain('moneda_costo: USD → ARS')
  })
  it('separa consumidor final y mayorista en lotes diferentes', () => {
    const preview = previewAdminImport('sku;precio_consumidor_final;precio_mayorista;fuente\nSKU-1;14;9,5;Lista septiembre', catalog)
    expect(buildPriceImportRows(preview, 'consumidor_final')).toEqual([{ row_number: 2, sku: 'SKU-1', amount: 14, source: 'Lista septiembre' }])
    expect(buildPriceImportRows(preview, 'mayorista')).toEqual([{ row_number: 2, sku: 'SKU-1', amount: 9.5, source: 'Lista septiembre' }])
  })
})
