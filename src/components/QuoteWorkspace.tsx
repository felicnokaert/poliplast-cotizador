import { useEffect, useMemo, useState } from 'react'
import { CatalogBrowser } from './CatalogBrowser'
import {
  addQuoteLine,
  createQuoteNumber,
  resolvedLinePrice,
  quoteExpiry,
  quoteTotals,
  serializeQuoteForWhatsApp,
  type PaymentMethod,
  type PriceMode,
  type QuoteLine,
  type QuoteMeta,
  type SavedQuote,
} from '../lib/quote'
import type { ProductWithVariants, VariantWithPricing } from '../types/catalog'
import type { CommercialRule } from '../types/commercialRules'
import { AdminPanel } from './AdminPanel'
import { fetchOfficialDollar } from '../lib/exchange'
import { loadCommercialClients, type CommercialClient } from '../lib/clients'
import { loadCommercialRules } from '../lib/commercialRules'

const STORAGE_KEY = 'poliplast-cotizador-quotes-v1'

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount)
}

function loadSavedQuotes(): SavedQuote[] {
  try {
    const quotes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as SavedQuote[]
    return quotes.map((quote) => ({ ...quote, meta: { ...quote.meta, priceMode: quote.meta.priceMode || 'automatico' } }))
  } catch { return [] }
}

function newMeta(): QuoteMeta {
  const now = new Date()
  return {
    number: createQuoteNumber(now), client: '', contact: '', phone: '', email: '', notes: '',
    paymentMethod: 'transferencia', priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0,
    exchangeRate: 1, outputCurrency: 'USD', status: 'borrador', createdAt: now.toISOString(),
  }
}

function BrandMark({ brand }: { brand: string }) {
  return <div className={`brand-mark brand-mark-${brand.toLowerCase().replace(/\W/g, '')}`}><span>grupo</span><strong>{brand === 'Grupo Poliplast' ? 'poliplast' : brand}</strong></div>
}

function QuotePreview({ quote, rules, onClose }: { quote: SavedQuote; rules: CommercialRule[]; onClose: () => void }) {
  const totals = quoteTotals(quote.lines, quote.meta.discountPercent, quote.meta.surchargePercent, quote.meta.exchangeRate, quote.meta.outputCurrency, quote.meta.priceMode, rules)
  const brands = [...new Set(quote.lines.map((line) => line.brand))]
  const principalBrand = brands.length === 1 ? brands[0] : 'Grupo Poliplast'
  const conversion = quote.meta.outputCurrency === 'ARS' ? quote.meta.exchangeRate : 1
  const expires = quoteExpiry(quote.meta.createdAt, quote.meta.validDays)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Vista previa de cotización">
      <section className={`quote-preview preview-${principalBrand.toLowerCase().replace(/\W/g, '')}`}>
        <div className="preview-actions no-print">
          <button onClick={onClose}>Volver</button>
          <button onClick={() => navigator.clipboard.writeText(serializeQuoteForWhatsApp(quote, rules))}>Copiar texto</button>
          <button className="primary-action inline" onClick={() => window.print()}>Imprimir / Guardar PDF</button>
        </div>
        <header className="preview-header">
          <BrandMark brand={principalBrand} />
          {principalBrand !== 'Grupo Poliplast' && <BrandMark brand="Grupo Poliplast" />}
          <div className="preview-number"><span>Cotización</span><strong>{quote.meta.number}</strong><small>{new Date(quote.meta.createdAt).toLocaleDateString('es-AR')}</small></div>
        </header>
        <div className="preview-client">
          <div><span>Cliente</span><strong>{quote.meta.client || 'Consumidor final'}</strong></div>
          {quote.meta.contact && <div><span>Contacto</span><strong>{quote.meta.contact}</strong></div>}
          {quote.meta.phone && <div><span>WhatsApp</span><strong>{quote.meta.phone}</strong></div>}
          {quote.meta.email && <div><span>Email</span><strong>{quote.meta.email}</strong></div>}
        </div>
        <table className="preview-table">
          <thead><tr><th>Producto</th><th>SKU</th><th>Cantidad</th><th>Unitario</th><th>Total</th></tr></thead>
          <tbody>{quote.lines.map((line) => {
            const price = resolvedLinePrice(line, totals.appliedPriceMode, rules)
            return <tr key={line.id}><td><strong>{line.productName}</strong><small>{line.family}</small>{price?.specialRule && <small className="rule-note">{price.listName}</small>}</td><td>{line.variant.sku}</td><td>{line.quantity} {line.variant.unit}</td><td>{price ? money(price.amount * conversion, quote.meta.outputCurrency) : 'A confirmar'}</td><td>{price ? money(price.amount * line.quantity * conversion, quote.meta.outputCurrency) : 'A confirmar'}</td></tr>
          })}</tbody>
        </table>
        <div className="preview-summary">
          <div><span>Subtotal</span><strong>{money(totals.subtotal * conversion, quote.meta.outputCurrency)}</strong></div>
          {totals.discount > 0 && <div><span>Descuento ({quote.meta.discountPercent}%)</span><strong>− {money(totals.discount * conversion, quote.meta.outputCurrency)}</strong></div>}
          {totals.surcharge > 0 && <div><span>Financiación/recargo ({quote.meta.surchargePercent}%)</span><strong>{money(totals.surcharge * conversion, quote.meta.outputCurrency)}</strong></div>}
          <div><span>IVA incluido</span><strong>{money(totals.vat * conversion, quote.meta.outputCurrency)}</strong></div>
          <div className="preview-grand"><span>Total</span><strong>{money(totals.convertedTotal, quote.meta.outputCurrency)}</strong></div>
        </div>
        <footer className="preview-footer">
          <p><strong>Condición:</strong> {quote.meta.paymentMethod.replace('_', ' ')} · <strong>Validez:</strong> hasta {expires.toLocaleDateString('es-AR')}</p>
          <p>Todos los precios indicados incluyen IVA.</p>
          {quote.meta.outputCurrency === 'USD' && <p>Esta cotización está expresada en dólares estadounidenses. Si se cancela en pesos argentinos, el importe se calculará al tipo de cambio vendedor para dólar billete del Banco de la Nación Argentina correspondiente al día hábil anterior a la acreditación efectiva del pago.</p>}
          {quote.meta.outputCurrency === 'ARS' && <p>Equivalencia calculada a un tipo de cambio de {money(quote.meta.exchangeRate, 'ARS')} por USD. El importe definitivo en pesos se determinará al tipo de cambio vendedor para dólar billete del Banco de la Nación Argentina correspondiente al día hábil anterior a la acreditación efectiva del pago.</p>}
          {quote.meta.notes && <p><strong>Observaciones:</strong> {quote.meta.notes}</p>}
          <p className="preview-legal">Documento comercial no fiscal. Disponibilidad sujeta a confirmación.</p>
        </footer>
      </section>
    </div>
  )
}

export function QuoteWorkspace({ userEmail, userId }: { userEmail: string; userId: string }) {
  const [lines, setLines] = useState<QuoteLine[]>([])
  const [meta, setMeta] = useState<QuoteMeta>(newMeta)
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>(loadSavedQuotes)
  const [activeSection, setActiveSection] = useState<'cotizar' | 'historial' | 'administracion'>('cotizar')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [exchangeInfo, setExchangeInfo] = useState({ source: 'Dólar oficial (venta)', fetchedAt: '', loading: true, error: '' })
  const [clients, setClients] = useState<CommercialClient[]>([])
  const [rules, setRules] = useState<CommercialRule[]>([])
  const [rulesStatus, setRulesStatus] = useState<'cargando' | 'ok' | 'error'>('cargando')
  const totals = useMemo(() => quoteTotals(lines, meta.discountPercent, meta.surchargePercent, meta.exchangeRate, meta.outputCurrency, meta.priceMode, rules), [lines, meta, rules])
  const sourceCurrency = totals.currencies.size === 1 ? [...totals.currencies][0] : 'USD'
  const canAdjustCommercialTerms = ['felipecnokaert@gmail.com', 'felipe@grupopoliplast.com.ar'].includes(userEmail.toLowerCase())

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(savedQuotes)), [savedQuotes])
  useEffect(() => { loadCommercialClients(userId).then(setClients).catch(() => setClients([])) }, [userId])
  useEffect(() => {
    // Se carga una sola vez por sesión (no depende de líneas/cantidad/fecha):
    // la resolución en sí se recalcula sola porque `totals` y cada llamado a
    // resolvedLinePrice reevalúan contra `rules` en cada render.
    loadCommercialRules()
      .then((result) => { setRules(result); setRulesStatus('ok') })
      .catch(() => { setRules([]); setRulesStatus('error') })
  }, [])
  useEffect(() => {
    fetchOfficialDollar().then((result) => {
      setMeta((current) => ({ ...current, exchangeRate: result.rate }))
      setExchangeInfo({ source: result.source, fetchedAt: result.fetchedAt, loading: false, error: '' })
    }).catch(() => setExchangeInfo({ source: 'Manual', fetchedAt: '', loading: false, error: 'No se pudo actualizar automáticamente' }))
  }, [])

  const add = (variant: VariantWithPricing, product: ProductWithVariants) => setLines((current) => addQuoteLine(current, variant, product))
  const updateMeta = <K extends keyof QuoteMeta>(field: K, value: QuoteMeta[K]) => setMeta((current) => ({ ...current, [field]: value }))
  const snapshot = (): SavedQuote => ({ meta, lines, updatedAt: new Date().toISOString() })
  const save = () => setSavedQuotes((current) => [snapshot(), ...current.filter((quote) => quote.meta.number !== meta.number)])
  const startNew = () => { setMeta(newMeta()); setLines([]); setActiveSection('cotizar') }
  const loadQuote = (quote: SavedQuote) => { setMeta(quote.meta); setLines(quote.lines); setActiveSection('cotizar') }
  const openWhatsApp = () => {
    const quote = snapshot()
    const phone = meta.phone.replace(/\D/g, '')
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(serializeQuoteForWhatsApp(quote, rules))}`, '_blank', 'noopener,noreferrer')
  }
  const canPreview = lines.length > 0 && totals.pendingLines === 0 && totals.currencies.size <= 1 && (meta.outputCurrency === 'USD' || meta.exchangeRate > 0)
  const selectClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId)
    if (!client) return
    setMeta((current) => ({ ...current, client: client.company, contact: client.contact, phone: client.phone, email: client.email }))
  }

  return (
    <>
      <nav className="workspace-nav">
        <div className="nav-brand"><BrandMark brand="Grupo Poliplast" /><span>Cotizador comercial</span></div>
        <div className="nav-tabs"><button className={activeSection === 'cotizar' ? 'active' : ''} onClick={() => setActiveSection('cotizar')}><b>＋</b>Nueva cotización</button><button className={activeSection === 'historial' ? 'active' : ''} onClick={() => setActiveSection('historial')}><b>▤</b>Guardadas <span>{savedQuotes.length}</span></button><button className={activeSection === 'administracion' ? 'active' : ''} onClick={() => setActiveSection('administracion')}><b>⚙</b>Administración</button></div>
        <div className="nav-user"><span>{userEmail}</span><button className="new-quote-button" onClick={startNew}>+ Nueva cotización</button></div>
      </nav>

      {activeSection === 'administracion' ? <AdminPanel /> : activeSection === 'historial' ? (
        <main className="history-page">
          <div className="page-intro"><span className="eyebrow">Seguimiento local</span><h1>Cotizaciones guardadas</h1><p className="muted">Borradores guardados en este navegador. La sincronización compartida será la próxima capa de backend.</p></div>
          {savedQuotes.length === 0 ? <div className="empty-state">Todavía no guardaste cotizaciones.</div> : <div className="history-list">{savedQuotes.map((quote) => <article key={quote.meta.number}><div><strong>{quote.meta.client || 'Sin cliente'}</strong><span>{quote.meta.number} · {quote.lines.length} renglones · {new Date(quote.updatedAt).toLocaleString('es-AR')}</span></div><span className={`status status-${quote.meta.status}`}>{quote.meta.status}</span><button onClick={() => loadQuote(quote)}>Abrir</button></article>)}</div>}
        </main>
      ) : (
        <main className="quote-layout">
          <section className="quote-builder">
            <div className="quote-heading"><div><span className="eyebrow">Herramienta interna</span><h1>Nueva cotización</h1><p className="muted">Cotizá con el catálogo vigente y conservá el control antes de enviar.</p></div><div className="quote-status">{meta.number}</div></div>
            <div className={`client-card ${clientOpen ? 'open' : 'collapsed'}`}>
              <button className="client-toggle" onClick={() => setClientOpen((value) => !value)}><div className="section-title"><span>01</span><div><h2>{meta.client || 'Cliente opcional'}</h2><p>{clientOpen ? 'Datos que aparecerán en la propuesta.' : 'Podés cotizar sin completar datos.'}</p></div></div><strong>{clientOpen ? 'Ocultar' : 'Agregar datos'}</strong></button>
              {clientOpen && <div className="client-fields">
                {clients.length > 0 && <label className="crm-client-picker">Elegir del CRM<select defaultValue="" onChange={(event) => selectClient(event.target.value)}><option value="">Buscar entre {clients.length} empresas…</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company}{client.contact ? ` · ${client.contact}` : ''}</option>)}</select></label>}
                <label>Empresa o cliente<input value={meta.client} onChange={(e) => updateMeta('client', e.target.value)} placeholder="Razón social o nombre" /></label>
                <label>Persona de contacto<input value={meta.contact} onChange={(e) => updateMeta('contact', e.target.value)} placeholder="Nombre y apellido" /></label>
                <label>WhatsApp<input value={meta.phone} onChange={(e) => updateMeta('phone', e.target.value)} placeholder="54911..." /></label>
                <label>Email<input type="email" value={meta.email} onChange={(e) => updateMeta('email', e.target.value)} placeholder="cliente@empresa.com" /></label>
                <label>Condición de pago<select value={meta.paymentMethod} onChange={(e) => updateMeta('paymentMethod', e.target.value as PaymentMethod)}><option value="transferencia">Transferencia</option><option value="contado">Contado</option><option value="cuenta_corriente">Cuenta corriente</option><option value="tarjeta">Tarjeta / cuotas</option></select></label>
                <label>Validez<select value={meta.validDays} onChange={(e) => updateMeta('validDays', Number(e.target.value))}><option value={3}>3 días</option><option value={7}>7 días</option><option value={10}>10 días</option><option value={15}>15 días</option><option value={30}>30 días</option></select></label>
              </div>}
            </div>
            <div className="section-title products-title"><span>02</span><div><h2>Productos</h2><p>Buscá por familia, marca, nombre o SKU.</p></div></div>
            <CatalogBrowser title="Agregar productos" onAdd={add} />
          </section>

          <aside className="quote-rail">
            <div className="rail-title"><div><span className="eyebrow">Resumen</span><h2>{meta.client || 'Cotización sin cliente'}</h2></div><span className="line-count">{lines.length}</span></div>
            {lines.length === 0 ? <div className="quote-empty">Buscá un producto y elegí <strong>Agregar</strong>.</div> : <div className="quote-lines">{lines.map((line) => {
              const price = resolvedLinePrice(line, totals.appliedPriceMode, rules)
              return <div className="quote-line" key={line.id}><div className="quote-line-head"><strong>{line.productName}</strong><button aria-label={`Quitar ${line.productName}`} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>×</button></div><div className="quote-line-meta">{line.variant.sku}{!price?.specialRule ? ` · ${price?.listName || 'Sin lista aplicable'}` : ''}</div><div className="quote-line-values"><label>Cantidad<input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: Math.max(.01, Number(e.target.value) || .01) } : item))} /></label><div><span className="unit-price">{price ? `${money(price.amount, price.currency)} / ${line.variant.unit} · IVA incluido` : 'Precio pendiente'}</span>{price?.specialRule && <span className="rule-note">{price.listName}</span>}<strong className="line-total">{price ? money(price.amount * line.quantity, price.currency) : '—'}</strong></div></div></div>
            })}</div>}

            <div className="commercial-controls">
              <label>Lista comercial<select value={meta.priceMode} onChange={(e) => updateMeta('priceMode', e.target.value as PriceMode)}><option value="automatico">Automática por monto</option><option value="consumidor_final">Consumidor final</option><option value="mayorista">Mayorista</option></select><small className="exchange-source">Aplicada: {totals.appliedPriceMode === 'mayorista' ? 'Mayorista' : 'Consumidor final'}{meta.priceMode === 'automatico' ? ' · Resinplast cambia desde USD 1.815 si existe lista verificada' : ''}</small></label>
              <label>Moneda de salida<select value={meta.outputCurrency} onChange={(e) => updateMeta('outputCurrency', e.target.value as 'USD' | 'ARS')}><option value="USD">USD</option><option value="ARS">ARS</option></select></label>
              {meta.outputCurrency === 'ARS' && <label>Tipo de cambio ARS/USD<input type="number" min="0" value={meta.exchangeRate} onChange={(e) => { updateMeta('exchangeRate', Number(e.target.value)); setExchangeInfo({ source: 'Manual', fetchedAt: '', loading: false, error: '' }) }} /><small className="exchange-source">{exchangeInfo.loading ? 'Actualizando…' : exchangeInfo.error || `${exchangeInfo.source}${exchangeInfo.fetchedAt ? ` · ${new Date(exchangeInfo.fetchedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs` : ''}`}</small></label>}
              <label>Descuento autorizado %<input type="number" min="0" max="100" value={meta.discountPercent} disabled={!canAdjustCommercialTerms} onChange={(e) => updateMeta('discountPercent', Number(e.target.value))} /></label>
              <label>Recargo / financiación %<input type="number" min="0" value={meta.surchargePercent} disabled={!canAdjustCommercialTerms} onChange={(e) => updateMeta('surchargePercent', Number(e.target.value))} /></label>
              <label className="full-field">Observaciones<textarea rows={3} value={meta.notes} onChange={(e) => updateMeta('notes', e.target.value)} placeholder="Entrega, aplicación, condición especial..." /></label>
            </div>

            {rulesStatus === 'error' && <p className="quote-warning">Reglas comerciales no disponibles</p>}
            {totals.currencies.size > 1 && <p className="quote-warning">Hay precios base en monedas distintas. Separá la cotización o normalizá las listas.</p>}
            {totals.pendingLines > 0 && <p className="quote-warning">{totals.pendingLines} renglón/es sin precio aplicable para esa cantidad.</p>}
            <div className="quote-totals"><div><span>Subtotal final</span><strong>{money(totals.subtotal, sourceCurrency)}</strong></div>{totals.discount > 0 && <div><span>Descuento</span><strong>− {money(totals.discount, sourceCurrency)}</strong></div>}{totals.surcharge > 0 && <div><span>Recargo</span><strong>{money(totals.surcharge, sourceCurrency)}</strong></div>}<div><span>IVA incluido</span><strong>{money(totals.vat, sourceCurrency)}</strong></div><div className="grand-total"><span>Total {meta.outputCurrency}</span><strong>{money(totals.convertedTotal, meta.outputCurrency)}</strong></div></div>
            <div className="policy-note">El precio se resuelve por lista y tramo de cantidad. Costos y rentabilidad no se exponen en esta vista comercial.</div>
            <div className="rail-actions"><button onClick={save}>Guardar borrador</button><button onClick={openWhatsApp} disabled={!canPreview}>WhatsApp</button><button className="primary-action" onClick={() => setPreviewOpen(true)} disabled={!canPreview}>Vista previa / PDF</button></div>
          </aside>
        </main>
      )}

      {previewOpen && <QuotePreview quote={snapshot()} rules={rules} onClose={() => setPreviewOpen(false)} />}
    </>
  )
}
