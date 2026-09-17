import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import { commercialPrices } from '../lib/pricing'
import { technicalDocumentUrl } from '../lib/catalog'
import { unitsPerPack } from '../lib/packs'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount)
}

function CatalogRow({ product, variant, onAdd }: { product: ProductWithVariants; variant: VariantWithPricing; onAdd?: (variant: VariantWithPricing, product: ProductWithVariants) => void }) {
  const prices = commercialPrices(variant)
  const pack = unitsPerPack(variant)
  const priceCell = (price: typeof prices.consumer, pending: string) => <span className="catalog-price">{price ? <><strong>{formatMoney(price.amount, price.price_list.currency)}</strong><small>IVA incluido</small></> : <em>{pending}</em>}</span>
  const openDocument = async () => {
    const document = variant.technicalDocuments?.[0]; if (!document) return
    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null
    const url = await technicalDocumentUrl(document)
    if (url && popup) popup.location.href = url
    else popup?.close()
  }
  return (
    <div className="catalog-row">
      <div className="catalog-product" title={product.name}><i aria-hidden="true" /><span><strong>{product.name}</strong><small>{product.brand} · {product.family}{product.subfamily ? ` › ${product.subfamily}` : ''}</small>{variant.hasTechnicalDoc && <button className="technical-link" onClick={openDocument}>Ficha técnica verificada</button>}</span></div>
      <span className="variant-sku">{variant.sku}<small className="pack-size">{pack > 1 ? `Caja x ${pack} — precio total de la caja` : 'Unidad'}</small><small className={variant.approvedStock ? 'stock-verified' : 'stock-unverified'}>{variant.approvedStock ? `Stock aprobado: ${new Intl.NumberFormat('es-AR').format(variant.approvedStock.quantity)} ${variant.approvedStock.unit}` : 'Stock sin verificar'}</small></span>
      <span className="catalog-family" title={product.family}>{product.family}</span>
      <span className="catalog-subfamily" title={product.subfamily || 'Sin subfamilia'}>{product.subfamily || 'Sin subfamilia'}</span>
      {priceCell(prices.consumer, 'Precio pendiente')}
      {priceCell(prices.wholesale, 'Mayorista pendiente')}
      {onAdd ? <button className="add-button" onClick={() => onAdd(variant, product)}>Agregar</button> : <span />}
    </div>
  )
}

export function ProductCard({ product, onAdd }: { product: ProductWithVariants; onAdd?: (variant: VariantWithPricing, product: ProductWithVariants) => void }) {
  return <>{product.variants.map((variant) => <CatalogRow key={variant.id} product={product} variant={variant} onAdd={onAdd} />)}</>
}
