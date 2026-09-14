import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'

const KIT_PATTERN = /\b(?:kits?|combos?|sets?)\b/i
const KIT_SKU_PATTERN = /^KT-/i

export function isKitPresentation(
  productName: string,
  variant: Pick<VariantWithPricing, 'name' | 'sku'>,
  subfamily = '',
): boolean {
  const description = `${productName} ${variant.name} ${subfamily}`
  return KIT_PATTERN.test(description) || KIT_SKU_PATTERN.test(variant.sku) || description.includes('+')
}

export function withoutKits(products: ProductWithVariants[]): ProductWithVariants[] {
  return products.flatMap((product) => {
    const variants = product.variants.filter((variant) => !isKitPresentation(product.name, variant, product.subfamily))
    return variants.length ? [{ ...product, variants }] : []
  })
}
