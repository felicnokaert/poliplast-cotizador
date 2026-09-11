import type { VariantWithPricing } from '../types/catalog'

/** Precio vigente y confirmado de una variante, si existe. */
export function currentPrice(variant: VariantWithPricing) {
  return variant.prices.find((p) => p.price_list.status === 'vigente' && p.status === 'confirmado')
}

export function hasVigentPrice(variant: VariantWithPricing): boolean {
  return variant.prices.some((p) => p.price_list.status === 'vigente')
}
