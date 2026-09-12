import type { CommercialRule, RuleResolutionInput, RuleResolutionResult } from '../types/commercialRules'

function isoToday(): string {
  return new Date().toISOString().slice(0, 10)
}

function meetsThreshold(rule: CommercialRule, quantity: number): boolean {
  return rule.quantity_comparator === 'gt' ? quantity > rule.min_quantity : quantity >= rule.min_quantity
}

function isCurrentlyValid(rule: CommercialRule, today: string): boolean {
  if (rule.status !== 'confirmado') return false
  if (rule.valid_from > today) return false
  if (rule.valid_until && rule.valid_until < today) return false
  return true
}

function isComplete(rule: CommercialRule): boolean {
  return (
    Number.isFinite(rule.min_quantity) &&
    Number.isFinite(rule.net_amount) &&
    Number.isFinite(rule.vat_rate) &&
    Number.isFinite(rule.gross_amount) &&
    !!rule.currency &&
    (rule.scope_type === 'family' ? !!rule.family : !!rule.variant_id)
  )
}

/**
 * Resuelve la regla comercial aplicable a una línea de cotización.
 *
 * Reglas ignoradas: vencidas (status <> 'confirmado', o fuera de vigencia),
 * incompletas (faltan campos requeridos por su scope), o reemplazadas por
 * otra regla vigente vía `supersedes_rule_id`.
 *
 * Precedencia: SKU puntual > familia > (ninguna, cae a variant_prices).
 * Ante empate dentro del mismo scope, gana el umbral de cantidad más alto
 * que la cantidad pedida todavía cumple; ante empate de umbral, la más
 * reciente por `valid_from`.
 */
export function resolveCommercialRule(
  allRules: CommercialRule[],
  input: RuleResolutionInput,
): RuleResolutionResult | null {
  const today = input.today ?? isoToday()

  const supersededIds = new Set(
    allRules
      .filter((r) => r.supersedes_rule_id && isCurrentlyValid(r, today) && isComplete(r))
      .map((r) => r.supersedes_rule_id as string),
  )

  const candidates = allRules.filter((rule) => {
    if (supersededIds.has(rule.id)) return false
    if (!isCurrentlyValid(rule, today)) return false
    if (!isComplete(rule)) return false
    if (!meetsThreshold(rule, input.quantity)) return false

    if (rule.scope_type === 'sku') return rule.variant_id === input.variantId
    return rule.family === input.family
  })

  if (candidates.length === 0) return null

  candidates.sort((a, b) => {
    const scopeRank = (r: CommercialRule) => (r.scope_type === 'sku' ? 0 : 1)
    if (scopeRank(a) !== scopeRank(b)) return scopeRank(a) - scopeRank(b)
    if (a.min_quantity !== b.min_quantity) return b.min_quantity - a.min_quantity
    return b.valid_from.localeCompare(a.valid_from)
  })

  const rule = candidates[0]
  const scopeLabel = rule.scope_type === 'sku' ? 'este SKU' : `la familia ${rule.family}`
  const comparatorLabel = rule.quantity_comparator === 'gt' ? 'mayor a' : 'igual o mayor a'

  const explanation =
    `Regla comercial aplicada a ${scopeLabel}: cantidad ${comparatorLabel} ${rule.min_quantity} ` +
    `→ ${rule.currency} ${rule.net_amount.toFixed(4)} neto + IVA ${(rule.vat_rate * 100).toFixed(0)}% ` +
    `= ${rule.currency} ${rule.gross_amount.toFixed(4)} final por ${rule.unit}. Fuente: ${rule.source}.`

  return { rule, explanation }
}
