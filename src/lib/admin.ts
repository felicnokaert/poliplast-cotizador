import { supabase } from './supabase'

export interface AdminOverview {
  isAdmin: boolean
  costs: Array<{ variant_id: string; amount: number; currency: string; valid_from: string; valid_until: string | null; source: string; status: string }>
  inventory: Array<{ variant_id: string; approved_quantity: number; unit: string; approved_at: string }>
  imports: Array<{ id: string; import_type: string; file_name: string; status: string; created_at: string }>
}

export async function loadAdminOverview(): Promise<AdminOverview> {
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_poliplast_crm_admin')
  if (roleError || !isAdmin) return { isAdmin: false, costs: [], inventory: [], imports: [] }

  const [costs, inventory, imports] = await Promise.all([
    supabase.from('catalog_cost_revisions').select('variant_id, amount, currency, valid_from, valid_until, source, status').order('valid_from', { ascending: false }),
    supabase.from('inventory_balances').select('variant_id, approved_quantity, unit, approved_at'),
    supabase.from('catalog_import_jobs').select('id, import_type, file_name, status, created_at').order('created_at', { ascending: false }).limit(20),
  ])
  if (costs.error) throw costs.error
  if (inventory.error) throw inventory.error
  if (imports.error) throw imports.error
  return { isAdmin: true, costs: costs.data ?? [], inventory: inventory.data ?? [], imports: imports.data ?? [] }
}

export function csvEscape(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n')
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([`\uFEFF${content}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
