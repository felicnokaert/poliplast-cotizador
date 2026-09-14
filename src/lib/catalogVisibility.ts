import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'

const KIT_PATTERN = /\b(?:kit|combo)\b/i

export function isKitPresentation(productName: string, variant: Pick<VariantWithPricing, 'name'>): boolean {
  return KIT_PATTERN.test(`${productName} ${variant.name}`)
}

export function withoutKits(products: ProductWithVariants[]): ProductWithVariants[] {
  return products.flatMap((product) => {
    const variants = product.variants.filter((variant) => !isKitPresentation(product.name, variant))
    return variants.length ? [{ ...product, variants }] : []
  })
}
