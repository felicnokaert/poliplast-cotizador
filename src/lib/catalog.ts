import { supabase } from './supabase'
import type {
  CatalogProduct,
  CatalogVariant,
  InventoryBalance,
  PriceList,
  ProductDocumentLink,
  ProductWithVariants,
  TechnicalDocument,
  VariantPrice,
} from '../types/catalog'

export interface CatalogData {
  products: ProductWithVariants[]
  families: string[]
  brands: string[]
}

export interface RawCatalogRows {
  products: CatalogProduct[]
  variants: CatalogVariant[]
  priceLists: PriceList[]
  prices: VariantPrice[]
  docs: TechnicalDocument[]
  inventory?: InventoryBalance[]
  documentLinks?: ProductDocumentLink[]
}

const VIGENTE_DOC_STATUSES = new Set(['vigente'])

/**
 * Coincidencia heurística por SKU exacto o por familia+nombre de producto.
 * No hay una tabla de vínculo formal (product_documents) todavía, así que esto
 * es una sugerencia a validar por el vendedor, nunca un vínculo confirmado.
 */
export function matchesDocument(doc: TechnicalDocument, variant: CatalogVariant, product: CatalogProduct): boolean {
  if (!VIGENTE_DOC_STATUSES.has(doc.status)) return false
  const sku = variant.sku.trim().toUpperCase()
  if (doc.sku && doc.sku.trim().toUpperCase() === sku) return true
  if (doc.family && doc.family.trim().toLowerCase() === product.family.trim().toLowerCase()) {
    if (doc.product && doc.product.trim().toLowerCase() === product.name.trim().toLowerCase()) {
      return true
    }
  }
  return false
}

/** Ensambla el catálogo navegable a partir de las filas crudas de las tablas. Función pura, sin I/O. */
export function assembleCatalog(raw: RawCatalogRows): CatalogData {
  const { products, variants, prices, docs } = raw
  const priceLists = new Map<string, PriceList>(raw.priceLists.map((pl) => [pl.id, pl]))
  const inventoryByVariant = new Map<string, InventoryBalance[]>()
  for (const balance of raw.inventory ?? []) inventoryByVariant.set(balance.variant_id, [...(inventoryByVariant.get(balance.variant_id) ?? []), balance])

  const pricesByVariant = new Map<string, VariantPrice[]>()
  for (const price of prices) {
    const list = pricesByVariant.get(price.variant_id) ?? []
    list.push(price)
    pricesByVariant.set(price.variant_id, list)
  }

  const variantsByProduct = new Map<string, CatalogVariant[]>()
  for (const variant of variants) {
    const list = variantsByProduct.get(variant.product_id) ?? []
    list.push(variant)
    variantsByProduct.set(variant.product_id, list)
  }

  const documentsById = new Map(docs.filter((doc) => doc.status === 'vigente').map((doc) => [doc.id, doc]))

  const result: ProductWithVariants[] = products.map((product) => {
    const productVariants = (variantsByProduct.get(product.id) ?? []).map((variant) => {
      const variantPrices = (pricesByVariant.get(variant.id) ?? [])
        .filter((price) => priceLists.has(price.price_list_id))
        .map((price) => ({ ...price, price_list: priceLists.get(price.price_list_id)! }))
        .sort((a, b) => a.min_quantity - b.min_quantity)

      const technicalDocuments = (raw.documentLinks ?? []).filter((link) => {
        if (!documentsById.has(link.document_id)) return false
        if (link.scope_type === 'variant') return link.variant_id === variant.id
        if (link.scope_type === 'product') return link.product_id === product.id
        return link.scope_type === 'subfamily' && link.family?.trim().toLowerCase() === product.family.trim().toLowerCase() && link.subfamily?.trim().toLowerCase() === product.subfamily.trim().toLowerCase()
      }).map((link) => documentsById.get(link.document_id)!).filter((doc, index, all) => all.findIndex((item) => item.id === doc.id) === index)
      const hasTechnicalDoc = technicalDocuments.length > 0

      const balances = inventoryByVariant.get(variant.id) ?? []
      const units = new Set(balances.map((balance) => balance.unit))
      const approvedStock = balances.length && units.size === 1 ? {
        quantity: balances.reduce((sum, balance) => sum + Number(balance.approved_quantity), 0),
        unit: balances[0].unit,
        approvedAt: balances.map((balance) => balance.approved_at).sort().at(-1)!,
      } : null
      return { ...variant, prices: variantPrices, hasTechnicalDoc, technicalDocuments, approvedStock }
    })

    return { ...product, variants: productVariants }
  })

  const families = Array.from(new Set(products.map((p) => p.family))).sort()
  const brands = Array.from(new Set(products.map((p) => p.brand))).sort()

  return { products: result, families, brands }
}

const SUPABASE_PAGE_SIZE = 1000

/**
 * PostgREST (Supabase) devuelve como máximo ~1000 filas por consulta salvo
 * que se pagine explícitamente con `.range()`. El catálogo ya superó esa
 * cifra (1792 productos/variantes, más precios): sin este loop, la carga
 * se corta en silencio y desaparecen familias enteras (ej. RESINPLAST) sin
 * ningún error visible. Trae todas las páginas hasta que una vuelve vacía
 * o más corta que el tamaño de página.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = []
  let from = 0
  for (;;) {
    const { data, error } = await build(from, from + SUPABASE_PAGE_SIZE - 1)
    if (error) throw error
    const page = data ?? []
    rows.push(...page)
    if (page.length < SUPABASE_PAGE_SIZE) break
    from += SUPABASE_PAGE_SIZE
  }
  return rows
}

export async function loadCatalog(): Promise<CatalogData> {
  const linksPromise = (async () => {
    try {
      const { data } = await supabase.from('product_document_links').select('document_id,scope_type,product_id,variant_id,family,subfamily')
      return (data ?? []) as ProductDocumentLink[]
    } catch { return [] as ProductDocumentLink[] }
  })()
  const [products, variants, priceListsRes, prices, docsRes, inventory, documentLinks] = await Promise.all([
    fetchAll<CatalogProduct>((from, to) =>
      supabase.from('catalog_products').select('*').order('family').order('name').range(from, to),
    ),
    fetchAll<CatalogVariant>((from, to) => supabase.from('catalog_variants').select('*').order('name').range(from, to)),
    supabase.from('price_lists').select('*'),
    fetchAll<VariantPrice>((from, to) => supabase.from('variant_prices').select('*').range(from, to)),
    supabase.from('technical_documents').select('id, title, family, product, sku, status, source_url, storage_path'),
    fetchAll<InventoryBalance>((from, to) => supabase.from('inventory_balances').select('variant_id, approved_quantity, unit, approved_at').range(from, to)),
    linksPromise,
  ])

  if (priceListsRes.error) throw priceListsRes.error
  if (docsRes.error) throw docsRes.error

  return assembleCatalog({
    products,
    variants,
    priceLists: (priceListsRes.data ?? []) as PriceList[],
    prices,
    docs: (docsRes.data ?? []) as TechnicalDocument[],
    inventory,
    documentLinks,
  })
}

export async function technicalDocumentUrl(document: TechnicalDocument): Promise<string | null> {
  if (document.storage_path) {
    const { data, error } = await supabase.storage.from('technical-documents').createSignedUrl(document.storage_path, 300)
    if (!error && data?.signedUrl) return data.signedUrl
  }
  return document.source_url?.trim() || null
}
