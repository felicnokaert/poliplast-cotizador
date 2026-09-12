import { supabase } from './supabase'

export interface AdminOverview {
  isAdmin: boolean
  costs: Array<{ variant_id: string; amount: number; currency: string; valid_from: string; valid_until: string | null; source: string; status: string }>
  inventory: Array<{ variant_id: string; approved_quantity: number; unit: string; approved_at: string }>
  imports: Array<{ id: string; import_type: string; file_name: string; status: string; created_at: string }>
  catalog: AdminCatalogRow[]
}

export interface AdminCatalogRow {
  sku: string; producto: string; variante: string; marca: string; familia: string; subfamilia: string; unidad: string
  precio_consumidor_final: number | ''; precio_mayorista: number | ''; moneda_precio: string
  costo: number | ''; moneda_costo: string; stock: number | ''; unidad_stock: string; fuente: string
}

async function fetchAll<T>(query: (from: number, to: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const result: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await query(from, from + 999)
    if (error) throw error
    const page = (data ?? []) as T[]
    result.push(...page)
    if (page.length < 1000) return result
  }
}

export async function loadAdminOverview(): Promise<AdminOverview> {
  const { data: isAdmin, error: roleError } = await supabase.rpc('is_poliplast_crm_admin')
  if (roleError || !isAdmin) return { isAdmin: false, costs: [], inventory: [], imports: [], catalog: [] }

  const [costs, inventory, imports, products, variants, prices, priceLists] = await Promise.all([
    fetchAll<AdminOverview['costs'][number]>((from, to) => supabase.from('catalog_cost_revisions').select('variant_id, amount, currency, valid_from, valid_until, source, status').order('valid_from', { ascending: false }).range(from, to)),
    fetchAll<AdminOverview['inventory'][number]>((from, to) => supabase.from('inventory_balances').select('variant_id, approved_quantity, unit, approved_at').range(from, to)),
    supabase.from('catalog_import_jobs').select('id, import_type, file_name, status, created_at').order('created_at', { ascending: false }).limit(20),
    fetchAll<Record<string, unknown>>((from, to) => supabase.from('catalog_products').select('id,name,brand,family,subfamily,status').range(from, to)),
    fetchAll<Record<string, unknown>>((from, to) => supabase.from('catalog_variants').select('id,product_id,sku,name,unit,active').range(from, to)),
    fetchAll<Record<string, unknown>>((from, to) => supabase.from('variant_prices').select('variant_id,price_list_id,amount,status,min_quantity').range(from, to)),
    fetchAll<Record<string, unknown>>((from, to) => supabase.from('price_lists').select('id,name,currency,status').range(from, to)),
  ])
  if (imports.error) throw imports.error
  const productById = new Map(products.map((item) => [String(item.id), item]))
  const listById = new Map(priceLists.map((item) => [String(item.id), item]))
  const pricesByVariant = new Map<string, Record<string, unknown>[]>()
  for (const price of prices) pricesByVariant.set(String(price.variant_id), [...(pricesByVariant.get(String(price.variant_id)) ?? []), price])
  const latestCost = new Map<string, AdminOverview['costs'][number]>()
  for (const cost of costs) if (!latestCost.has(cost.variant_id) && cost.status === 'confirmado') latestCost.set(cost.variant_id, cost)
  const stockByVariant = new Map(inventory.map((item) => [item.variant_id, item]))
  const catalog = variants.flatMap((variant): AdminCatalogRow[] => {
    const product = productById.get(String(variant.product_id)); if (!product || product.status !== 'vigente' || variant.active === false) return []
    const available = (pricesByVariant.get(String(variant.id)) ?? []).filter((price) => price.status === 'confirmado' && listById.get(String(price.price_list_id))?.status === 'vigente')
    const withList: Array<Record<string, unknown> & { list: Record<string, unknown> }> = available.map((price) => ({ ...price, list: listById.get(String(price.price_list_id))! }))
    const wholesale = withList.find((price) => /mayorista|distribuidor/i.test(String(price.list.name)))
    const consumer = withList.find((price) => !/mayorista|distribuidor/i.test(String(price.list.name)))
    const cost = latestCost.get(String(variant.id)); const stock = stockByVariant.get(String(variant.id)); const price = consumer ?? wholesale
    return [{ sku: String(variant.sku), producto: String(product.name), variante: String(variant.name ?? ''), marca: String(product.brand ?? ''), familia: String(product.family ?? ''), subfamilia: String(product.subfamily ?? ''), unidad: String(variant.unit ?? ''), precio_consumidor_final: consumer ? Number(consumer.amount) : '', precio_mayorista: wholesale ? Number(wholesale.amount) : '', moneda_precio: String(price?.list.currency ?? ''), costo: cost ? Number(cost.amount) : '', moneda_costo: cost?.currency ?? '', stock: stock ? Number(stock.approved_quantity) : '', unidad_stock: stock?.unit ?? '', fuente: cost?.source ?? '' }]
  })
  return { isAdmin: true, costs, inventory, imports: imports.data ?? [], catalog }
}

export function csvEscape(value: unknown) {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function rowsToCsv(rows: object[]): string {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape((row as Record<string, unknown>)[header])).join(','))].join('\n')
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

function normalizeHeader(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
}

export function parseAdminCsv(content: string): Array<Record<string, string>> {
  const firstLine = content.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  const text = content.replace(/^\uFEFF/, '')
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (char === '"' && quoted && text[index + 1] === '"') { cell += '"'; index += 1 }
    else if (char === '"') quoted = !quoted
    else if (char === delimiter && !quoted) { row.push(cell); cell = '' }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && text[index + 1] === '\n') index += 1; row.push(cell); if (row.some((value) => value.trim())) rows.push(row); row = []; cell = '' }
    else cell += char
  }
  row.push(cell); if (row.some((value) => value.trim())) rows.push(row)
  const headers = (rows.shift() ?? []).map(normalizeHeader)
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ''])))
}

function parseLocaleNumber(value: string): number | '' | null {
  const clean = value.trim(); if (!clean) return ''
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export interface AdminImportPreview { row: number; sku: string; status: 'cambio' | 'sin_cambios' | 'error'; changes: string[]; errors: string[]; source: Record<string, string> }

export function previewAdminImport(content: string, catalog: AdminCatalogRow[]): AdminImportPreview[] {
  const known = new Map(catalog.map((item) => [item.sku.trim().toUpperCase(), item]))
  const seen = new Set<string>()
  return parseAdminCsv(content).map((source, index) => {
    const sku = String(source.sku ?? '').trim(); const key = sku.toUpperCase(); const current = known.get(key)
    const errors: string[] = []; const changes: string[] = []
    if (!sku) errors.push('Falta SKU')
    else if (seen.has(key)) errors.push('SKU repetido en el archivo')
    else if (!current) errors.push('SKU desconocido')
    seen.add(key)
    const numericFields = ['costo', 'precio_consumidor_final', 'precio_mayorista', 'stock'] as const
    for (const field of numericFields) {
      const parsed = parseLocaleNumber(source[field] ?? '')
      if (parsed === null) errors.push(`${field}: número inválido`)
      else if (parsed !== '' && current && parsed !== current[field]) changes.push(`${field}: ${current[field] === '' ? 'vacío' : current[field]} → ${parsed}`)
    }
    const currency = (source.moneda_precio || source.moneda_costo || '').toUpperCase()
    if (currency && !['ARS', 'USD'].includes(currency)) errors.push('Moneda debe ser ARS o USD')
    for (const field of ['moneda_precio', 'moneda_costo', 'unidad_stock'] as const) {
      const incoming = (source[field] ?? '').trim()
      if (incoming && current && incoming.toUpperCase() !== String(current[field]).toUpperCase()) changes.push(`${field}: ${current[field] || 'vacío'} → ${incoming}`)
    }
    if (changes.length && !(source.fuente || '').trim()) errors.push('Todo cambio exige fuente')
    return { row: index + 2, sku, status: errors.length ? 'error' : changes.length ? 'cambio' : 'sin_cambios', changes, errors, source }
  })
}
