const COLOR_WORDS: Record<string, string> = {
  rojo: '#c62828', roja: '#c62828',
  azul: '#1565c0',
  verde: '#2e7d32',
  amarillo: '#f9a825', amarilla: '#f9a825',
  negro: '#212121', negra: '#212121',
  blanco: '#e0e0e0', blanca: '#e0e0e0',
  naranja: '#ef6c00',
  celeste: '#4fc3f7',
  gris: '#757575',
  rosa: '#ec407a',
  violeta: '#7b1fa2',
  lavanda: '#9575cd',
  marron: '#6d4c41', marrón: '#6d4c41',
  turquesa: '#00897b',
}

function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const ACCENT_VARIANTS: Record<string, string> = { a: 'aá', e: 'eé', i: 'ií', o: 'oó', u: 'uúü' }

/** Regex que matchea la palabra tanto acentuada como sin acentuar, para usar directo sobre el nombre original. */
function accentInsensitivePattern(word: string): string {
  return word.replace(/[aeiou]/g, (letter) => `[${ACCENT_VARIANTS[letter]}]`)
}

function findColorWord(name: string): string | null {
  const normalized = normalize(name)
  for (const word of Object.keys(COLOR_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(normalized)) return word
  }
  return null
}

/** Nombre del producto sin la palabra de color (para mostrar en la ficha combinada). */
export function stripColorWord(name: string): string {
  const word = findColorWord(name)
  if (!word) return name
  return name.replace(new RegExp(`\\b${accentInsensitivePattern(word)}\\b`, 'i'), '').replace(/\s{2,}/g, ' ').trim()
}

function colorlessKey(name: string): string {
  const word = findColorWord(name)
  const normalized = normalize(name)
  return (word ? normalized.replace(new RegExp(`\\b${word}\\b`, 'g'), '') : normalized).replace(/\s+/g, ' ').trim()
}

export interface ColorVariantGroup<P> {
  representative: P
  colorOptions: Array<{ color: string; hex: string; product: P }>
}

/**
 * Agrupa productos que son el mismo artículo en distintos colores (mismo
 * nombre sin el color, mismo precio) en una sola ficha con un color por
 * variante. Los productos sin color detectado, o cuyo precio difiere,
 * quedan cada uno en su propia ficha — nunca se fusionan a ciegas.
 */
export function groupByColorVariant<P>(products: P[], nameOf: (product: P) => string, priceKeyOf: (product: P) => string): ColorVariantGroup<P>[] {
  const buckets = new Map<string, P[]>()
  const order: string[] = []
  let soloCounter = 0
  for (const product of products) {
    const word = findColorWord(nameOf(product))
    const key = word ? `${colorlessKey(nameOf(product))}__${priceKeyOf(product)}` : `__solo__${soloCounter++}`
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key) }
    buckets.get(key)!.push(product)
  }
  return order.map((key) => {
    const list = buckets.get(key)!
    if (list.length < 2) return { representative: list[0], colorOptions: [] }
    const colorOptions = list.map((product) => {
      const word = findColorWord(nameOf(product))!
      return { color: word, hex: COLOR_WORDS[word], product }
    })
    return { representative: list[0], colorOptions }
  })
}
