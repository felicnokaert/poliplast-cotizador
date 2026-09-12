import type { VariantWithPricing } from '../types/catalog'

/** Precio vigente y confirmado de una variante, si existe. */
export function currentPrice(variant: VariantWithPricing) {
  return variant.prices.find((p) => p.price_list.status === 'vigente' && p.status === 'confirmado')
}

const isAvailable = (price: VariantWithPricing['prices'][number]) => price.price_list.status === 'vigente' && price.status === 'confirmado'
const isWholesale = (name: string) => /mayorista|distribuidor/i.test(name)

export function commercialPrices(variant: VariantWithPricing) {
  const available = variant.prices.filter(isAvailable)
  return {
    consumer: available.find((price) => !isWholesale(price.price_list.name)),
    wholesale: available.find((price) => isWholesale(price.price_list.name)),
  }
}

export function hasVigentPrice(variant: VariantWithPricing): boolean {
  return variant.prices.some((p) => p.price_list.status === 'vigente')
}
