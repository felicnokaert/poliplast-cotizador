import { describe, expect, it } from 'vitest'
import { addQuoteLine, createQuoteNumber, priceForQuantity, quoteExpiry, quoteTotals, resolvedLinePrice, serializeQuoteForWhatsApp } from './quote'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import type { CommercialRule } from '../types/commercialRules'

const almohadasRule: CommercialRule = {
  id: 'rule-almohadas',
  scope_type: 'family',
  family: 'Almohadas',
  variant_id: null,
  quantity_comparator: 'gt',
  min_quantity: 200,
  net_amount: 5.15,
  vat_rate: 0.21,
  gross_amount: 6.2315,
  currency: 'USD',
  unit: 'unidad',
  valid_from: '2026-01-01',
  valid_until: null,
  source: 'Confirmado por Felipe Cnokaert, 12/09/2026',
  status: 'confirmado',
  override_reason: '',
  responsible_user_id: null,
  responsible_email: 'felipe@grupopoliplast.com.ar',
  supersedes_rule_id: null,
  notes: '',
}

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
  it('genera numeración comercial legible e inequívoca', () => {
    expect(createQuoteNumber(new Date('2026-09-11T12:34:00.125Z'))).toBe('GP-260911-123400-125')
    expect(createQuoteNumber(new Date('2026-09-11T12:34:01.125Z'))).not.toBe(createQuoteNumber(new Date('2026-09-11T12:34:00.125Z')))
  })
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

  it('activa mayorista Resinplast desde USD 1.815 cuando ambas listas existen', () => {
    const resinVariant = {
      ...variant,
      prices: [
        { ...variant.prices[0], id: 'cf', amount: 10, price_list: { ...variant.prices[0].price_list, id: 'cf-list', name: 'Resinplast CF' } },
        { ...variant.prices[0], id: 'may', amount: 7.8, price_list: { ...variant.prices[0].price_list, id: 'may-list', name: 'Resinplast Mayorista' } },
      ],
    } satisfies VariantWithPricing
    const resinProduct = { ...product, brand: 'Resinplast', family: 'Resinas y Catalizadores', variants: [resinVariant] }
    const baseLine = addQuoteLine([], resinVariant, resinProduct)[0]
    expect(quoteTotals([{ ...baseLine, quantity: 181 }]).appliedPriceMode).toBe('consumidor_final')
    expect(quoteTotals([{ ...baseLine, quantity: 182 }]).appliedPriceMode).toBe('mayorista')
    expect(quoteTotals([{ ...baseLine, quantity: 182 }]).subtotal).toBeCloseTo(1419.6, 4)
  })

  it('no activa mayorista Resinplast si falta una lista mayorista verificada', () => {
    const resinProduct = { ...product, brand: 'Resinplast', family: 'Resinas y Catalizadores' }
    const line = { ...addQuoteLine([], variant, resinProduct)[0], quantity: 1000 }
    expect(quoteTotals([line]).appliedPriceMode).toBe('consumidor_final')
  })

  it('informa el IVA incluido sin sumarlo por segunda vez', () => {
    const lines = addQuoteLine([], variant, product).map((line) => ({ ...line, quantity: 10 }))
    const totals = quoteTotals(lines, 10, 5, 1000, 'ARS')
    expect(totals.subtotal).toBe(800)
    expect(totals.discount).toBe(80)
    expect(totals.surcharge).toBe(36)
    expect(totals.vat).toBeCloseTo(138.8429, 3)
    expect(totals.convertedTotal).toBe(756000)
  })

  it('sin reglas comerciales cargadas, usa el precio de lista normal (nunca inventa una condición)', () => {
    const pillowProduct = { ...product, name: 'Almohada clásica', family: 'Almohadas' }
    const line = { ...addQuoteLine([], variant, pillowProduct)[0], quantity: 201 }
    expect(resolvedLinePrice(line, 'automatico', [])?.amount).toBe(80)
  })

  it('con 200 unidades exactas, la regla de Almohadas NO aplica (umbral estrictamente mayor)', () => {
    const pillowProduct = { ...product, name: 'Almohada clásica', family: 'Almohadas' }
    const line = { ...addQuoteLine([], variant, pillowProduct)[0], quantity: 200 }
    const price = resolvedLinePrice(line, 'automatico', [almohadasRule])
    expect(price?.specialRule).toBe(false)
    expect(price?.amount).toBe(80)
  })

  it('con 201 unidades, aplica la regla de Almohadas: USD 6,2315 final con IVA incluido', () => {
    const pillowProduct = { ...product, name: 'Almohada clásica', family: 'Almohadas' }
    const line = { ...addQuoteLine([], variant, pillowProduct)[0], quantity: 201 }
    const price = resolvedLinePrice(line, 'automatico', [almohadasRule])
    expect(price?.specialRule).toBe(true)
    expect(price?.amount).toBeCloseTo(6.2315, 4)
    expect(price?.listName).toBe('Mayorista Almohadas · más de 200 unidades · USD 6,2315 final con IVA incluido')
  })

  it('cuenta unidades físicas de packs de almohadas para el umbral y el precio', () => {
    const packProduct = { ...product, name: 'ALMOHADA VISCOELASTICA RECTA X 2', family: 'Almohadas' }
    const line = { ...addQuoteLine([], variant, packProduct)[0], quantity: 101 }
    const price = resolvedLinePrice(line, 'automatico', [almohadasRule], [line])
    expect(price?.specialRule).toBe(true)
    expect(price?.amount).toBeCloseTo(6.2315 * 2, 4)
    expect(quoteTotals([line], 0, 0, 1, 'USD', 'automatico', [almohadasRule]).subtotal).toBeCloseTo(6.2315 * 202, 3)
  })

  it('suma packs distintos de la misma familia antes de aplicar el umbral', () => {
    const pack2 = { ...addQuoteLine([], variant, { ...product, id: 'p2', name: 'ALMOHADA X 2', family: 'Almohadas' })[0], id: 'l2', quantity: 50 }
    const pack4Variant = { ...variant, id: 'v4', sku: 'ALM-4' }
    const pack4 = { ...addQuoteLine([], pack4Variant, { ...product, id: 'p4', name: 'ALMOHADA X 4', family: 'Almohadas' })[0], quantity: 26 }
    const lines = [pack2, pack4]
    expect(resolvedLinePrice(pack2, 'automatico', [almohadasRule], lines)?.specialRule).toBe(true)
    expect(resolvedLinePrice(pack4, 'automatico', [almohadasRule], lines)?.amount).toBeCloseTo(6.2315 * 4, 4)
  })

  it('el total de la cotización refleja la regla aplicada (201 almohadas)', () => {
    const pillowProduct = { ...product, name: 'Almohada clásica', family: 'Almohadas' }
    const lines = [{ ...addQuoteLine([], variant, pillowProduct)[0], quantity: 201 }]
    const totals = quoteTotals(lines, 0, 0, 1, 'USD', 'automatico', [almohadasRule])
    expect(totals.subtotal).toBeCloseTo(6.2315 * 201, 3)
    expect(totals.pendingLines).toBe(0)
  })

  it('el total con 200 unidades NO refleja la regla (sigue en precio de lista)', () => {
    const pillowProduct = { ...product, name: 'Almohada clásica', family: 'Almohadas' }
    const lines = [{ ...addQuoteLine([], variant, pillowProduct)[0], quantity: 200 }]
    const totals = quoteTotals(lines, 0, 0, 1, 'USD', 'automatico', [almohadasRule])
    expect(totals.subtotal).toBe(80 * 200)
  })

  it('el texto de WhatsApp usa exactamente el mismo precio resuelto que la pantalla (regla aplicada)', () => {
    const pillowProduct = { ...product, name: 'Almohada clásica', family: 'Almohadas' }
    const lines = [{ ...addQuoteLine([], variant, pillowProduct)[0], quantity: 201 }]
    const text = serializeQuoteForWhatsApp(
      { meta: { number: 'GP-2', client: '', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status: 'borrador', createdAt: '2026-09-12T00:00:00Z' }, lines, updatedAt: '2026-09-12T00:00:00Z' },
      [almohadasRule],
    )
    const expectedAmount = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(6.2315 * 201)
    expect(text).toContain(expectedAmount)
    expect(text).toContain('Mayorista Almohadas')
  })

  it('el texto de WhatsApp sin reglas cargadas usa el precio normal (no inventa la condición)', () => {
    const pillowProduct = { ...product, name: 'Almohada clásica', family: 'Almohadas' }
    const lines = [{ ...addQuoteLine([], variant, pillowProduct)[0], quantity: 201 }]
    const text = serializeQuoteForWhatsApp(
      { meta: { number: 'GP-3', client: '', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status: 'borrador', createdAt: '2026-09-12T00:00:00Z' }, lines, updatedAt: '2026-09-12T00:00:00Z' },
      [],
    )
    expect(text).not.toContain('Mayorista Almohadas')
  })

  it('calcula vigencia', () => expect(quoteExpiry('2026-09-11T00:00:00Z', 10).toISOString().slice(0, 10)).toBe('2026-09-21'))

  it('genera texto compartible y trazable', () => {
    const lines = addQuoteLine([], variant, product)
    const text = serializeQuoteForWhatsApp({ meta: { number: 'GP-1', client: 'Cliente', contact: '', phone: '', email: '', notes: '', paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0, exchangeRate: 1, outputCurrency: 'USD', status: 'borrador', createdAt: '2026-09-11T00:00:00Z' }, lines, updatedAt: '2026-09-11T00:00:00Z' })
    expect(text).toContain('GP-1')
    expect(text).toContain('SKU-1')
  })
})
