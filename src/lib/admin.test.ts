import { describe, expect, it, vi } from 'vitest'
import { makeQueryResult } from './supabaseTestUtils'

vi.mock('./supabase', () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), storage: { from: vi.fn() } } }))

import { supabase } from './supabase'
import { buildCostImportRows, buildPriceImportRows, createCatalogProduct, createCatalogVariant, csvEscape, InactiveSkuConflictError, parseAdminCsv, previewAdminImport, previewCatalogActiveReview, reactivateCatalogVariant, releaseInactiveVariantSku, rowsToCsv, setCatalogVariantCost, setCatalogVariantPrice, updateCatalogProductName, type AdminCatalogRow } from './admin'

describe('CSV administrativo', () => {
  it('escapa comas y comillas', () => expect(csvEscape('Resina, "A"')).toBe('"Resina, ""A"""'))
  it('exporta encabezados y filas', () => expect(rowsToCsv([{ sku: 'A1', costo: 10 }])).toBe('sku,costo\nA1,10'))
  it('tolera lotes vacíos', () => expect(rowsToCsv([])).toBe(''))
})

const catalog: AdminCatalogRow[] = [{ product_id: 'p1', variant_id: 'v1', active: true, product_status: 'vigente', sku: 'SKU-1', producto: 'Producto', variante: '', marca: 'Poliplast', familia: 'Resinas', subfamilia: '', unidad: 'kg', precio_consumidor_final: 12, precio_mayorista: '', moneda_precio: 'USD', costo: 8, moneda_costo: 'USD', stock: 10, unidad_stock: 'kg', fuente: 'Catálogo', photo_path: null, internal_note: '' }]

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

describe('validaciones de escritura sin tocar la base (no llegan a Supabase)', () => {
  it('rechaza precio negativo o motivo demasiado corto antes de llamar al RPC', async () => {
    await expect(setCatalogVariantPrice('v1', 'consumidor_final', -1, 'USD', 'motivo largo')).rejects.toThrow('precio válido')
    await expect(setCatalogVariantPrice('v1', 'consumidor_final', 10, 'USD', 'hi')).rejects.toThrow('motivo del cambio')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
  it('rechaza costo negativo o motivo corto antes de llamar al RPC', async () => {
    await expect(setCatalogVariantCost('v1', -5, 'USD', 'motivo largo')).rejects.toThrow('costo válido')
    await expect(setCatalogVariantCost('v1', 5, 'USD', 'no')).rejects.toThrow('motivo del cambio')
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
  it('rechaza nombre de producto vacío o corto antes de escribir', async () => {
    await expect(updateCatalogProductName('p1', 'ab')).rejects.toThrow('al menos 3 caracteres')
    expect(supabase.from).not.toHaveBeenCalled()
  })
  it('rechaza variante nueva sin SKU o sin nombre antes de escribir', async () => {
    await expect(createCatalogVariant('p1', { sku: '', name: 'Algo', unit: 'unidad' })).rejects.toThrow('SKU')
    await expect(createCatalogVariant('p1', { sku: 'SKU-X', name: '', unit: 'unidad' })).rejects.toThrow('nombre')
    expect(supabase.from).not.toHaveBeenCalled()
  })
  it('rechaza producto nuevo sin nombre, familia o SKU antes de escribir', async () => {
    await expect(createCatalogProduct({ name: '', brand: '', family: 'F', subfamily: '', sku: 'S', unit: 'unidad' })).rejects.toThrow('nombre del producto')
    await expect(createCatalogProduct({ name: 'Nombre largo', brand: '', family: '', subfamily: '', sku: 'S', unit: 'unidad' })).rejects.toThrow('familia')
    await expect(createCatalogProduct({ name: 'Nombre largo', brand: '', family: 'F', subfamily: '', sku: '', unit: 'unidad' })).rejects.toThrow('SKU')
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

describe('escrituras exitosas contra un Supabase simulado', () => {
  it('renombra el producto', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(makeQueryResult({ data: { id: 'p1' }, error: null }) as never)
    await updateCatalogProductName('p1', 'Nombre nuevo')
    expect(supabase.from).toHaveBeenCalledWith('catalog_products')
  })
  it('crea una variante nueva cuando el SKU no existe todavía', async () => {
    vi.mocked(supabase.from)
      .mockReturnValueOnce(makeQueryResult({ data: [], error: null }) as never)
      .mockReturnValueOnce(makeQueryResult({ data: { id: 'v-nueva' }, error: null }) as never)
    const id = await createCatalogVariant('p1', { sku: 'SKU-NUEVO', name: 'Variante nueva', unit: 'unidad' })
    expect(id).toBe('v-nueva')
  })
  it('no crea la variante si el SKU ya existe activo', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(makeQueryResult({ data: [{ id: 'existente', active: true, name: 'x', product_id: 'p1', catalog_products: { name: 'Producto' } }], error: null }) as never)
    await expect(createCatalogVariant('p1', { sku: 'SKU-1', name: 'x', unit: 'unidad' })).rejects.toThrow('Ya existe')
  })
  it('ofrece reactivar cuando el SKU pertenece a una variante desactivada', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(makeQueryResult({ data: [{ id: 'v-vieja', active: false, name: 'Vieja', product_id: 'p-otro', catalog_products: { name: 'Producto viejo' } }], error: null }) as never)
    const error = await createCatalogVariant('p1', { sku: 'SKU-1', name: 'x', unit: 'unidad' }).catch((e) => e)
    expect(error).toBeInstanceOf(InactiveSkuConflictError)
    expect(error.conflict).toMatchObject({ variantId: 'v-vieja', productId: 'p-otro', productName: 'Producto viejo' })
  })
  it('reactivar aplica los datos nuevos y marca active=true', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(makeQueryResult({ data: null, error: null }) as never)
    await reactivateCatalogVariant('v-vieja', { name: 'Nombre nuevo', unit: 'kg', unitsPerPack: 5 })
    expect(supabase.from).toHaveBeenCalledWith('catalog_variants')
  })
  it('reactivar puede mover la variante a otro producto', async () => {
    const result = makeQueryResult({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(result as never)
    await reactivateCatalogVariant('v-vieja', { name: 'x', unit: 'unidad', productId: 'p-destino' })
    expect(result.update).toHaveBeenCalledWith(expect.objectContaining({ product_id: 'p-destino', active: true }))
  })
  it('libera el SKU de una variante desactivada renombrandolo, sin tocar su historial', async () => {
    const result = makeQueryResult({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(result as never)
    await releaseInactiveVariantSku('v-vieja', 'JUNTA-TORICA-6')
    expect(result.update).toHaveBeenCalledWith(expect.objectContaining({ sku: expect.stringMatching(/^JUNTA-TORICA-6-desactivado-/) }))
  })
})
