import type { QuoteLine } from './quote'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'

// Plantillas de cotización: combinaciones que se repiten (ej. balde + resina + pigmento). Guardan solo QUÉ y CUÁNTO
// (producto, presentación y cantidad), nunca precios: al usarlas se toma el catálogo y las reglas vigentes de hoy.
// Se guardan en este equipo (localStorage).

export const TEMPLATES_KEY = 'poliplast-cotizador-templates-v1'

export interface TemplateItem { productId: string; variantId: string; name: string; sku: string; quantity: number }
export interface QuoteTemplate { id: string; name: string; items: TemplateItem[]; createdAt: string }

export function loadTemplates(storage: Pick<Storage, 'getItem'> = localStorage): QuoteTemplate[] {
  try {
    const list = JSON.parse(storage.getItem(TEMPLATES_KEY) || '[]') as QuoteTemplate[]
    return Array.isArray(list) ? list.filter((item) => item?.id && item.name && Array.isArray(item.items) && item.items.length > 0) : []
  } catch { return [] }
}

export function saveTemplates(templates: QuoteTemplate[], storage: Pick<Storage, 'setItem'> = localStorage) {
  try { storage.setItem(TEMPLATES_KEY, JSON.stringify(templates)) } catch { /* sin almacenamiento: no se guardan, nada más */ }
}

export function templateFromLines(name: string, lines: QuoteLine[], id: string, now = new Date().toISOString()): QuoteTemplate {
  return {
    id,
    name: name.trim(),
    createdAt: now,
    items: lines.map((line) => ({ productId: line.productId, variantId: line.variant.id, name: line.productName, sku: line.variant.sku, quantity: line.quantity })),
  }
}

export interface ResolvedTemplateItem { product: ProductWithVariants; variant: VariantWithPricing; quantity: number }

/** Cruza la plantilla con el catálogo de hoy; lo que ya no existe (producto o presentación) se cuenta aparte, no se inventa. */
export function resolveTemplate(template: QuoteTemplate, products: ProductWithVariants[]): { items: ResolvedTemplateItem[]; missing: TemplateItem[] } {
  const byId = new Map(products.map((product) => [product.id, product]))
  const items: ResolvedTemplateItem[] = []
  const missing: TemplateItem[] = []
  for (const item of template.items) {
    const product = byId.get(item.productId)
    const variant = product?.variants.find((candidate) => candidate.id === item.variantId)
    if (product && variant) items.push({ product, variant, quantity: item.quantity })
    else missing.push(item)
  }
  return { items, missing }
}
