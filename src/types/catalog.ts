export type ProductStatus = 'vigente' | 'excluido' | 'pendiente_revision'
export type PriceListStatus = 'borrador' | 'vigente' | 'vencida'
export type PriceStatus = 'pendiente' | 'confirmado' | 'vencido' | 'excepcion_manual'

export interface CatalogProduct {
  id: string
  canonical_key: string
  name: string
  brand: string
  family: string
  subfamily: string
  status: ProductStatus
  source: string
  source_updated_at: string | null
  photo_path?: string | null
}

export interface CatalogVariant {
  id: string
  product_id: string
  sku: string
  name: string
  unit: string
  attributes: Record<string, unknown>
  active: boolean
}

export interface PriceList {
  id: string
  name: string
  brand: string
  currency: 'ARS' | 'USD'
  vat_rate: number | null
  valid_from: string
  valid_until: string | null
  status: PriceListStatus
}

export interface VariantPrice {
  id: string
  price_list_id: string
  variant_id: string
  min_quantity: number
  max_quantity: number | null
  amount: number
  status: PriceStatus
}

export interface TechnicalDocument {
  id: string
  title: string
  family: string
  product: string
  sku: string
  status: string
  source_url?: string
  storage_path?: string | null
}

export interface ProductDocumentLink { document_id: string; scope_type: 'product' | 'variant' | 'subfamily'; product_id: string | null; variant_id: string | null; family: string | null; subfamily: string | null }

export interface InventoryBalance { variant_id: string; approved_quantity: number; unit: string; approved_at: string }

export interface VariantWithPricing extends CatalogVariant {
  prices: (VariantPrice & { price_list: PriceList })[]
  hasTechnicalDoc: boolean
  technicalDocuments?: TechnicalDocument[]
  approvedStock?: { quantity: number; unit: string; approvedAt: string } | null
}

export interface ProductWithVariants extends CatalogProduct {
  variants: VariantWithPricing[]
}
