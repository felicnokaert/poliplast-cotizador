import { describe, expect, it } from 'vitest'
import { loadTemplates, resolveTemplate, saveTemplates, templateFromLines, TEMPLATES_KEY } from './templates'
import type { QuoteLine } from './quote'
import type { ProductWithVariants } from '../types/catalog'

const line = (productId: string, variantId: string, quantity: number) => ({ id: variantId, productId, productName: `P-${productId}`, brand: 'X', family: 'F', quantity, variant: { id: variantId, sku: `SKU-${variantId}` } }) as unknown as QuoteLine
const product = (id: string, ...variantIds: string[]) => ({ id, variants: variantIds.map((vid) => ({ id: vid })) }) as unknown as ProductWithVariants

describe('plantillas de cotización', () => {
  it('guarda producto, presentación y cantidad, sin precios', () => {
    const template = templateFromLines('  Kit balde  ', [line('p1', 'v1', 3), line('p2', 'v2', 1)], 't1', '2026-10-22T10:00:00Z')
    expect(template).toMatchObject({ id: 't1', name: 'Kit balde' })
    expect(template.items).toEqual([{ productId: 'p1', variantId: 'v1', name: 'P-p1', sku: 'SKU-v1', quantity: 3 }, { productId: 'p2', variantId: 'v2', name: 'P-p2', sku: 'SKU-v2', quantity: 1 }])
    expect(JSON.stringify(template)).not.toMatch(/price|amount/)
  })
  it('se guarda y se lee del almacenamiento; lo roto se ignora', () => {
    const store: Record<string, string> = {}
    const storage = { getItem: (key: string) => store[key] ?? null, setItem: (key: string, value: string) => { store[key] = value } }
    const template = templateFromLines('A', [line('p1', 'v1', 1)], 't1')
    saveTemplates([template], storage)
    expect(loadTemplates(storage)).toEqual([template])
    store[TEMPLATES_KEY] = '{no es json'
    expect(loadTemplates(storage)).toEqual([])
    store[TEMPLATES_KEY] = JSON.stringify([{ id: 'x', name: '', items: [] }, template])
    expect(loadTemplates(storage)).toEqual([template])
  })
  it('al usarla toma el catálogo de hoy y cuenta aparte lo que ya no existe', () => {
    const template = templateFromLines('A', [line('p1', 'v1', 3), line('p2', 'v9', 1), line('p3', 'v3', 2)], 't1')
    const { items, missing } = resolveTemplate(template, [product('p1', 'v1'), product('p2', 'v2')])
    expect(items.map((item) => [item.product.id, item.variant.id, item.quantity])).toEqual([['p1', 'v1', 3]])
    expect(missing.map((item) => item.variantId)).toEqual(['v9', 'v3'])
  })
})
