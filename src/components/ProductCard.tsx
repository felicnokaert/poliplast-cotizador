import { useState } from 'react'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import { commercialPrices } from '../lib/pricing'
import { technicalDocumentUrl } from '../lib/catalog'
import { unitsPerPack } from '../lib/packs'
import { priceForQuantity } from '../lib/quote'

type OnAdd = (variant: VariantWithPricing, product: ProductWithVariants, quantity?: number) => void

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount)
}

function formatPlain(amount: number) {
  return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
}

/** Menor `min_quantity` con precio confirmado, para arrancar el selector de cantidad en el primer tramo real (ej. 0,1 en vez de 1). */
function firstTierQuantity(variant: VariantWithPricing): number {
  const tiers = variant.prices.filter((price) => price.status === 'confirmado').map((price) => price.min_quantity)
  return tiers.length > 0 ? Math.min(...tiers) : 1
}

function ResinplastRow({ product, variant, onAdd }: { product: ProductWithVariants; variant: VariantWithPricing; onAdd?: OnAdd }) {
  const prices = commercialPrices(variant)
  const [quantity, setQuantity] = useState(() => firstTierQuantity(variant))
  const tierPrice = priceForQuantity(variant, quantity, 'consumidor_final')
  const openDocument = async () => {
    const document = variant.technicalDocuments?.[0]; if (!document) return
    const popup = window.open('about:blank', '_blank')
    if (popup) popup.opener = null
    const url = await technicalDocumentUrl(document)
    if (url && popup) popup.location.href = url
    else popup?.close()
  }
  return (
    <div className="catalog-row resinplast-row">
      <div className="catalog-product" title={product.name}><i aria-hidden="true" /><span><strong>{product.name}</strong><small>{product.brand} · {product.family}{product.subfamily ? ` › ${product.subfamily}` : ''}</small>{variant.internal_note && <details className="note-toggle"><summary className="note-icon" aria-label="Ver consejo de uso">i</summary><p className="product-note">{variant.internal_note}</p></details>}{variant.hasTechnicalDoc && <button className="technical-link" onClick={openDocument}>Ficha técnica verificada</button>}</span></div>
      <span className="variant-sku">{variant.sku}{prices.wholesale && <small className="wholesale-hint">May. {prices.wholesale.price_list.currency} {formatPlain(prices.wholesale.amount)}</small>}</span>
      <span className="catalog-family" title={product.family}>{product.family}</span>
      <span className="catalog-subfamily" title={product.subfamily || 'Sin subfamilia'}>{product.subfamily || 'Sin subfamilia'}</span>
      <span className="catalog-price resinplast-price">
        {tierPrice ? <><strong>{formatMoney(tierPrice.amount, tierPrice.price_list.currency)}</strong><small>/{variant.unit} · IVA incluido</small></> : <em>Consultar</em>}
        <div className="quantity-stepper">
          <button type="button" aria-label="Restar" onClick={() => setQuantity((current) => Math.max(0.01, Number((current - 1).toFixed(2))))}>−</button>
          <input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(Math.max(0.01, Number(event.target.value) || 0.01))} />
          <button type="button" aria-label="Sumar" onClick={() => setQuantity((current) => Number((current + 1).toFixed(2)))}>+</button>
        </div>
      </span>
      {onAdd ? <button className="add-button" onClick={() => onAdd(variant, product, quantity)}>Agregar</button> : <span />}
    </div>
  )
}

function CatalogRow({ product, variant, onAdd }: { product: ProductWithVariants; variant: VariantWithPricing; onAdd?: OnAdd }) {
  if (product.brand === 'Resinplast') return <ResinplastRow product={product} variant={variant} onAdd={onAdd} />
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
      <div className="catalog-product" title={product.name}><i aria-hidden="true" /><span><strong>{product.name}</strong><small>{product.brand} · {product.family}{product.subfamily ? ` › ${product.subfamily}` : ''}</small>{variant.internal_note && <details className="note-toggle"><summary className="note-icon" aria-label="Ver consejo de uso">i</summary><p className="product-note">{variant.internal_note}</p></details>}{variant.hasTechnicalDoc && <button className="technical-link" onClick={openDocument}>Ficha técnica verificada</button>}</span></div>
      <span className="variant-sku">{variant.sku}<small className="pack-size">{pack > 1 ? `Caja x ${pack} — precio total de la caja` : 'Unidad'}</small><small className={variant.approvedStock ? 'stock-verified' : 'stock-unverified'}>{variant.approvedStock ? `Stock aprobado: ${new Intl.NumberFormat('es-AR').format(variant.approvedStock.quantity)} ${variant.approvedStock.unit}` : 'Stock sin verificar'}</small></span>
      <span className="catalog-family" title={product.family}>{product.family}</span>
      <span className="catalog-subfamily" title={product.subfamily || 'Sin subfamilia'}>{product.subfamily || 'Sin subfamilia'}</span>
      {priceCell(prices.consumer, 'Precio pendiente')}
      {priceCell(prices.wholesale, 'Mayorista pendiente')}
      {onAdd ? <button className="add-button" onClick={() => onAdd(variant, product)}>Agregar</button> : <span />}
    </div>
  )
}

export function ProductCard({ product, onAdd }: { product: ProductWithVariants; onAdd?: OnAdd }) {
  return <>{product.variants.map((variant) => <CatalogRow key={variant.id} product={product} variant={variant} onAdd={onAdd} />)}</>
}
