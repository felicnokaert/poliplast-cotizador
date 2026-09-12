import type { VariantWithPricing } from '../types/catalog'

const listIsCurrent = (price: VariantWithPricing['prices'][number], today = new Date().toISOString().slice(0, 10)) =>
  price.price_list.status === 'vigente' && price.status === 'confirmado' && price.price_list.valid_from <= today && (!price.price_list.valid_until || price.price_list.valid_until >= today)
const newestFirst = (a: VariantWithPricing['prices'][number], b: VariantWithPricing['prices'][number]) => b.price_list.valid_from.localeCompare(a.price_list.valid_from) || b.min_quantity - a.min_quantity

/** Precio confirmado de la lista vigente más reciente, si existe. */
export function currentPrice(variant: VariantWithPricing, today?: string) {
  return variant.prices.filter((price) => listIsCurrent(price, today)).sort(newestFirst)[0]
}

const isWholesale = (name: string) => /mayorista|distribuidor/i.test(name)

export function commercialPrices(variant: VariantWithPricing, today?: string) {
  const available = variant.prices.filter((price) => listIsCurrent(price, today)).sort(newestFirst)
  return {
    consumer: available.find((price) => !isWholesale(price.price_list.name)),
    wholesale: available.find((price) => isWholesale(price.price_list.name)),
  }
}

export function hasVigentPrice(variant: VariantWithPricing): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return variant.prices.some((price) => price.price_list.status === 'vigente' && price.price_list.valid_from <= today && (!price.price_list.valid_until || price.price_list.valid_until >= today))
}
