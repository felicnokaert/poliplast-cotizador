import { describe, expect, it } from 'vitest'
import { csvEscape, parseAdminCsv, previewAdminImport, rowsToCsv, type AdminCatalogRow } from './admin'

describe('CSV administrativo', () => {
  it('escapa comas y comillas', () => expect(csvEscape('Resina, "A"')).toBe('"Resina, ""A"""'))
  it('exporta encabezados y filas', () => expect(rowsToCsv([{ sku: 'A1', costo: 10 }])).toBe('sku,costo\nA1,10'))
  it('tolera lotes vacíos', () => expect(rowsToCsv([])).toBe(''))
})

const catalog: AdminCatalogRow[] = [{ sku: 'SKU-1', producto: 'Producto', variante: '', marca: 'Poliplast', familia: 'Resinas', subfamilia: '', unidad: 'kg', precio_consumidor_final: 12, precio_mayorista: '', moneda_precio: 'USD', costo: 8, moneda_costo: 'USD', stock: 10, unidad_stock: 'kg', fuente: 'Catálogo' }]

describe('vista previa de importación administrativa', () => {
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
})
