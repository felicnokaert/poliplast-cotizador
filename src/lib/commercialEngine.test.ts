import { describe, expect, it } from 'vitest'
import { addQuoteLine, quoteTotals, resolvedLinePrice } from './quote'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import type { CommercialRule } from '../types/commercialRules'

function baseRule(overrides: Partial<CommercialRule>): CommercialRule {
  return {
    id: overrides.id ?? 'r1',
    scope_type: 'sku',
    family: null,
    variant_id: null,
    pack_group: null,
    quantity_comparator: 'gte',
    min_quantity: 12,
    net_amount: 0,
    vat_rate: 0.21,
    gross_amount: 0,
    currency: 'USD',
    unit: 'unidad',
    valid_from: '2026-01-01',
    valid_until: null,
    source: 'test',
    status: 'confirmado',
    override_reason: '',
    responsible_user_id: null,
    responsible_email: 'test@test.com',
    supersedes_rule_id: null,
    notes: '',
    aggregate_by_family: false,
    aggregate_by_pack_group: false,
    ...overrides,
  }
}

function makeVariant(overrides: Partial<VariantWithPricing> & { id: string }): VariantWithPricing {
  const base = {
    id: 'v1', product_id: 'p1', sku: 'SKU-1', name: 'Producto', unit: 'unidad',
    attributes: {} as Record<string, unknown>, active: true, hasTechnicalDoc: false,
    prices: [{
      id: `cf-${overrides.id}`, price_list_id: 'pl-cf', variant_id: overrides.id, min_quantity: 1, max_quantity: null,
      amount: 20, status: 'confirmado' as const,
      price_list: { id: 'pl-cf', name: 'Catalogo Maestro', brand: 'Grupo Poliplast', currency: 'USD' as const, vat_rate: 0.21, valid_from: '2026-01-01', valid_until: null, status: 'vigente' as const },
    }],
  }
  return { ...base, ...overrides }
}

function makeProduct(family: string, name: string, overrides: Partial<ProductWithVariants> = {}): ProductWithVariants {
  return {
    id: 'p1', canonical_key: 'p1', name, brand: 'Grupo Poliplast', family, subfamily: '',
    status: 'vigente', source: 'test', source_updated_at: null, variants: [],
    ...overrides,
  }
}

describe('Motor de precios — Penosil (caja de 12, agregado por pack_group)', () => {
  const penosilRule = baseRule({
    id: 'penosil-810ml',
    scope_type: 'sku',
    aggregate_by_pack_group: true,
    pack_group: 'PS-810ML',
    quantity_comparator: 'gte',
    min_quantity: 12,
    net_amount: 11.32,
    gross_amount: 13.6972,
    currency: 'USD',
  })

  const unitVariant = makeVariant({ id: 'v-810-1', sku: 'PS-810ML-1', name: 'PENOSIL EASYSPRAY 810ML', attributes: { units_per_pack: 1, pack_group: 'PS-810ML' } })
  const boxVariant = makeVariant({ id: 'v-810-12', sku: 'PS-810ML-12', name: 'KIT X 12 EASYSPRAY 810ML', attributes: { units_per_pack: 12, pack_group: 'PS-810ML' } })
  const unitProduct = makeProduct('PENOSIL', unitVariant.name, { variants: [unitVariant] })
  const boxProduct = makeProduct('PENOSIL', boxVariant.name, { id: 'p12', variants: [boxVariant] })

  it('con 11 unidades físicas del SKU unitario NO aplica', () => {
    const line = { ...addQuoteLine([], unitVariant, unitProduct)[0], quantity: 11 }
    const price = resolvedLinePrice(line, 'automatico', [penosilRule], [line])
    expect(price?.specialRule).toBe(false)
  })

  it('con 12 unidades físicas del SKU unitario SÍ aplica', () => {
    const line = { ...addQuoteLine([], unitVariant, unitProduct)[0], quantity: 12 }
    const price = resolvedLinePrice(line, 'automatico', [penosilRule], [line])
    expect(price?.specialRule).toBe(true)
    expect(price?.amount).toBeCloseTo(13.6972, 4)
  })

  it('el SKU explícito x12 cumple la condición con cantidad 1 (1 caja = 12 unidades físicas)', () => {
    const line = { ...addQuoteLine([], boxVariant, boxProduct)[0], quantity: 1 }
    const price = resolvedLinePrice(line, 'automatico', [penosilRule], [line])
    expect(price?.specialRule).toBe(true)
    // El precio final de la línea es 12 unidades × el precio unitario mayorista.
    expect(price?.amount).toBeCloseTo(13.6972 * 12, 4)
  })

  it('combina SKU unitario + caja del mismo producto para alcanzar las 12 unidades', () => {
    const unitLine = { ...addQuoteLine([], unitVariant, unitProduct)[0], id: 'l1', quantity: 6 }
    // 6 unitarias (6 físicas) + 1 pack x12 no hace falta; probamos 6 + otro producto x6 en pack propio de 1 unidad c/u
    const otherUnitLine = { ...addQuoteLine([], unitVariant, unitProduct)[0], id: 'l2', quantity: 6 }
    const lines = [unitLine, otherUnitLine]
    // 6 + 6 = 12 físicas del mismo pack_group -> aplica a ambas líneas
    expect(resolvedLinePrice(unitLine, 'automatico', [penosilRule], lines)?.specialRule).toBe(true)
    expect(resolvedLinePrice(otherUnitLine, 'automatico', [penosilRule], lines)?.specialRule).toBe(true)
  })

  it('un producto Penosil distinto (otro pack_group) no suma a este umbral', () => {
    const otherVariant = makeVariant({ id: 'v-other-1', sku: 'PS-ADA10-1', name: 'ADHESIVO ACUOSO A-10', attributes: { units_per_pack: 1, pack_group: 'PS-ADA10' } })
    const otherProduct = makeProduct('PENOSIL', otherVariant.name, { id: 'p-other', variants: [otherVariant] })
    const line = { ...addQuoteLine([], unitVariant, unitProduct)[0], quantity: 6 }
    const otherLine = { ...addQuoteLine([], otherVariant, otherProduct)[0], quantity: 6 }
    const lines = [line, otherLine]
    expect(resolvedLinePrice(line, 'automatico', [penosilRule], lines)?.specialRule).toBe(false)
  })
})

describe('Motor de precios — Baldes (tramos por unidades físicas totales de la familia)', () => {
  const tier1 = baseRule({ id: 'baldes-20-t1', variant_id: 'v-balde-20l', quantity_comparator: 'gte', min_quantity: 1, aggregate_by_family: true, net_amount: 8677.69, gross_amount: 10500, currency: 'ARS' })
  const tier2 = baseRule({ id: 'baldes-20-t2', variant_id: 'v-balde-20l', quantity_comparator: 'gte', min_quantity: 112, aggregate_by_family: true, net_amount: 6198.35, gross_amount: 7500, currency: 'ARS' })
  const tier3 = baseRule({ id: 'baldes-20-t3', variant_id: 'v-balde-20l', quantity_comparator: 'gte', min_quantity: 225, aggregate_by_family: true, net_amount: 5619.83, gross_amount: 6800, currency: 'ARS' })
  const rules = [tier1, tier2, tier3]

  const balde20 = makeVariant({ id: 'v-balde-20l', sku: 'BL-20L-VB', name: 'BALDE 20L VIRGEN BLANCO', attributes: { units_per_pack: 1 } })
  const balde20Product = makeProduct('Baldes', balde20.name, { variants: [balde20] })

  it('con 111 unidades: tramo minorista (tier1)', () => {
    const line = { ...addQuoteLine([], balde20, balde20Product)[0], quantity: 111 }
    const price = resolvedLinePrice(line, 'automatico', rules, [line])
    expect(price?.amount).toBeCloseTo(10500, 2)
  })

  it('con 112 unidades: tramo medio pallet (tier2)', () => {
    const line = { ...addQuoteLine([], balde20, balde20Product)[0], quantity: 112 }
    const price = resolvedLinePrice(line, 'automatico', rules, [line])
    expect(price?.amount).toBeCloseTo(7500, 2)
  })

  it('con 224 unidades: sigue en medio pallet (tier2)', () => {
    const line = { ...addQuoteLine([], balde20, balde20Product)[0], quantity: 224 }
    const price = resolvedLinePrice(line, 'automatico', rules, [line])
    expect(price?.amount).toBeCloseTo(7500, 2)
  })

  it('con 225 unidades: tramo mayorista (tier3)', () => {
    const line = { ...addQuoteLine([], balde20, balde20Product)[0], quantity: 225 }
    const price = resolvedLinePrice(line, 'automatico', rules, [line])
    expect(price?.amount).toBeCloseTo(6800, 2)
  })

  it('combinación de distintos baldes (10 packs x20 + 5 packs x5) suma 225 y activa mayorista para ambos', () => {
    const balde10 = makeVariant({ id: 'v-balde-10l', sku: 'BL-10L-VB', name: 'BALDE 10L VIRGEN BLANCO PACK X 5', attributes: { units_per_pack: 5 } })
    const balde10Product = makeProduct('Baldes', balde10.name, { id: 'p-balde10', variants: [balde10] })
    const balde20Pack = makeVariant({ id: 'v-balde-20l-pack', sku: 'BL-20L-VB-X20', name: 'BALDE 20L VIRGEN BLANCO PACK X 20', attributes: { units_per_pack: 20 } })
    const balde20PackProduct = makeProduct('Baldes', balde20Pack.name, { id: 'p-balde20pack', variants: [balde20Pack] })

    const tier3For20Pack = baseRule({ id: 'baldes-20pack-t3', variant_id: 'v-balde-20l-pack', quantity_comparator: 'gte', min_quantity: 225, aggregate_by_family: true, net_amount: 5619.83, gross_amount: 6800, currency: 'ARS' })
    const tier3For10 = baseRule({ id: 'baldes-10-t3', variant_id: 'v-balde-10l', quantity_comparator: 'gte', min_quantity: 225, aggregate_by_family: true, net_amount: 2975.21, gross_amount: 3600, currency: 'ARS' })

    const line20 = { ...addQuoteLine([], balde20Pack, balde20PackProduct)[0], quantity: 10 } // 10 x20 = 200
    const line10 = { ...addQuoteLine([], balde10, balde10Product)[0], quantity: 5 } // 5 x5 = 25
    const lines = [line20, line10] // total físico = 225

    const allRules = [...rules, tier3For20Pack, tier3For10]
    const price20 = resolvedLinePrice(line20, 'automatico', allRules, lines)
    const price10 = resolvedLinePrice(line10, 'automatico', allRules, lines)
    expect(price20?.specialRule).toBe(true)
    expect(price20?.amount).toBeCloseTo(6800 * 20, 2)
    expect(price10?.specialRule).toBe(true)
    expect(price10?.amount).toBeCloseTo(3600 * 5, 2)
  })

  it('con 224 unidades combinadas, NINGUNO alcanza el tramo mayorista (se queda en medio pallet)', () => {
    const balde10 = makeVariant({ id: 'v-balde-10l-b', sku: 'BL-10L-VB', name: 'BALDE 10L VIRGEN BLANCO PACK X 4', attributes: { units_per_pack: 4 } })
    const balde10Product = makeProduct('Baldes', balde10.name, { id: 'p-balde10b', variants: [balde10] })
    const tier2For10 = baseRule({ id: 'baldes-10-t2', variant_id: 'v-balde-10l-b', quantity_comparator: 'gte', min_quantity: 112, aggregate_by_family: true, net_amount: 3305.79, gross_amount: 4000, currency: 'ARS' })
    const tier3For10 = baseRule({ id: 'baldes-10-t3', variant_id: 'v-balde-10l-b', quantity_comparator: 'gte', min_quantity: 225, aggregate_by_family: true, net_amount: 2975.21, gross_amount: 3600, currency: 'ARS' })

    const line20 = { ...addQuoteLine([], balde20, balde20Product)[0], quantity: 200 } // 200 físicas
    const line10 = { ...addQuoteLine([], balde10, balde10Product)[0], quantity: 6 } // 6 x4 = 24 físicas
    const lines = [line20, line10] // total = 224, no llega a 225

    const allRules = [...rules, tier2For10, tier3For10]
    expect(resolvedLinePrice(line20, 'automatico', allRules, lines)?.amount).toBeCloseTo(7500, 2)
    expect(resolvedLinePrice(line10, 'automatico', allRules, lines)?.amount).toBeCloseTo(4000 * 4, 2)
  })
})

describe('Coincidencia pantalla/PDF/WhatsApp con el motor general', () => {
  it('quoteTotals usa la misma resolución que resolvedLinePrice para Baldes', () => {
    const rule = baseRule({ id: 'baldes-solo', variant_id: 'v-balde', quantity_comparator: 'gte', min_quantity: 225, aggregate_by_family: true, gross_amount: 6800, currency: 'ARS' })
    const variant = makeVariant({ id: 'v-balde', sku: 'BL-20L-VB', name: 'BALDE 20L VIRGEN BLANCO', attributes: { units_per_pack: 1 } })
    const product = makeProduct('Baldes', variant.name, { variants: [variant] })
    const line = { ...addQuoteLine([], variant, product)[0], quantity: 225 }
    const totals = quoteTotals([line], 0, 0, 1, 'ARS', 'automatico', [rule])
    expect(totals.subtotal).toBeCloseTo(6800 * 225, 2)
  })
})
