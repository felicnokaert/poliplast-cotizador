import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import { currentPrice } from '../lib/pricing'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount)
}

function CatalogRow({ product, variant, onAdd }: { product: ProductWithVariants; variant: VariantWithPricing; onAdd?: (variant: VariantWithPricing, product: ProductWithVariants) => void }) {
  const price = currentPrice(variant)
  return (
    <div className="catalog-row">
      <div className="catalog-product" title={product.name}><i aria-hidden="true" /><span><strong>{product.name}</strong><small>{product.brand}</small></span></div>
      <span className="variant-sku">{variant.sku}</span>
      <span className="catalog-family" title={product.family}>{product.family}</span>
      <span className="catalog-subfamily" title={product.subfamily || 'Sin subfamilia'}>{product.subfamily || 'Sin subfamilia'}</span>
      <span className="catalog-price">{price ? <><strong>{formatMoney(price.amount, price.price_list.currency)}</strong><small>IVA incluido · {price.price_list.name}</small></> : <em>Precio pendiente</em>}</span>
      {onAdd ? <button className="add-button" onClick={() => onAdd(variant, product)}>Agregar</button> : <span />}
    </div>
  )
}

export function ProductCard({ product, onAdd }: { product: ProductWithVariants; onAdd?: (variant: VariantWithPricing, product: ProductWithVariants) => void }) {
  return <>{product.variants.map((variant) => <CatalogRow key={variant.id} product={product} variant={variant} onAdd={onAdd} />)}</>
}
