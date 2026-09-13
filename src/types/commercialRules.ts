export type RuleScopeType = 'family' | 'sku'
export type QuantityComparator = 'gt' | 'gte'
export type RuleStatus = 'pendiente' | 'confirmado' | 'vencido' | 'excepcion_manual'

export interface CommercialRule {
  id: string
  scope_type: RuleScopeType
  family: string | null
  variant_id: string | null
  /** Solo con scope_type='sku' y aggregate_by_pack_group=true: reemplaza a variant_id como criterio de matching. */
  pack_group: string | null
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
  /** Solo válido con scope_type='sku': el umbral se evalúa sobre toda la familia (ej. Baldes). */
  aggregate_by_family: boolean
  /** Solo válido con scope_type='sku': el umbral se evalúa sobre las presentaciones hermanas del mismo producto (ej. Penosil x1/x3/x6/x12). */
  aggregate_by_pack_group: boolean
}

export interface RuleResolutionInput {
  variantId: string
  family: string
  /** Presente cuando la línea tiene un `pack_group` persistido; habilita el matching de reglas por pack_group. */
  packGroup?: string | null
  quantity: number
  /** ISO date (YYYY-MM-DD). Por defecto, hoy. */
  today?: string
}

export interface RuleResolutionResult {
  rule: CommercialRule
  explanation: string
}
