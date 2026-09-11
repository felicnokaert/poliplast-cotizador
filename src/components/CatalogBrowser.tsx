import { useEffect, useMemo, useState } from 'react'
import { loadCatalog, type CatalogData } from '../lib/catalog'
import type { ProductWithVariants } from '../types/catalog'
import { ProductCard } from './ProductCard'

type PriceFilter = 'todos' | 'con_precio' | 'precio_pendiente'

export function CatalogBrowser() {
  const [data, setData] = useState<CatalogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [family, setFamily] = useState('todas')
  const [brand, setBrand] = useState('todas')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('todos')

  useEffect(() => {
    let cancelled = false
    loadCatalog()
      .then((result) => {
        if (!cancelled) setData(result)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Error al cargar el catálogo')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    if (!data) return []
    const term = search.trim().toLowerCase()

    return data.products
      .filter((p) => p.status === 'vigente')
      .filter((p) => (family === 'todas' ? true : p.family === family))
      .filter((p) => (brand === 'todas' ? true : p.brand === brand))
      .map((product) => filterVariantsByPrice(product, priceFilter))
      .filter((product): product is ProductWithVariants => product !== null)
      .filter((product) => {
        if (!term) return true
        const haystack = [
          product.name,
          product.family,
          product.subfamily,
          product.brand,
          ...product.variants.map((v) => `${v.sku} ${v.name}`),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(term)
      })
  }, [data, search, family, brand, priceFilter])

  if (loading) return <div className="centered-page">Cargando catálogo...</div>
  if (error) return <div className="centered-page error">Error: {error}</div>
  if (!data) return null

  return (
    <div className="catalog">
      <header className="catalog-header">
        <h1>Catálogo Grupo Poliplast</h1>
        <div className="filters">
          <input
            type="search"
            placeholder="Buscar por nombre, SKU, familia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={family} onChange={(e) => setFamily(e.target.value)}>
            <option value="todas">Todas las familias</option>
            {data.families.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select value={brand} onChange={(e) => setBrand(e.target.value)}>
            <option value="todas">Todas las marcas</option>
            {data.brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select value={priceFilter} onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}>
            <option value="todos">Precio: todos</option>
            <option value="con_precio">Con precio vigente</option>
            <option value="precio_pendiente">Precio pendiente</option>
          </select>
        </div>
        <p className="muted">
          {filtered.length} producto{filtered.length === 1 ? '' : 's'} · {data.products.length} en el catálogo total
        </p>
      </header>

      {data.products.length === 0 ? (
        <div className="empty-state">
          <p>Todavía no hay productos cargados en el catálogo compartido.</p>
          <p className="muted">
            Se completa mediante la importación del Catálogo Maestro (ver panel administrador, próxima entrega).
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No se encontraron productos con esos filtros.</p>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  )
}

function filterVariantsByPrice(product: ProductWithVariants, filter: PriceFilter): ProductWithVariants | null {
  if (filter === 'todos') return product
  const variants = product.variants.filter((v) => {
    const hasPrice = v.prices.some((p) => p.price_list.status === 'vigente')
    return filter === 'con_precio' ? hasPrice : !hasPrice
  })
  if (variants.length === 0) return null
  return { ...product, variants }
}
