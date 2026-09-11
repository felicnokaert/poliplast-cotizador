import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount)
}

function currentPrice(variant: VariantWithPricing) {
  return variant.prices.find((p) => p.price_list.status === 'vigente' && p.status === 'confirmado')
}

export function ProductCard({ product }: { product: ProductWithVariants }) {
  return (
    <article className="product-card">
      <header>
        <span className="brand-tag">{product.brand}</span>
        <h2>{product.name}</h2>
        <p className="muted">
          {product.family}
          {product.subfamily ? ` › ${product.subfamily}` : ''}
        </p>
      </header>
      <ul className="variant-list">
        {product.variants.map((variant) => {
          const price = currentPrice(variant)
          return (
            <li key={variant.id} className="variant-row">
              <div className="variant-main">
                <span className="variant-name">{variant.name}</span>
                <span className="variant-sku">{variant.sku}</span>
              </div>
              <div className="variant-meta">
                {price ? (
                  <span className="price">
                    {formatMoney(price.amount, price.price_list.currency)}
                    <span className="price-unit"> / {variant.unit}</span>
                  </span>
                ) : (
                  <span className="price pending">Precio pendiente</span>
                )}
                {variant.hasTechnicalDoc && <span className="doc-badge" title="Ficha técnica disponible">FT</span>}
              </div>
            </li>
          )
        })}
        {product.variants.length === 0 && <li className="muted">Sin variantes cargadas</li>}
      </ul>
    </article>
  )
}
