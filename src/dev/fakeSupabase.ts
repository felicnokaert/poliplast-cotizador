// SOLO para ver el diseño en una compu sin usuario: `npm run maqueta` reemplaza src/lib/supabase.ts
// por esto (ver vite.config.ts). Datos de ejemplo, nada se guarda. Nunca entra al build de producción.
/* eslint-disable @typescript-eslint/no-explicit-any */
const list = { id: 'pl1', name: 'Lista USD octubre', brand: 'Grupo Poliplast', currency: 'USD', vat_rate: 0.21, valid_from: '2026-10-01', valid_until: null, status: 'vigente' }
const productos = [
  ['p1', 'Poliol isoBUNKER 618 SP', 'Poliuretano', 'Rígido', 'Grupo Poliplast', [['v1', '618-SP-200', 'Tambor 200 kg', 'kg', 5.5], ['v2', '618-SP-20', 'Bidón 20 kg', 'kg', 6.1]]],
  ['p2', 'Isocianato MDI', 'Poliuretano', 'Isocianatos', 'Grupo Poliplast', [['v3', 'MDI-250', 'Tambor 250 kg', 'kg', 3.9]]],
  ['p3', 'Poliurea aromática PU-500', 'Poliurea', 'Aromática', 'Grupo Poliplast', [['v4', 'PU500-K', 'Kit 400 kg', 'kit', 2350]]],
  ['p4', 'Membrana Imperpur 2C', 'Impermeabilizantes', 'Membranas', 'Imperpur', [['v5', 'IMP2C-20', 'Kit 20 kg', 'kit', 182]]],
  ['p5', 'Resina poliéster Resinplast', 'Resinas', 'Poliéster', 'Resinplast', [['v6', 'RES-220', 'Tambor 220 kg', 'kg', 4.2]]],
  ['p6', 'Selladora PURMAC P-30', 'Máquinas', 'Proyectoras', 'PURMAC', [['v7', 'P30', 'Equipo', 'unidad', 14800]]],
] as const
const tablas: Record<string, any[]> = {
  catalog_products: productos.map(([id, name, family, subfamily, brand]) => ({ id, canonical_key: id, name, brand, family, subfamily, status: 'vigente', source: 'maqueta', source_updated_at: null })),
  catalog_variants: productos.flatMap(([id, , , , , variantes]) => variantes.map(([vid, sku, name, unit]) => ({ id: vid, product_id: id, sku, name, unit, attributes: {}, active: true }))),
  price_lists: [list],
  variant_prices: productos.flatMap(([, , , , , variantes]) => variantes.map(([vid, , , , amount]) => ({ id: 'pr-' + vid, price_list_id: 'pl1', variant_id: vid, min_quantity: 1, max_quantity: null, amount, status: 'confirmado' }))),
  workspace_states: [{ data: { clients: [
    { id: 'c1', company: 'Aislaciones del Sur SRL', contact: 'Ana Pérez', phone: '5492235551234', email: 'ana@aislsur.com' },
    { id: 'c2', company: 'Techos Rosario', contact: 'Martín Gómez', phone: '5493415559876' },
    { id: 'c3', company: 'Frío Patagónico SA', contact: 'Laura Díaz', phone: '5492995554321' },
  ] }, updated_at: '2026-10-16T12:00:00Z' }],
  shared_companies: [],
  sales_quotes: [],
}
function cotizacion(numero: string, cliente: string, estado: string, fecha: string, renglones: [string, number][]) {
  return {
    quote_number: numero, client_name: cliente, status: estado, issued_at: fecha, updated_at: fecha, price_mode: 'automatico', valid_days: 7, exchange_rate: 1450, payment_method: 'transferencia',
    sales_quote_items: renglones.map(([vid, quantity], index) => {
      const product = tablas.catalog_products.find((p) => tablas.catalog_variants.find((v) => v.id === vid)?.product_id === p.id)
      const variant = tablas.catalog_variants.find((v) => v.id === vid)
      const price = tablas.variant_prices.find((p) => p.variant_id === vid)
      return { active: true, line_snapshot: { id: `${numero}-${index}`, productId: product.id, productName: product.name, brand: product.brand, family: product.family, quantity, variant: { ...variant, prices: [{ ...price, price_list: list }], hasTechnicalDoc: false } } }
    }),
  }
}
tablas.sales_quotes = [
  cotizacion('0012', 'Aislaciones del Sur SRL', 'enviada', '2026-10-15T15:20:00Z', [['v1', 400], ['v3', 250]]),
  cotizacion('0011', 'Techos Rosario', 'borrador', '2026-10-14T11:00:00Z', [['v4', 2]]),
  cotizacion('0010', 'Frío Patagónico SA', 'aceptada', '2026-10-09T09:30:00Z', [['v5', 30], ['v6', 220]]),
  cotizacion('0009', 'Aislaciones del Sur SRL', 'enviada', '2026-09-28T16:00:00Z', [['v7', 1]]),
]
// Maqueta sin cotizaciones (para ver cómo se ve vacío): ?vacio=1
if (new URLSearchParams(window.location.search).has('vacio')) tablas.sales_quotes = []

function builder(table: string) {
  let single = false
  let range: [number, number] | null = null
  const b: any = {
    select: () => b, eq: () => b, neq: () => b, in: () => b, order: () => b, limit: () => b, gte: () => b, lte: () => b, is: () => b, ilike: () => b, or: () => b,
    upsert: () => b, insert: () => b, update: () => b, delete: () => b,
    range: (from: number, to: number) => { range = [from, to]; return b },
    maybeSingle: () => { single = true; return b }, single: () => { single = true; return b },
    then: (resolve: any, reject: any) => {
      const rows = tablas[table] ?? []
      const data = single ? rows[0] ?? null : range ? rows.slice(range[0], range[1] + 1) : rows
      return Promise.resolve({ data, error: null, count: rows.length }).then(resolve, reject)
    },
  }
  return b
}

const session = { user: { id: 'maqueta', email: 'felipe@grupopoliplast.com.ar' }, access_token: 'maqueta' }
export const supabase: any = {
  from: builder,
  rpc: async () => ({ data: null, error: { message: 'maqueta' } }),
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({}),
    signInWithPassword: async () => ({ error: null }),
    setSession: async () => ({ data: { session }, error: null }),
  },
  storage: { from: () => ({ createSignedUrl: async () => ({ data: { signedUrl: '' }, error: null }), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) },
}
