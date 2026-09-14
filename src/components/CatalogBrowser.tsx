import { useEffect, useMemo, useState } from 'react'
import { loadCatalog, type CatalogData } from '../lib/catalog'
import { filterCatalog, paginateCatalog, type PriceFilter } from '../lib/filters'
import { ProductCard } from './ProductCard'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import { commercialPrices } from '../lib/pricing'

export function CatalogBrowser({
  onAdd,
  title = 'Catálogo Grupo Poliplast',
  minimumSearchLength = 0,
  exchangeRate = 0,
  allowPriceListPrint = false,
}: {
  onAdd?: (variant: VariantWithPricing, product: ProductWithVariants) => void
  title?: string
  minimumSearchLength?: number
  exchangeRate?: number
  allowPriceListPrint?: boolean
}) {
  const [data, setData] = useState<CatalogData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [family, setFamily] = useState('todas')
  const [subfamily, setSubfamily] = useState('todas')
  const [brand, setBrand] = useState('todas')
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('todos')
  const [page, setPage] = useState(1)
  const [printKind, setPrintKind] = useState<'consumer' | 'wholesale'>('consumer')
  const pageSize = 100

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
    if (search.trim().length < minimumSearchLength) return []
    return filterCatalog(data.products, { search, family, subfamily, brand, priceFilter })
  }, [data, search, family, subfamily, brand, priceFilter, minimumSearchLength])
  const subfamilies = useMemo(() => {
    if (!data) return []
    return [...new Set(data.products.filter((p) => family === 'todas' || p.family === family).map((p) => p.subfamily).filter(Boolean))].sort()
  }, [data, family])
  const paginated = useMemo(() => paginateCatalog(filtered, page, pageSize), [filtered, page])
  const printBrands = [...new Set(filtered.map((product) => product.brand))]
  const printBrand = printBrands.length === 1 ? printBrands[0] : 'Grupo Poliplast'
  const printVariants = filtered.flatMap((product) => product.variants.map((variant) => ({ product, variant })))
  const hasFilters = Boolean(search) || family !== 'todas' || subfamily !== 'todas' || brand !== 'todas' || priceFilter !== 'todos'
  const clearFilters = () => { setSearch(''); setFamily('todas'); setSubfamily('todas'); setBrand('todas'); setPriceFilter('todos'); setPage(1) }

  if (loading) return <div className="centered-page">Cargando catálogo...</div>
  if (error) return <div className="centered-page error">Error: {error}</div>
  if (!data) return null

  return (
    <div className="catalog">
      <header className="catalog-header">
        <h1>{title}</h1>
        <div className="filters">
          <input
            type="search"
            aria-label="Buscar productos"
            placeholder="Buscar por nombre, SKU, familia..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          />
          <select aria-label="Filtrar por familia" value={family} onChange={(e) => { setFamily(e.target.value); setSubfamily('todas'); setPage(1) }}>
            <option value="todas">Todas las familias</option>
            {data.families.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select aria-label="Filtrar por subfamilia" value={subfamily} onChange={(e) => { setSubfamily(e.target.value); setPage(1) }}>
            <option value="todas">Todas las subfamilias</option>
            {subfamilies.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select aria-label="Filtrar por marca" value={brand} onChange={(e) => { setBrand(e.target.value); setPage(1) }}>
            <option value="todas">Todas las marcas</option>
            {data.brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <select aria-label="Filtrar por disponibilidad de precio" value={priceFilter} onChange={(e) => { setPriceFilter(e.target.value as PriceFilter); setPage(1) }}>
            <option value="todos">Precio: todos</option>
            <option value="con_precio">Con precio vigente</option>
            <option value="precio_pendiente">Precio pendiente</option>
          </select>
          {hasFilters && <button className="clear-filters" onClick={clearFilters}>Limpiar filtros</button>}
        </div>
        <p className="muted" aria-live="polite">{search.trim().length < minimumSearchLength
          ? `Escribí al menos ${minimumSearchLength} caracteres del nombre o SKU para buscar.`
          : `${filtered.length} producto${filtered.length === 1 ? '' : 's'} · ${data.products.length} en el catálogo total`}</p>
        {allowPriceListPrint && <div className="price-list-actions no-print"><span>Lista de precios</span><select aria-label="Lista para imprimir" value={printKind} onChange={(event) => setPrintKind(event.target.value as 'consumer' | 'wholesale')}><option value="consumer">Minorista</option><option value="wholesale">Mayorista</option></select><button onClick={() => window.print()}>Imprimir / guardar PDF</button></div>}
      </header>

      {allowPriceListPrint && <section className="print-price-list"><header><div className="print-logos"><img src="/poliplast-logo.png" alt="Grupo Poliplast" />{printBrand !== 'Grupo Poliplast' && <strong className={`print-family-brand brand-${printBrand.toLowerCase().replace(/\W/g, '')}`}>{printBrand}</strong>}</div><div><h1>Lista de precios {printKind === 'consumer' ? 'minorista' : 'mayorista'}</h1><p>{family === 'todas' ? 'Todas las familias' : family} · Valores finales en USD · TC de referencia {exchangeRate || '—'}</p></div></header>{printVariants.length === 0 ? <p className="print-empty">No hay productos con variantes para esta selección.</p> : <table><thead><tr><th>SKU</th><th>Producto</th><th>Precio USD</th></tr></thead><tbody>{printVariants.map(({ product, variant }) => { const price = commercialPrices(variant)[printKind]; const amount = price ? price.amount / (price.price_list.currency === 'ARS' && exchangeRate > 0 ? exchangeRate : 1) : null; return <tr key={variant.id}><td>{variant.sku}</td><td>{product.name}</td><td>{amount == null ? 'Consultar' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(amount)}</td></tr> })}</tbody></table>}</section>}

      {data.products.length === 0 ? (
        <div className="empty-state">
          <p>Todavía no hay productos cargados en el catálogo compartido.</p>
          <p className="muted">
            Se completa mediante la importación del Catálogo Maestro (ver panel administrador, próxima entrega).
          </p>
        </div>
      ) : search.trim().length < minimumSearchLength ? (
        <div className="catalog-search-prompt"><strong>Buscá el producto que querés cotizar</strong><span>Ingresá nombre, SKU, familia, subfamilia o marca.</span></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No se encontraron productos con esos filtros.</p>
        </div>
      ) : (
        <div className="product-list">
          <div className="catalog-table-head">
            <span>Producto</span><span>SKU</span><span>Familia</span><span>Subfamilia</span><span>Consumidor final</span><span>Mayorista</span><span />
          </div>
          {paginated.items.map((product) => (
            <ProductCard key={product.id} product={product} onAdd={onAdd} />
          ))}
          {paginated.pageCount > 1 && <nav className="catalog-pagination" aria-label="Páginas del catálogo"><span>{(paginated.page - 1) * pageSize + 1}–{Math.min(paginated.page * pageSize, paginated.total)} de {paginated.total}</span><button disabled={paginated.page === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><strong>{paginated.page} / {paginated.pageCount}</strong><button disabled={paginated.page === paginated.pageCount} onClick={() => setPage((value) => value + 1)}>Siguiente</button></nav>}
        </div>
      )}
    </div>
  )
}
