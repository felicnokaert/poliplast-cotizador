import { useEffect, useMemo, useState } from 'react'
import { loadCatalog, type CatalogData } from '../lib/catalog'
import { filterCatalog, paginateCatalog, type PriceFilter } from '../lib/filters'
import { ProductCard } from './ProductCard'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import { commercialPrices } from '../lib/pricing'
import { withoutKits } from '../lib/catalogVisibility'
import { productPhotoUrl } from '../lib/productPhotos'
import { groupByColorVariant, stripColorWord } from '../lib/colorVariants'
import { unitsPerPack } from '../lib/packs'

const BRAND_LOGOS: Record<string, string> = {
  penosil: '/brands/penosil.png',
  purmac: '/brands/purmac.png',
  resinplast: '/brands/resinplast.jpg',
}

/** Muestra el SKU "base" del producto, sin el sufijo de cantidad por caja (-1, -12, -6...). */
function baseSkuLabel(sku: string): string {
  return sku.replace(/-\d+$/, '')
}

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
  const [printLayout, setPrintLayout] = useState<'lista' | 'fotos'>('lista')
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
    return filterCatalog(withoutKits(data.products), { search, family, subfamily, brand, priceFilter })
  }, [data, search, family, subfamily, brand, priceFilter, minimumSearchLength])
  const subfamilies = useMemo(() => {
    if (!data) return []
    return [...new Set(data.products.filter((p) => family === 'todas' || p.family === family).map((p) => p.subfamily).filter(Boolean))].sort()
  }, [data, family])
  const visibleProducts = useMemo(() => printKind === 'wholesale'
    ? filtered.flatMap((product) => {
        const variants = product.variants.filter((variant) => Boolean(commercialPrices(variant).wholesale))
        return variants.length ? [{ ...product, variants }] : []
      })
    : filtered, [filtered, printKind])
  const paginated = useMemo(() => paginateCatalog(visibleProducts, page, pageSize), [visibleProducts, page])
  const printBrands = [...new Set(visibleProducts.map((product) => product.brand))]
  const printBrand = printBrands.length === 1 ? printBrands[0] : 'Grupo Poliplast'
  const printBrandLogo = BRAND_LOGOS[printBrand.toLowerCase()]
  const printThemeClass = `print-theme-${printBrand.toLowerCase().replace(/\W/g, '')}`
  const printVariants = visibleProducts.flatMap((product) => product.variants.map((variant) => ({ product, variant }))).filter(({ variant }) => Boolean(commercialPrices(variant)[printKind]))
  const photoGroups = useMemo(() => {
    const bySubfamily = new Map<string, { family: string; subfamily: string; products: typeof visibleProducts }>()
    for (const product of visibleProducts) {
      if (!product.variants.some((variant) => Boolean(commercialPrices(variant)[printKind]))) continue
      const key = `${product.family}::${product.subfamily || 'Sin subfamilia'}`
      const existing = bySubfamily.get(key)
      if (existing) existing.products.push(product)
      else bySubfamily.set(key, { family: product.family, subfamily: product.subfamily || 'Sin subfamilia', products: [product] })
    }
    return [...bySubfamily.values()].sort((a, b) => a.family.localeCompare(b.family, 'es-AR') || a.subfamily.localeCompare(b.subfamily, 'es-AR'))
  }, [visibleProducts, printKind])
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
          : `${visibleProducts.length} producto${visibleProducts.length === 1 ? '' : 's'} · ${data.products.length} en el catálogo total`}</p>
        {allowPriceListPrint && <div className="price-list-actions no-print"><select aria-label="Lista para imprimir" value={printKind} onChange={(event) => { setPrintKind(event.target.value as 'consumer' | 'wholesale'); setPage(1) }}><option value="consumer">Lista minorista</option><option value="wholesale">Lista mayorista</option></select><select aria-label="Formato de la lista" value={printLayout} onChange={(event) => setPrintLayout(event.target.value as 'lista' | 'fotos')}><option value="lista">Formato tabla</option><option value="fotos">Formato catálogo con fotos</option></select><button onClick={() => window.print()}>Imprimir / guardar PDF</button></div>}
      </header>

      {allowPriceListPrint && printLayout === 'lista' && <section className={`print-price-list ${printThemeClass}`}><header><div className="print-logos"><img className="print-main-logo" src="/poliplast-logo.png" alt="Grupo Poliplast" />{printBrandLogo ? <img className="print-brand-logo" src={printBrandLogo} alt={printBrand} /> : printBrand !== 'Grupo Poliplast' && <strong className={`print-family-brand brand-${printBrand.toLowerCase().replace(/\W/g, '')}`}>{printBrand}</strong>}</div><div><h1>Lista de precios {printKind === 'consumer' ? 'minorista' : 'mayorista'}</h1><p>{family === 'todas' ? 'Todas las familias' : family} · Valores finales en USD · TC oficial billete BNA</p></div></header>{printVariants.length === 0 ? <p className="print-empty">No hay productos con variantes para esta selección.</p> : <table><thead><tr><th>SKU</th><th>Producto</th><th>Presentación</th><th>Precio USD (por unidad)</th></tr></thead><tbody>{printVariants.map(({ product, variant }) => { const price = commercialPrices(variant)[printKind]; const pack = unitsPerPack(variant); const totalAmount = price ? price.amount / (price.price_list.currency === 'ARS' && exchangeRate > 0 ? exchangeRate : 1) : null; const unitAmount = totalAmount == null ? null : totalAmount / pack; return <tr key={variant.id}><td>{variant.sku}</td><td>{product.name}</td><td>{pack > 1 ? `Caja x ${pack}` : 'Unidad'}</td><td>{unitAmount == null ? 'Consultar' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(unitAmount)}</td></tr> })}</tbody></table>}</section>}

      {allowPriceListPrint && printLayout === 'fotos' && (
        <section className={`print-photo-catalog ${printThemeClass}`}>
          <header><div className="print-logos"><img className="print-main-logo" src="/poliplast-logo.png" alt="Grupo Poliplast" />{printBrandLogo ? <img className="print-brand-logo" src={printBrandLogo} alt={printBrand} /> : printBrand !== 'Grupo Poliplast' && <strong className={`print-family-brand brand-${printBrand.toLowerCase().replace(/\W/g, '')}`}>{printBrand}</strong>}</div><div><h1>Catálogo {printKind === 'consumer' ? 'minorista' : 'mayorista'}</h1><p>{family === 'todas' ? 'Todas las familias' : family} · Valores finales en USD · TC oficial billete BNA</p></div></header>
          {photoGroups.length === 0 ? <p className="print-empty">No hay productos con variantes para esta selección.</p> : photoGroups.map((group) => {
            const pricedVariantsOf = (product: ProductWithVariants) => product.variants.filter((variant) => Boolean(commercialPrices(variant)[printKind]))
            const shownVariantOf = (product: ProductWithVariants) => {
              const priced = pricedVariantsOf(product)
              return priced.find((variant) => unitsPerPack(variant) === 1) ?? priced[0] ?? product.variants[0]
            }
            const amountOf = (product: ProductWithVariants) => {
              const variant = shownVariantOf(product)
              const price = commercialPrices(variant)[printKind]
              const total = price ? price.amount / (price.price_list.currency === 'ARS' && exchangeRate > 0 ? exchangeRate : 1) : null
              return total == null ? null : total / unitsPerPack(variant)
            }
            // Precio "crudo" de una variante puntual, sin dividir por pack: para
            // desglosar variantes por peso/medida (no son N copias de una unidad).
            const rawAmountOf = (variant: VariantWithPricing) => {
              const price = commercialPrices(variant)[printKind]
              return price ? price.amount / (price.price_list.currency === 'ARS' && exchangeRate > 0 ? exchangeRate : 1) : null
            }
            const money = (amount: number | null) => amount == null ? 'Consultar' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'USD' }).format(amount)
            const commonSkuPrefix = (skus: string[]): string => {
              if (skus.length === 0) return ''
              let prefix = skus[0]
              for (const sku of skus.slice(1)) {
                let end = 0
                while (end < prefix.length && end < sku.length && prefix[end] === sku[end]) end += 1
                prefix = prefix.slice(0, end)
              }
              return prefix.replace(/-+$/, '')
            }
            const colorGroups = groupByColorVariant(group.products, (product) => product.name, (product) => amountOf(product)?.toFixed(2) ?? 'sin-precio')
            return (
            <div key={`${group.family}-${group.subfamily}`} className="print-photo-section">
              <h2>{group.family} · {group.subfamily}</h2>
              <div className="print-photo-grid">
                {colorGroups.map(({ representative: product, colorOptions }) => {
                  const shownVariant = shownVariantOf(product)
                  const amount = amountOf(product)
                  const photoUrl = productPhotoUrl(product.photo_path)
                  const priced = pricedVariantsOf(product)
                  const isColorMerge = colorOptions.length > 1
                  const hasSizeBreakdown = !isColorMerge && priced.length > 1
                  const displaySku = hasSizeBreakdown ? (commonSkuPrefix(priced.map((v) => v.sku)) || baseSkuLabel(shownVariant.sku)) : baseSkuLabel(shownVariant.sku)
                  return (
                    <article key={product.id} className="print-photo-card">
                      {photoUrl ? <img src={photoUrl} alt={product.name} /> : <div className="print-photo-placeholder">Sin foto</div>}
                      <strong>{isColorMerge ? stripColorWord(product.name) : product.name}</strong>
                      <span>{displaySku}</span>
                      {!isColorMerge && !hasSizeBreakdown && <em>{amount == null ? 'Consultar' : `${money(amount)} / unidad`}</em>}
                      {isColorMerge && (
                        <ul className="print-photo-variant-list">
                          {colorOptions.map((option) => <li key={option.color}><span>{option.color}</span><b>{money(amount)}</b></li>)}
                        </ul>
                      )}
                      {hasSizeBreakdown && (
                        <ul className="print-photo-variant-list">
                          {[...priced].sort((a, b) => (rawAmountOf(a) ?? 0) - (rawAmountOf(b) ?? 0)).map((variant) => <li key={variant.id}><span>{variant.sku}</span><b>{money(rawAmountOf(variant))}</b></li>)}
                        </ul>
                      )}
                    </article>
                  )
                })}
              </div>
            </div>
            )
          })}
        </section>
      )}

      {data.products.length === 0 ? (
        <div className="empty-state">
          <p>Todavía no hay productos cargados en el catálogo compartido.</p>
          <p className="muted">
            Se completa mediante la importación del Catálogo Maestro (ver panel administrador, próxima entrega).
          </p>
        </div>
      ) : search.trim().length < minimumSearchLength ? (
        <div className="catalog-search-prompt"><strong>Buscá el producto que querés cotizar</strong><span>Ingresá nombre, SKU, familia, subfamilia o marca.</span></div>
      ) : visibleProducts.length === 0 ? (
        <div className="empty-state">
          <p>{printKind === 'wholesale' ? 'No hay productos con precio mayorista para estos filtros.' : 'No se encontraron productos con esos filtros.'}</p>
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
