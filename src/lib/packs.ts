/**
 * Unidades físicas por pack/SKU.
 *
 * Fuente de verdad: `catalog_variants.attributes.units_per_pack` (persistido,
 * auditable, cargado por un lote revisado). El parser por nombre es solo un
 * fallback temporal para SKU que todavía no tienen el atributo cargado — no
 * es la fuente final, así que nunca lo tratamos como si fuera confirmado.
 */

export interface PackableVariant {
  name: string
  attributes: Record<string, unknown>
}

/**
 * Detecta un multiplicador de pack en el nombre del producto, del tipo
 * "... X 2", "... (X4)", "... X 12 + GUANTES". Devuelve null si no encuentra
 * nada o si el nombre sugiere un combo/kit de varios productos distintos
 * (contiene "+"), porque ahí el multiplicador no describe una sola unidad
 * física homogénea y no queremos inventarlo.
 */
export function parsePackMultiplierFromName(name: string): number | null {
  if (/\+/.test(name)) return null
  const matches = [...name.matchAll(/(?:\(|\s)X\s*(\d{1,3})\)?\s*$/gi)]
  if (!matches.length) return null
  const value = Number(matches[0][1])
  return Number.isFinite(value) && value > 0 ? value : null
}

function readPositiveInt(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

/**
 * Unidades físicas que contiene una unidad de venta (un SKU/pack). 1 si no
 * hay atributo persistido ni se pudo inferir nada del nombre (SKU unitario).
 */
export function unitsPerPack(variant: PackableVariant): number {
  const persisted = readPositiveInt(variant.attributes?.units_per_pack)
  if (persisted) return persisted
  return parsePackMultiplierFromName(variant.name) ?? 1
}

/** Grupo de presentaciones hermanas del mismo producto base (persistido), o null si no aplica. */
export function packGroupOf(variant: PackableVariant): string | null {
  const value = variant.attributes?.pack_group
  return typeof value === 'string' && value.trim() ? value.trim() : null
}
