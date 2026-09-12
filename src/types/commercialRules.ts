export type RuleScopeType = 'family' | 'sku'
export type QuantityComparator = 'gt' | 'gte'
export type RuleStatus = 'pendiente' | 'confirmado' | 'vencido' | 'excepcion_manual'

export interface CommercialRule {
  id: string
  scope_type: RuleScopeType
  family: string | null
  variant_id: string | null
  quantity_comparator: QuantityComparator
  min_quantity: number
  net_amount: number
  vat_rate: number
  gross_amount: number
  currency: 'ARS' | 'USD'
  unit: string
  valid_from: string
  valid_until: string | null
  source: string
  status: RuleStatus
  override_reason: string
  responsible_user_id: string | null
  responsible_email: string
  supersedes_rule_id: string | null
  notes: string
}

export interface RuleResolutionInput {
  variantId: string
  family: string
  quantity: number
  /** ISO date (YYYY-MM-DD). Por defecto, hoy. */
  today?: string
}

export interface RuleResolutionResult {
  rule: CommercialRule
  explanation: string
}
