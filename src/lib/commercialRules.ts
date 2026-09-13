import { supabase } from './supabase'
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
  const scopeOk =
    rule.scope_type === 'family'
      ? !!rule.family
      : rule.aggregate_by_pack_group
        ? !!rule.pack_group
        : !!rule.variant_id
  return (
    Number.isFinite(rule.min_quantity) &&
    Number.isFinite(rule.net_amount) &&
    Number.isFinite(rule.vat_rate) &&
    Number.isFinite(rule.gross_amount) &&
    !!rule.currency &&
    scopeOk
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

    if (rule.scope_type === 'sku') {
      if (rule.aggregate_by_pack_group) return !!input.packGroup && rule.pack_group === input.packGroup
      return rule.variant_id === input.variantId
    }
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

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value)
}

/** Postgres devuelve los `numeric` como string vía PostgREST; los normalizamos a number. */
function mapRuleRow(row: Record<string, unknown>): CommercialRule {
  return {
    id: row.id as string,
    scope_type: row.scope_type as CommercialRule['scope_type'],
    family: (row.family as string | null) ?? null,
    variant_id: (row.variant_id as string | null) ?? null,
    pack_group: (row.pack_group as string | null) ?? null,
    quantity_comparator: row.quantity_comparator as CommercialRule['quantity_comparator'],
    min_quantity: toNumber(row.min_quantity),
    net_amount: toNumber(row.net_amount),
    vat_rate: toNumber(row.vat_rate),
    gross_amount: toNumber(row.gross_amount),
    currency: row.currency as CommercialRule['currency'],
    unit: row.unit as string,
    valid_from: row.valid_from as string,
    valid_until: (row.valid_until as string | null) ?? null,
    source: row.source as string,
    status: row.status as CommercialRule['status'],
    override_reason: (row.override_reason as string) ?? '',
    responsible_user_id: (row.responsible_user_id as string | null) ?? null,
    responsible_email: (row.responsible_email as string) ?? '',
    supersedes_rule_id: (row.supersedes_rule_id as string | null) ?? null,
    notes: (row.notes as string) ?? '',
    aggregate_by_family: Boolean(row.aggregate_by_family),
    aggregate_by_pack_group: Boolean(row.aggregate_by_pack_group),
  }
}

/** Carga las reglas comerciales vigentes. Pensada para llamarse una sola vez por sesión. */
export async function loadCommercialRules(): Promise<CommercialRule[]> {
  const { data, error } = await supabase.from('commercial_rules').select('*')
  if (error) throw error
  return (data ?? []).map(mapRuleRow)
}

export type NewCommercialRule = Pick<CommercialRule, 'scope_type' | 'family' | 'variant_id' | 'pack_group' | 'quantity_comparator' | 'min_quantity' | 'net_amount' | 'vat_rate' | 'currency' | 'unit' | 'valid_from' | 'valid_until' | 'source' | 'notes' | 'aggregate_by_family' | 'aggregate_by_pack_group'>

/** Inserta una nueva versión; las reglas existentes nunca se pisan. */
export async function createCommercialRule(rule: NewCommercialRule, responsibleEmail: string): Promise<void> {
  const { error } = await supabase.from('commercial_rules').insert({
    ...rule, gross_amount: rule.net_amount * (1 + rule.vat_rate), status: 'confirmado', override_reason: '',
    responsible_email: responsibleEmail, created_by_email: responsibleEmail,
  })
  if (error) throw error
}

function formatQuantityCondition(rule: CommercialRule): string {
  const qty = Number.isInteger(rule.min_quantity) ? String(rule.min_quantity) : String(rule.min_quantity)
  return rule.quantity_comparator === 'gt' ? `más de ${qty} unidades` : `desde ${qty} unidades`
}

const AMOUNT_FORMAT = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 4, maximumFractionDigits: 4 })

/**
 * Etiqueta corta para mostrar debajo del precio en pantalla, PDF y WhatsApp.
 * Ej: "Mayorista Almohadas · más de 200 unidades · USD 6,2315 final con IVA incluido".
 */
export function formatRuleLabel(rule: CommercialRule): string {
  const scopeLabel =
    rule.scope_type === 'family'
      ? `Mayorista ${rule.family}`
      : rule.aggregate_by_pack_group
        ? `Mayorista por caja (${rule.pack_group})`
        : rule.aggregate_by_family
          ? `Mayorista ${rule.family} por tramo`
          : 'Precio especial por SKU'
  return `${scopeLabel} · ${formatQuantityCondition(rule)} · ${rule.currency} ${AMOUNT_FORMAT.format(rule.gross_amount)} final con IVA incluido`
}
