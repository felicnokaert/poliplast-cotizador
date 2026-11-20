// 20/11 (Felipe: «un signo de alerta aclarando, tipo precio raro»): compara el precio de lista con el precio de la
// publicación ACTIVA de Mercado Libre que más vendió con el mismo SKU (también por SKU de variación). En ML el
// precio suele ser 1 a 1,6 veces la lista por la comisión; fuera de 0,5 a 2,5 veces casi seguro hay un error de
// carga o el SKU es de otro tamaño, pack o kit. Solo avisa: no cambia ningún precio.
import { supabase } from './supabase'

export const RARE_PRICE = { low: 0.5, high: 2.5 }
export type MlPrice = { price: number; title: string }

export const normSku = (value: unknown) => String(value ?? '').trim().toUpperCase().replace(/\s+/g, '')

type MlRow = { sku?: string | null; price?: number | null; sold_quantity?: number | null; title?: string | null; variation_skus?: { sku?: string }[] | null }

export function mlPriceMap(rows: MlRow[]): Map<string, MlPrice> {
  const best = new Map<string, MlPrice & { sold: number }>()
  for (const row of rows) {
    const price = Number(row.price) || 0
    if (price <= 0) continue
    const skus = new Set([normSku(row.sku), ...(row.variation_skus || []).map((entry) => normSku(entry?.sku))].filter(Boolean))
    const sold = Number(row.sold_quantity) || 0
    for (const sku of skus) {
      const current = best.get(sku)
      if (!current || sold > current.sold) best.set(sku, { price, title: String(row.title || ''), sold })
    }
  }
  return new Map([...best].map(([sku, value]) => [sku, { price: value.price, title: value.title }]))
}

export async function loadMlPrices(): Promise<Map<string, MlPrice>> {
  const rows: MlRow[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from('ml_items').select('sku,price,sold_quantity,title,variation_skus').eq('status', 'active').order('id').range(from, from + 999)
    if (error) throw error
    rows.push(...((data as MlRow[]) || []))
    if (!data || data.length < 1000) break
  }
  return mlPriceMap(rows)
}

const ars = (amount: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount)

/** Texto del aviso, o null si el precio cierra (o falta el dato para comparar). */
export function rarePriceWarning(amount: number | null | undefined, currency: string, ml: MlPrice | undefined, exchangeRate: number): string | null {
  if (!amount || amount <= 0 || !ml?.price) return null
  const listArs = currency === 'USD' ? (exchangeRate > 0 ? amount * exchangeRate : null) : amount
  if (!listArs) return null
  const ratio = ml.price / listArs
  if (ratio <= RARE_PRICE.high && ratio >= RARE_PRICE.low) return null
  const times = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value)
  const compare = ratio > 1 ? `Mercado Libre está ${times(ratio)} veces más caro` : `la lista está ${times(1 / ratio)} veces más cara`
  return `En Mercado Libre se vende a ${ars(ml.price)} y esta lista da ${ars(listArs)}: ${compare}. Revisá el precio o si el SKU es de otro tamaño o pack.`
}
