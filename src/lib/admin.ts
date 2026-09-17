import { supabase } from './supabase'

export interface AdminOverview {
  isAdmin: boolean
  costs: Array<{ variant_id: string; amount: number; currency: string; valid_from: string; valid_until: string | null; source: string; status: string }>
  inventory: Array<{ location_id: string; variant_id: string; approved_quantity: number; unit: string; approved_at: string }>
  locations: Array<{ id: string; code: string; name: string; active: boolean }>
  imports: Array<{ id: string; import_type: string; file_name: string; status: string; created_at: string }>
  catalog: AdminCatalogRow[]
}

export interface AdminCatalogRow {
  product_id: string; variant_id: string; active: boolean; product_status: string
  sku: string; producto: string; variante: string; marca: string; familia: string; subfamilia: string; unidad: string
  precio_consumidor_final: number | ''; precio_mayorista: number | ''; moneda_precio: string
  costo: number | ''; moneda_costo: string; stock: number | ''; unidad_stock: string; fuente: string
  photo_path: string | null
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
  if (roleError || !isAdmin) return { isAdmin: false, costs: [], inventory: [], locations: [], imports: [], catalog: [] }

  const [costs, inventory, locations, imports, products, variants, prices, priceLists] = await Promise.all([
    fetchAll<AdminOverview['costs'][number]>((from, to) => supabase.from('catalog_cost_revisions').select('variant_id, amount, currency, valid_from, valid_until, source, status').order('valid_from', { ascending: false }).range(from, to)),
    fetchAll<AdminOverview['inventory'][number]>((from, to) => supabase.from('inventory_balances').select('location_id, variant_id, approved_quantity, unit, approved_at').range(from, to)),
    fetchAll<AdminOverview['locations'][number]>((from, to) => supabase.from('inventory_locations').select('id,code,name,active').order('name').range(from, to)),
    supabase.from('catalog_import_jobs').select('id, import_type, file_name, status, created_at').order('created_at', { ascending: false }).limit(20),
    fetchAll<Record<string, unknown>>((from, to) => supabase.from('catalog_products').select('id,name,brand,family,subfamily,status,photo_path').range(from, to)),
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
  const stockByVariant = new Map<string, AdminOverview['inventory'][number]>()
  for (const item of inventory) {
    const current = stockByVariant.get(item.variant_id)
    stockByVariant.set(item.variant_id, current ? { ...current, approved_quantity: Number(current.approved_quantity) + Number(item.approved_quantity) } : item)
  }
  const catalog = variants.flatMap((variant): AdminCatalogRow[] => {
    const product = productById.get(String(variant.product_id)); if (!product) return []
    const available = (pricesByVariant.get(String(variant.id)) ?? []).filter((price) => price.status === 'confirmado' && listById.get(String(price.price_list_id))?.status === 'vigente')
    const withList: Array<Record<string, unknown> & { list: Record<string, unknown> }> = available.map((price) => ({ ...price, list: listById.get(String(price.price_list_id))! }))
    const wholesale = withList.find((price) => /mayorista|distribuidor/i.test(String(price.list.name)))
    const consumer = withList.find((price) => !/mayorista|distribuidor/i.test(String(price.list.name)))
    const cost = latestCost.get(String(variant.id)); const stock = stockByVariant.get(String(variant.id)); const price = consumer ?? wholesale
    return [{ product_id: String(product.id), variant_id: String(variant.id), active: variant.active !== false, product_status: String(product.status), sku: String(variant.sku), producto: String(product.name), variante: String(variant.name ?? ''), marca: String(product.brand ?? ''), familia: String(product.family ?? ''), subfamilia: String(product.subfamily ?? ''), unidad: String(variant.unit ?? ''), precio_consumidor_final: consumer ? Number(consumer.amount) : '', precio_mayorista: wholesale ? Number(wholesale.amount) : '', moneda_precio: String(price?.list.currency ?? ''), costo: cost ? Number(cost.amount) : '', moneda_costo: cost?.currency ?? '', stock: stock ? Number(stock.approved_quantity) : '', unidad_stock: stock?.unit ?? '', fuente: cost?.source ?? '', photo_path: (product.photo_path as string | null) ?? null }]
  })
  return { isAdmin: true, costs, inventory, locations, imports: imports.data ?? [], catalog }
}

export async function updateCatalogClassification(productId: string, family: string, subfamily: string) {
  const cleanFamily = family.trim(); const cleanSubfamily = subfamily.trim()
  if (!cleanFamily) throw new Error('La familia no puede quedar vacía.')
  const { data, error } = await supabase.from('catalog_products').update({ family: cleanFamily, subfamily: cleanSubfamily, updated_at: new Date().toISOString() }).eq('id', productId).select('id').single()
  if (error) throw error
  return data
}

export interface SkuConflict {
  variantId: string
  productId: string
  productName: string
  variantName: string
  active: boolean
}

/** Se lanza cuando el SKU ya existe pero en una variante DESACTIVADA: el llamador puede ofrecer reactivarla en vez de bloquear el alta. */
export class InactiveSkuConflictError extends Error {
  conflict: SkuConflict
  constructor(conflict: SkuConflict) {
    super(`Ya existe una variante desactivada con el SKU de "${conflict.variantName}" (producto: ${conflict.productName}).`)
    this.conflict = conflict
  }
}

async function assertSkuAvailable(sku: string, excludeVariantId?: string): Promise<void> {
  let query = supabase.from('catalog_variants').select('id, active, name, product_id, catalog_products(name)').eq('sku', sku).limit(1)
  if (excludeVariantId) query = query.neq('id', excludeVariantId)
  const { data: existing, error } = await query
  if (error) throw error
  const row = existing?.[0] as { id: string; active: boolean; name: string; product_id: string; catalog_products: { name: string } | { name: string }[] | null } | undefined
  if (!row) return
  if (row.active) throw new Error(`Ya existe otra variante con el SKU ${sku}.`)
  const productRef = Array.isArray(row.catalog_products) ? row.catalog_products[0] : row.catalog_products
  throw new InactiveSkuConflictError({ variantId: row.id, productId: row.product_id, productName: productRef?.name ?? '(sin nombre)', variantName: row.name, active: row.active })
}

/** Reactiva una variante desactivada, opcionalmente actualizando nombre/unidad/pack y moviéndola a otro producto (productId) con los datos recién ingresados. */
export async function reactivateCatalogVariant(variantId: string, updates: { name?: string; unit?: string; unitsPerPack?: number; productId?: string }): Promise<void> {
  const patch: Record<string, unknown> = { active: true, updated_at: new Date().toISOString() }
  if (updates.productId) patch.product_id = updates.productId
  if (updates.name?.trim()) patch.name = updates.name.trim()
  if (updates.unit?.trim()) patch.unit = updates.unit.trim()
  if (updates.unitsPerPack && updates.unitsPerPack > 1) patch.attributes = { units_per_pack: updates.unitsPerPack }
  const { error } = await supabase.from('catalog_variants').update(patch).eq('id', variantId)
  if (error) throw error
}

export async function updateCatalogVariantSku(variantId: string, sku: string) {
  const cleanSku = sku.trim()
  if (!cleanSku) throw new Error('El SKU no puede quedar vacío.')
  await assertSkuAvailable(cleanSku, variantId)
  const { error } = await supabase.from('catalog_variants').update({ sku: cleanSku, updated_at: new Date().toISOString() }).eq('id', variantId)
  if (error) throw error
}

export async function updateCatalogProductName(productId: string, name: string) {
  const cleanName = name.trim()
  if (cleanName.length < 3) throw new Error('El nombre debe tener al menos 3 caracteres.')
  const { data, error } = await supabase.from('catalog_products').update({ name: cleanName, updated_at: new Date().toISOString() }).eq('id', productId).select('id').single()
  if (error) throw error
  return data
}

export interface NewProductInput { name: string; brand: string; family: string; subfamily: string; sku: string; unit: string }

export async function createCatalogProduct(input: NewProductInput): Promise<string> {
  const name = input.name.trim(); const brand = input.brand.trim() || 'Grupo Poliplast'; const family = input.family.trim(); const sku = input.sku.trim()
  if (name.length < 3) throw new Error('Ingresá el nombre del producto.')
  if (!family) throw new Error('Ingresá la familia.')
  if (!sku) throw new Error('Ingresá el SKU de la primera variante.')
  await assertSkuAvailable(sku)
  const canonicalKey = `${brand}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  const { data: product, error: productError } = await supabase.from('catalog_products').insert({
    name, brand, family, subfamily: input.subfamily.trim(), status: 'vigente', source: 'Alta manual desde Administración', canonical_key: canonicalKey || crypto.randomUUID(),
  }).select('id').single()
  if (productError) throw productError
  const { error: variantError } = await supabase.from('catalog_variants').insert({ product_id: product.id, sku, name, unit: input.unit.trim() || 'unidad', active: true, source: 'Alta manual desde Administración' })
  if (variantError) throw variantError
  return product.id as string
}

export interface NewVariantInput { sku: string; name: string; unit: string; unitsPerPack?: number }

export async function createCatalogVariant(productId: string, input: NewVariantInput): Promise<string> {
  const sku = input.sku.trim(); const name = input.name.trim(); const unit = input.unit.trim() || 'unidad'
  if (!sku) throw new Error('Ingresá el SKU de la variante.')
  if (!name) throw new Error('Ingresá el nombre de la variante.')
  await assertSkuAvailable(sku)
  const attributes = input.unitsPerPack && input.unitsPerPack > 1 ? { units_per_pack: input.unitsPerPack } : {}
  const { data, error } = await supabase.from('catalog_variants').insert({ product_id: productId, sku, name, unit, attributes, active: true, source: 'Alta manual desde Administración' }).select('id').single()
  if (error) throw error
  return data.id as string
}

export async function setCatalogVariantActive(variantId: string, active: boolean) {
  const { data, error } = await supabase.from('catalog_variants').update({ active, updated_at: new Date().toISOString() }).eq('id', variantId).select('id,active').single()
  if (error) throw error
  return data
}

export async function setCatalogVariantPrice(variantId: string, kind: PriceImportKind, amount: number, currency: 'USD' | 'ARS', reason: string) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Ingresá un precio válido.')
  if (reason.trim().length < 3) throw new Error('Indicá la fuente o motivo del cambio.')
  const { data, error } = await supabase.rpc('admin_set_variant_price', { p_variant_id: variantId, p_kind: kind, p_amount: amount, p_currency: currency, p_reason: reason.trim() })
  if (error) throw error
  return data as string
}

/** El costo se carga siempre sin IVA (neto), a diferencia de los precios de venta que son finales con IVA incluido. */
export async function setCatalogVariantCost(variantId: string, amount: number, currency: 'USD' | 'ARS', reason: string) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Ingresá un costo válido.')
  if (reason.trim().length < 3) throw new Error('Indicá la fuente o motivo del cambio.')
  const { data, error } = await supabase.rpc('admin_set_variant_cost', { p_variant_id: variantId, p_amount: amount, p_currency: currency, p_reason: reason.trim() })
  if (error) throw error
  return data as string
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

export interface CatalogActiveReviewPreview {
  row: number
  variantId: string
  sku: string
  currentActive: boolean
  requestedActive: boolean | null
  status: 'cambio' | 'sin_cambios' | 'error'
  errors: string[]
}

function parseActiveValue(value: string): boolean | null {
  const normalized = normalizeHeader(value)
  if (['verdadero', 'true', 'si', '1', 'activo'].includes(normalized)) return true
  if (['falso', 'false', 'no', '0', 'inactivo'].includes(normalized)) return false
  return null
}

export function previewCatalogActiveReview(content: string, catalog: AdminCatalogRow[]): CatalogActiveReviewPreview[] {
  const byId = new Map(catalog.map((item) => [item.variant_id, item]))
  const bySku = new Map<string, AdminCatalogRow[]>()
  for (const item of catalog) {
    const key = item.sku.trim().toUpperCase()
    bySku.set(key, [...(bySku.get(key) ?? []), item])
  }
  const seen = new Set<string>()
  return parseAdminCsv(content).map((source, index) => {
    const sourceId = (source.variant_id ?? '').trim()
    const sourceSku = (source.sku ?? '').trim()
    const skuMatches = bySku.get(sourceSku.toUpperCase()) ?? []
    const current = (sourceId && byId.get(sourceId)) || (skuMatches.length === 1 ? skuMatches[0] : undefined)
    const errors: string[] = []
    const requestedActive = parseActiveValue(source.active ?? '')
    if (!sourceId && !sourceSku) errors.push('Falta variant_id o SKU')
    else if (!current && skuMatches.length > 1) errors.push('SKU ambiguo: hay más de una variante')
    else if (!current) errors.push('La variante no existe en el catálogo actual')
    if (current && sourceSku && current.sku.trim().toUpperCase() !== sourceSku.toUpperCase()) errors.push('El SKU no coincide con variant_id')
    if (requestedActive === null) errors.push('ACTIVE debe ser VERDADERO o FALSO')
    const identity = (current?.variant_id ?? sourceId) || `fila-${index + 2}`
    if (seen.has(identity)) errors.push('Variante repetida en el archivo')
    seen.add(identity)
    const currentActive = current?.active ?? false
    return {
      row: index + 2,
      variantId: current?.variant_id ?? sourceId,
      sku: current?.sku ?? sourceSku,
      currentActive,
      requestedActive,
      status: errors.length ? 'error' : currentActive === requestedActive ? 'sin_cambios' : 'cambio',
      errors,
    }
  })
}

export async function applyCatalogActiveReview(preview: CatalogActiveReviewPreview[]): Promise<number> {
  const changes = preview.filter((item) => item.status === 'cambio' && item.requestedActive !== null)
  if (!changes.length) throw new Error('No hay cambios de ACTIVE válidos para aplicar.')
  for (const item of changes) await setCatalogVariantActive(item.variantId, item.requestedActive!)
  return changes.length
}

export interface CostImportRow { row_number: number; sku: string; amount: number; currency: 'ARS' | 'USD'; source: string; valid_from: string }
export type PriceImportKind = 'consumidor_final' | 'mayorista'
export interface PriceImportRow { row_number: number; sku: string; amount: number; source: string }

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

export function buildCostImportRows(preview: AdminImportPreview[], validFrom = new Date().toISOString().slice(0, 10)): CostImportRow[] {
  return preview.flatMap((item) => {
    if (item.status !== 'cambio' || !item.changes.some((change) => change.startsWith('costo:'))) return []
    const amount = parseLocaleNumber(item.source.costo ?? '')
    const currency = (item.source.moneda_costo ?? '').trim().toUpperCase()
    const source = (item.source.fuente ?? '').trim()
    if (amount === '' || amount === null || !['ARS', 'USD'].includes(currency) || !source) return []
    return [{ row_number: item.row, sku: item.sku, amount, currency: currency as 'ARS' | 'USD', source, valid_from: validFrom }]
  })
}

export function buildPriceImportRows(preview: AdminImportPreview[], kind: PriceImportKind): PriceImportRow[] {
  const field = kind === 'mayorista' ? 'precio_mayorista' : 'precio_consumidor_final'
  return preview.flatMap((item) => {
    if (item.status !== 'cambio' || !item.changes.some((change) => change.startsWith(`${field}:`))) return []
    const amount = parseLocaleNumber(item.source[field] ?? '')
    const source = (item.source.fuente ?? '').trim()
    if (amount === '' || amount === null || !source) return []
    return [{ row_number: item.row, sku: item.sku, amount, source }]
  })
}

export async function sha256Text(content: string): Promise<string> {
  const bytes = new TextEncoder().encode(content.replace(/^\uFEFF/, ''))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')
}

export async function applyCostImport(fileName: string, content: string, rows: CostImportRow[]): Promise<{ job_id: string; applied: number }> {
  if (!rows.length) throw new Error('No hay cambios de costo válidos para aplicar.')
  const { data, error } = await supabase.rpc('apply_catalog_cost_import', {
    p_file_name: fileName,
    p_file_sha256: await sha256Text(content),
    p_rows: rows,
  })
  if (error) throw error
  const result = (Array.isArray(data) ? data[0] : data) as { job_id?: string; applied?: number } | null
  if (!result?.job_id) throw new Error('La importación no devolvió un lote auditable.')
  return { job_id: result.job_id, applied: Number(result.applied ?? rows.length) }
}

export async function revertCostImport(jobId: string): Promise<number> {
  const { data, error } = await supabase.rpc('revert_catalog_cost_import', { p_job_id: jobId })
  if (error) throw error
  return Number(data ?? 0)
}

export async function applyPriceImport(input: { fileName: string; content: string; rows: PriceImportRow[]; kind: PriceImportKind; listName: string; currency: 'ARS' | 'USD'; vatRate: number; validFrom: string }): Promise<{ job_id: string; price_list_id: string; applied: number }> {
  if (!input.rows.length) throw new Error('No hay cambios de precio válidos para aplicar.')
  const { data, error } = await supabase.rpc('apply_catalog_price_import', {
    p_file_name: input.fileName, p_file_sha256: await sha256Text(input.content), p_rows: input.rows,
    p_kind: input.kind, p_list_name: input.listName, p_currency: input.currency,
    p_vat_rate: input.vatRate, p_valid_from: input.validFrom,
  })
  if (error) throw error
  const result = (Array.isArray(data) ? data[0] : data) as { job_id?: string; price_list_id?: string; applied?: number } | null
  if (!result?.job_id || !result.price_list_id) throw new Error('La importación no devolvió una lista auditable.')
  return { job_id: result.job_id, price_list_id: result.price_list_id, applied: Number(result.applied ?? input.rows.length) }
}

export async function revertPriceImport(jobId: string): Promise<number> {
  const { data, error } = await supabase.rpc('revert_catalog_price_import', { p_job_id: jobId })
  if (error) throw error
  return Number(data ?? 0)
}
