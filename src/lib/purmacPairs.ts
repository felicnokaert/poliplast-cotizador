export interface PurmacPair<P> {
  /** Pieza original (código Graco, sin prefijo PM). */
  generic: P
  /** Misma pieza con código Purmac (prefijo PM). */
  purmac: P
}

const PM_PREFIX = /^PM[\s-]*/i
const PACK_SUFFIX = /-1$/

/**
 * En Purmac, la misma pieza figura como original (ej. 118665) y como Purmac
 * (mismo código con prefijo PM, ej. "PM 118665-1"). Las empareja por código
 * para mostrarlas en una sola ficha. Solo empareja cuando existen las dos
 * versiones; el resto queda como está. `mains` es la lista a dibujar (sin la
 * ficha que quedó absorbida) y `pairs` indica, por id de la ficha principal,
 * sus dos versiones. La ficha principal es la que ya tiene foto; si ninguna
 * la tiene, la original.
 */
export function pairPurmacGenerics<P extends { id: string; photo_path?: string | null }>(
  products: P[],
  skuOf: (product: P) => string,
): { mains: P[]; pairs: Map<string, PurmacPair<P>> } {
  const purmacByCode = new Map<string, P>()
  const genericByCode = new Map<string, P>()
  for (const product of products) {
    const sku = skuOf(product).trim()
    const isPurmac = PM_PREFIX.test(sku)
    const code = (isPurmac ? sku.replace(PM_PREFIX, '') : sku).replace(PACK_SUFFIX, '').toUpperCase()
    if (!code) continue
    const bucket = isPurmac ? purmacByCode : genericByCode
    if (!bucket.has(code)) bucket.set(code, product)
  }
  const pairs = new Map<string, PurmacPair<P>>()
  const absorbed = new Set<string>()
  for (const [code, purmac] of purmacByCode) {
    const generic = genericByCode.get(code)
    if (!generic || generic.id === purmac.id) continue
    const main = purmac.photo_path && !generic.photo_path ? purmac : generic
    pairs.set(main.id, { generic, purmac })
    absorbed.add(main.id === generic.id ? purmac.id : generic.id)
  }
  return { mains: products.filter((product) => !absorbed.has(product.id)), pairs }
}
