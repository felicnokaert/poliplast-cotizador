import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import { currentPrice } from '../lib/pricing'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount)
}

const BRAND_CLASS: Record<string, string> = {
  Resinplast: 'brand-resinplast',
  Penosil: 'brand-penosil',
  PURMAC: 'brand-purmac',
}

function PriceTag({ variant }: { variant: VariantWithPricing }) {
  const price = currentPrice(variant)
  return (
    <div className="variant-meta">
      {price ? (
        <span className="price">
          {formatMoney(price.amount, price.price_list.currency)}
          <span className="price-unit"> / {variant.unit}</span>
          <small className="price-list-name">{price.price_list.name}</small>
        </span>
      ) : (
        <span className="price pending">Precio pendiente</span>
      )}
      {variant.hasTechnicalDoc && (
        <span
          className="doc-badge tentative"
          title="Coincidencia por SKU o familia+nombre contra technical_documents, sin vínculo formal todavía — verificar antes de enviar al cliente"
        >
          Posible ficha
        </span>
      )}
    </div>
  )
}

export function ProductCard({
  product,
  onAdd,
}: {
  product: ProductWithVariants
  onAdd?: (variant: VariantWithPricing, product: ProductWithVariants) => void
}) {
  const brandClass = BRAND_CLASS[product.brand] ?? 'brand-grupo'
  // Los productos importados desde una planilla plana traen una sola variante
  // con el mismo nombre que el producto: mostrarla aparte sería redundante.
  const isSingleFlatVariant =
    product.variants.length === 1 && product.variants[0].name === product.name

  return (
    <article className={`product-card product-row-card ${brandClass}`}>
      <header className="product-identity">
        <span className="brand-tag">{product.brand}</span>
        <h2>{product.name}</h2>
        <p className="muted">
          {product.family}
          {product.subfamily ? ` › ${product.subfamily}` : ' › Sin subfamilia'}
        </p>
      </header>

      {isSingleFlatVariant ? (
        <div className="variant-row single">
          <span className="variant-sku">{product.variants[0].sku}</span>
          <PriceTag variant={product.variants[0]} />
          {onAdd && (
            <button className="add-button" onClick={() => onAdd(product.variants[0], product)}>
              Agregar
            </button>
          )}
        </div>
      ) : (
        <ul className="variant-list">
          {product.variants.map((variant) => (
            <li key={variant.id} className="variant-row">
              <div className="variant-main">
                <span className="variant-name">{variant.name}</span>
                <span className="variant-sku">{variant.sku}</span>
              </div>
              <PriceTag variant={variant} />
              {onAdd && (
                <button className="add-button" onClick={() => onAdd(variant, product)}>
                  Agregar
                </button>
              )}
            </li>
          ))}
          {product.variants.length === 0 && <li className="muted">Sin variantes cargadas</li>}
        </ul>
      )}
    </article>
  )
}
