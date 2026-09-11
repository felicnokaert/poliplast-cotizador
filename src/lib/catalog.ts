import { supabase } from './supabase'
import type {
  CatalogProduct,
  CatalogVariant,
  PriceList,
  ProductWithVariants,
  TechnicalDocument,
  VariantPrice,
} from '../types/catalog'

export interface CatalogData {
  products: ProductWithVariants[]
  families: string[]
  brands: string[]
}

const VIGENTE_DOC_STATUSES = new Set(['vigente'])

function matchesDocument(doc: TechnicalDocument, variant: CatalogVariant, product: CatalogProduct): boolean {
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

export async function loadCatalog(): Promise<CatalogData> {
  const [productsRes, variantsRes, priceListsRes, pricesRes, docsRes] = await Promise.all([
    supabase.from('catalog_products').select('*').order('family').order('name'),
    supabase.from('catalog_variants').select('*').order('name'),
    supabase.from('price_lists').select('*'),
    supabase.from('variant_prices').select('*'),
    supabase.from('technical_documents').select('id, title, family, product, sku, status'),
  ])

  if (productsRes.error) throw productsRes.error
  if (variantsRes.error) throw variantsRes.error
  if (priceListsRes.error) throw priceListsRes.error
  if (pricesRes.error) throw pricesRes.error
  if (docsRes.error) throw docsRes.error

  const products = (productsRes.data ?? []) as CatalogProduct[]
  const variants = (variantsRes.data ?? []) as CatalogVariant[]
  const priceLists = new Map<string, PriceList>((priceListsRes.data ?? []).map((pl: PriceList) => [pl.id, pl]))
  const prices = (pricesRes.data ?? []) as VariantPrice[]
  const docs = (docsRes.data ?? []) as TechnicalDocument[]

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

  const productsById = new Map(products.map((p) => [p.id, p]))

  const result: ProductWithVariants[] = products.map((product) => {
    const productVariants = (variantsByProduct.get(product.id) ?? []).map((variant) => {
      const variantPrices = (pricesByVariant.get(variant.id) ?? [])
        .filter((price) => priceLists.has(price.price_list_id))
        .map((price) => ({ ...price, price_list: priceLists.get(price.price_list_id)! }))
        .sort((a, b) => a.min_quantity - b.min_quantity)

      const hasTechnicalDoc = docs.some((doc) => {
        const p = productsById.get(product.id)
        return p ? matchesDocument(doc, variant, p) : false
      })

      return { ...variant, prices: variantPrices, hasTechnicalDoc }
    })

    return { ...product, variants: productVariants }
  })

  const families = Array.from(new Set(products.map((p) => p.family))).sort()
  const brands = Array.from(new Set(products.map((p) => p.brand))).sort()

  return { products: result, families, brands }
}
