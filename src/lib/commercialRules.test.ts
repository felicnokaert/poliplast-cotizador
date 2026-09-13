import { describe, expect, it } from 'vitest'
import { resolveCommercialRule } from './commercialRules'
import type { CommercialRule } from '../types/commercialRules'

function baseRule(overrides: Partial<CommercialRule> = {}): CommercialRule {
  return {
    id: 'r1',
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
    valid_from: '2026-09-12',
    valid_until: null,
    source: 'Confirmado por Felipe Cnokaert, 12/09/2026',
    status: 'confirmado',
    override_reason: '',
    responsible_user_id: null,
    responsible_email: 'felipe@grupopoliplast.com.ar',
    supersedes_rule_id: null,
    notes: '',
  aggregate_by_family: false,
  aggregate_by_pack_group: false,
  pack_group: null,
    ...overrides,
  }
}

const TODAY = '2026-09-15'

describe('resolveCommercialRule — caso Almohadas (cantidad > 200)', () => {
  const rules = [baseRule()]

  it('con 200 unidades exactas NO aplica (el umbral es estrictamente mayor)', () => {
    const result = resolveCommercialRule(rules, {
      variantId: 'v-almohada-1',
      family: 'Almohadas',
      quantity: 200,
      today: TODAY,
    })
    expect(result).toBeNull()
  })

  it('con 201 unidades SÍ aplica y devuelve neto/IVA/final correctos', () => {
    const result = resolveCommercialRule(rules, {
      variantId: 'v-almohada-1',
      family: 'Almohadas',
      quantity: 201,
      today: TODAY,
    })
    expect(result).not.toBeNull()
    expect(result?.rule.net_amount).toBe(5.15)
    expect(result?.rule.vat_rate).toBe(0.21)
    expect(result?.rule.gross_amount).toBeCloseTo(6.2315, 4)
    expect(result?.explanation).toContain('Almohadas')
    expect(result?.explanation).toContain('6.2315')
  })

  it('con 199 unidades no aplica', () => {
    const result = resolveCommercialRule(rules, {
      variantId: 'v-almohada-1',
      family: 'Almohadas',
      quantity: 199,
      today: TODAY,
    })
    expect(result).toBeNull()
  })

  it('no aplica a otra familia aunque supere la cantidad', () => {
    const result = resolveCommercialRule(rules, {
      variantId: 'v-otro-1',
      family: 'Baldes',
      quantity: 500,
      today: TODAY,
    })
    expect(result).toBeNull()
  })
})

describe('resolveCommercialRule — comparador gte', () => {
  const rules = [baseRule({ id: 'r-gte', quantity_comparator: 'gte', min_quantity: 100 })]

  it('con exactamente el umbral SÍ aplica cuando el comparador es gte', () => {
    const result = resolveCommercialRule(rules, { variantId: 'v1', family: 'Almohadas', quantity: 100, today: TODAY })
    expect(result).not.toBeNull()
  })

  it('un unidad por debajo del umbral no aplica', () => {
    const result = resolveCommercialRule(rules, { variantId: 'v1', family: 'Almohadas', quantity: 99, today: TODAY })
    expect(result).toBeNull()
  })
})

describe('resolveCommercialRule — precedencia y filtros', () => {
  it('una regla por SKU puntual gana sobre una de familia', () => {
    const familyRule = baseRule({ id: 'family-rule', min_quantity: 200 })
    const skuRule = baseRule({
      id: 'sku-rule',
      scope_type: 'sku',
      family: null,
      variant_id: 'v-especial',
      min_quantity: 200,
      net_amount: 4.9,
      gross_amount: 5.929,
    })
    const result = resolveCommercialRule([familyRule, skuRule], {
      variantId: 'v-especial',
      family: 'Almohadas',
      quantity: 300,
      today: TODAY,
    })
    expect(result?.rule.id).toBe('sku-rule')
  })

  it('ante empate de scope, gana el umbral más alto que la cantidad todavía cumple', () => {
    const low = baseRule({ id: 'low', min_quantity: 100 })
    const high = baseRule({ id: 'high', min_quantity: 200 })
    const result = resolveCommercialRule([low, high], {
      variantId: 'v1',
      family: 'Almohadas',
      quantity: 250,
      today: TODAY,
    })
    expect(result?.rule.id).toBe('high')
  })

  it('ignora reglas vencidas por status', () => {
    const rules = [baseRule({ status: 'vencido' })]
    const result = resolveCommercialRule(rules, { variantId: 'v1', family: 'Almohadas', quantity: 500, today: TODAY })
    expect(result).toBeNull()
  })

  it('ignora reglas fuera de vigencia por fecha (valid_until pasado)', () => {
    const rules = [baseRule({ valid_until: '2026-01-01' })]
    const result = resolveCommercialRule(rules, { variantId: 'v1', family: 'Almohadas', quantity: 500, today: TODAY })
    expect(result).toBeNull()
  })

  it('ignora reglas que todavía no empiezan (valid_from futuro)', () => {
    const rules = [baseRule({ valid_from: '2099-01-01' })]
    const result = resolveCommercialRule(rules, { variantId: 'v1', family: 'Almohadas', quantity: 500, today: TODAY })
    expect(result).toBeNull()
  })

  it('ignora reglas incompletas (familia sin family, o SKU sin variant_id)', () => {
    const rules = [baseRule({ family: null }), baseRule({ id: 'sku-incompleto', scope_type: 'sku', family: null, variant_id: null })]
    const result = resolveCommercialRule(rules, { variantId: 'v1', family: 'Almohadas', quantity: 500, today: TODAY })
    expect(result).toBeNull()
  })

  it('ignora una regla reemplazada por otra vigente vía supersedes_rule_id', () => {
    const original = baseRule({ id: 'original', net_amount: 5.15, gross_amount: 6.2315 })
    const replacement = baseRule({
      id: 'replacement',
      supersedes_rule_id: 'original',
      net_amount: 5.5,
      gross_amount: 6.655,
    })
    const result = resolveCommercialRule([original, replacement], {
      variantId: 'v1',
      family: 'Almohadas',
      quantity: 500,
      today: TODAY,
    })
    expect(result?.rule.id).toBe('replacement')
  })

  it('si la regla reemplazante todavía no es válida, la original sigue vigente', () => {
    const original = baseRule({ id: 'original' })
    const replacement = baseRule({ id: 'replacement', supersedes_rule_id: 'original', status: 'pendiente' })
    const result = resolveCommercialRule([original, replacement], {
      variantId: 'v1',
      family: 'Almohadas',
      quantity: 500,
      today: TODAY,
    })
    expect(result?.rule.id).toBe('original')
  })
})
