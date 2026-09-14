import { useEffect, useMemo, useState } from 'react'
import { CatalogBrowser } from './CatalogBrowser'
import {
  addQuoteLine,
  automaticPricingSummary,
  createQuoteNumber,
  linePricingDetails,
  quoteExpiry,
  quoteTotals,
  serializeQuoteForWhatsApp,
  whatsappUrl,
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
import { addCommercialClientPhone, loadCommercialClients, type CommercialClient } from '../lib/clients'
import { loadCommercialRules } from '../lib/commercialRules'
import { loadSharedQuotes, mergeQuoteHistories, saveSharedQuote } from '../lib/sharedQuotes'
import { DEFAULT_PAYMENT_POLICIES, loadPaymentPolicies, reserveQuoteNumber, type PaymentPolicy } from '../lib/paymentPolicies'

const STORAGE_KEY = 'poliplast-cotizador-quotes-v1'
const WORKING_DRAFT_KEY = 'poliplast-cotizador-working-draft-v1'

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency }).format(amount)
}

function loadSavedQuotes(): SavedQuote[] {
  try {
    const quotes = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as SavedQuote[]
    return quotes.map((quote) => ({ ...quote, meta: { ...quote.meta, priceMode: quote.meta.priceMode || 'automatico', outputCurrency: 'USD' } }))
  } catch { return [] }
}

function loadWorkingDraft(): SavedQuote | null {
  try {
    const draft = JSON.parse(localStorage.getItem(WORKING_DRAFT_KEY) || 'null') as SavedQuote | null
    if (!draft?.meta || !Array.isArray(draft.lines)) return null
    return { ...draft, meta: { ...draft.meta, priceMode: draft.meta.priceMode || 'automatico', outputCurrency: 'USD' } }
  } catch { return null }
}

function newMeta(existingQuotes: SavedQuote[] = loadSavedQuotes()): QuoteMeta {
  const now = new Date()
  return {
    number: createQuoteNumber(now, existingQuotes.map((quote) => quote.meta.number)), client: '', contact: '', phone: '', email: '', notes: '',
    paymentMethod: 'transferencia', paymentTermDays: 0, priceMode: 'automatico', validDays: 7, discountPercent: 0, surchargePercent: 0,
    exchangeRate: 0, outputCurrency: 'USD', status: 'borrador', createdAt: now.toISOString(),
  }
}

function BrandMark({ brand }: { brand: string }) {
  if (brand === 'Grupo Poliplast') return <img className="brand-logo" src="/poliplast-logo.png" alt="Grupo Poliplast" />
  return <div className={`brand-mark brand-mark-${brand.toLowerCase().replace(/\W/g, '')}`}><span>línea</span><strong>{brand}</strong></div>
}

function QuotePreview({ quote, rules, onClose }: { quote: SavedQuote; rules: CommercialRule[]; onClose: () => void }) {
  const totals = quoteTotals(quote.lines, quote.meta.discountPercent, quote.meta.surchargePercent, quote.meta.exchangeRate, quote.meta.outputCurrency, quote.meta.priceMode, rules)
  const brands = [...new Set(quote.lines.map((line) => line.brand))]
  const principalBrand = brands.length === 1 ? brands[0] : 'Grupo Poliplast'
  const conversion = quote.meta.outputCurrency === 'ARS' ? quote.meta.exchangeRate : 1
  const expires = quoteExpiry(quote.meta.createdAt, quote.meta.validDays)

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Vista previa del mensaje de cotización">
      <section className={`quote-preview preview-${principalBrand.toLowerCase().replace(/\W/g, '')}`}>
        <div className="preview-actions no-print">
          <button onClick={onClose}>Volver</button>
          <button className="primary-action inline" onClick={() => navigator.clipboard.writeText(serializeQuoteForWhatsApp(quote, rules))}>Copiar mensaje</button>
        </div>
        <header className="preview-header">
          <div className="preview-brands"><BrandMark brand={principalBrand} />{principalBrand !== 'Grupo Poliplast' && <BrandMark brand="Grupo Poliplast" />}</div>
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
            const details = linePricingDetails(line, quote.meta.priceMode, rules, quote.lines, quote.meta.exchangeRate)
            const price = details.price
            return <tr key={line.id}><td><strong>{line.productName}</strong><small>{line.family} · {details.priceLabel}</small><small className="rule-note">{details.condition} {details.outcome}</small></td><td>{line.variant.sku}</td><td>{line.quantity} {line.variant.unit}<small>{details.physicalUnits} u. físicas</small></td><td>{price ? money(price.amount * conversion, quote.meta.outputCurrency) : 'A confirmar'}{price && <small>Neto {money((details.netUnitAmount ?? 0) * details.unitsPerPack * conversion, quote.meta.outputCurrency)} + IVA {(price.vatRate * 100).toFixed(0)}%</small>}</td><td>{price ? money(price.amount * line.quantity * conversion, quote.meta.outputCurrency) : 'A confirmar'}</td></tr>
          })}</tbody>
        </table>
        <div className="preview-summary">
          <div><span>Subtotal</span><strong>{money(totals.subtotal * conversion, quote.meta.outputCurrency)}</strong></div>
          {totals.discount > 0 && <div><span>Descuento ({quote.meta.discountPercent}%)</span><strong>− {money(totals.discount * conversion, quote.meta.outputCurrency)}</strong></div>}
          {totals.surcharge > 0 && <div><span>Financiación/recargo ({quote.meta.surchargePercent}%)</span><strong>{money(totals.surcharge * conversion, quote.meta.outputCurrency)}</strong></div>}
          <div><span>IVA incluido</span><strong>{money(totals.vat * conversion, quote.meta.outputCurrency)}</strong></div>
          <div className="preview-grand"><span>Total</span><strong>{money(totals.convertedTotal, quote.meta.outputCurrency)}</strong></div>
          {totals.currencies.size === 1 && totals.currencies.has('USD') && quote.meta.exchangeRate > 0 && <div><span>Equivalente estimado en pesos</span><strong>{money(totals.total * quote.meta.exchangeRate, 'ARS')}</strong></div>}
        </div>
        <footer className="preview-footer">
          <p><strong>Política de precios:</strong> {quote.meta.priceMode === 'automatico' ? automaticPricingSummary(quote.lines, totals.appliedPriceMode, rules) : `Lista seleccionada: ${quote.meta.priceMode === 'mayorista' ? 'Mayorista' : 'Consumidor final'}.`}</p>
          <p><strong>Condición:</strong> {quote.meta.paymentMethod.replace('_', ' ')}{quote.meta.paymentMethod === 'cheque' ? ` a ${quote.meta.paymentTermDays ?? 0} días` : ''} · <strong>Validez:</strong> hasta {expires.toLocaleDateString('es-AR')}</p>
          <p>Todos los precios indicados incluyen IVA.</p>
          {quote.meta.outputCurrency === 'USD' && <p>Esta cotización está expresada en dólares estadounidenses. Si se cancela en pesos argentinos, el importe se calculará al tipo de cambio vendedor para dólar billete del Banco de la Nación Argentina correspondiente al día hábil anterior a la acreditación efectiva del pago.</p>}
          {quote.meta.outputCurrency === 'ARS' && <p>Equivalencia calculada a un tipo de cambio de {money(quote.meta.exchangeRate, 'ARS')} por USD. El importe definitivo en pesos se determinará al tipo de cambio vendedor para dólar billete del Banco de la Nación Argentina correspondiente al día hábil anterior a la acreditación efectiva del pago.</p>}
          {quote.meta.notes && <p><strong>Observaciones:</strong> {quote.meta.notes}</p>}
          <p className="preview-legal">Documento comercial no fiscal · Precios y disponibilidad sujetos a confirmación · Grupo Poliplast</p>
        </footer>
      </section>
    </div>
  )
}

export function QuoteWorkspace({ userEmail, userId }: { userEmail: string; userId: string }) {
  const [initialDraft] = useState(loadWorkingDraft)
  const [lines, setLines] = useState<QuoteLine[]>(() => initialDraft?.lines ?? [])
  const [meta, setMeta] = useState<QuoteMeta>(() => initialDraft?.meta ?? newMeta())
  const [savedQuotes, setSavedQuotes] = useState<SavedQuote[]>(loadSavedQuotes)
  const [activeSection, setActiveSection] = useState<'catalogo' | 'cotizacion' | 'historial' | 'administracion'>('historial')
  const [productPickerOpen, setProductPickerOpen] = useState(false)
  const [lastAdded, setLastAdded] = useState('')
  const [historyStatus, setHistoryStatus] = useState<'todas' | QuoteMeta['status']>('todas')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [clientOpen, setClientOpen] = useState(false)
  const [whatsappOpen, setWhatsappOpen] = useState(false)
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [newWhatsappPhone, setNewWhatsappPhone] = useState('')
  const [exchangeInfo, setExchangeInfo] = useState({ source: 'Dólar oficial (venta)', fetchedAt: '', loading: true, error: '' })
  const [exchangeMode, setExchangeMode] = useState<'automatico' | 'manual'>('automatico')
  const [clients, setClients] = useState<CommercialClient[]>([])
  const [rules, setRules] = useState<CommercialRule[]>([])
  const [rulesStatus, setRulesStatus] = useState<'cargando' | 'ok' | 'error'>('cargando')
  const [quoteSyncStatus, setQuoteSyncStatus] = useState<'cargando' | 'compartido' | 'local' | 'guardando'>('cargando')
  const [paymentPolicies, setPaymentPolicies] = useState<PaymentPolicy[]>(DEFAULT_PAYMENT_POLICIES)
  const totals = useMemo(() => quoteTotals(lines, meta.discountPercent, meta.surchargePercent, meta.exchangeRate, meta.outputCurrency, meta.priceMode, rules), [lines, meta, rules])
  const sourceCurrency = totals.currencies.size === 1 ? [...totals.currencies][0] : 'USD'
  const stockWarnings = lines.filter((line) => line.variant.approvedStock && line.quantity > line.variant.approvedStock.quantity)
  const canAdjustCommercialTerms = ['felipecnokaert@gmail.com', 'felipe@grupopoliplast.com.ar'].includes(userEmail.toLowerCase())
  const canAccessAdministration = ['felipe@grupopoliplast.com.ar', 'juan@grupopoliplast.com.ar'].includes(userEmail.toLowerCase())
  const visibleQuotes = useMemo(() => historyStatus === 'todas' ? savedQuotes : savedQuotes.filter((quote) => quote.meta.status === historyStatus), [savedQuotes, historyStatus])
  const editingSavedQuote = savedQuotes.some((quote) => quote.meta.number === meta.number)

  useEffect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(savedQuotes)), [savedQuotes])
  useEffect(() => {
    if (initialDraft) return
    const createdAt = meta.createdAt
    reserveQuoteNumber(savedQuotes.map((quote) => quote.meta.number)).then((number) => setMeta((current) => current.createdAt === createdAt ? { ...current, number } : current))
    // La primera cotización también reserva su número; un borrador recuperado conserva el suyo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const refreshAutomaticExchange = () => {
    setExchangeMode('automatico')
    setExchangeInfo((current) => ({ ...current, loading: true, error: '' }))
    fetchOfficialDollar().then((result) => {
      setMeta((current) => ({ ...current, exchangeRate: result.rate }))
      setExchangeInfo({ source: result.source, fetchedAt: result.fetchedAt, loading: false, error: '' })
    }).catch(() => setExchangeInfo({ source: 'Manual', fetchedAt: '', loading: false, error: 'No se pudo actualizar automáticamente' }))
  }
  useEffect(() => {
    loadSharedQuotes()
      .then((remote) => { setSavedQuotes((local) => mergeQuoteHistories(local, remote)); setQuoteSyncStatus('compartido') })
      .catch(() => setQuoteSyncStatus('local'))
  }, [])
  useEffect(() => {
    const updatedAt = new Date().toISOString()
    localStorage.setItem(WORKING_DRAFT_KEY, JSON.stringify({ meta, lines, updatedAt }))
  }, [meta, lines])
  useEffect(() => { loadCommercialClients(userId).then(setClients).catch(() => setClients([])) }, [userId])
  useEffect(() => { loadPaymentPolicies().then(setPaymentPolicies) }, [])
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

  const add = (variant: VariantWithPricing, product: ProductWithVariants) => {
    setLines((current) => addQuoteLine(current, variant, product))
    setLastAdded(`${product.name} agregado a la cotización`)
    window.setTimeout(() => setLastAdded(''), 2200)
  }
  const updateMeta = <K extends keyof QuoteMeta>(field: K, value: QuoteMeta[K]) => setMeta((current) => ({ ...current, [field]: value }))
  const snapshot = (): SavedQuote => ({ meta, lines, updatedAt: new Date().toISOString() })
  const save = async () => {
    const quote = snapshot()
    setSavedQuotes((current) => mergeQuoteHistories(current.filter((item) => item.meta.number !== quote.meta.number), [quote]))
    setQuoteSyncStatus('guardando')
    try { await saveSharedQuote(quote, userId, rules); setQuoteSyncStatus('compartido') } catch { setQuoteSyncStatus('local') }
  }
  const startNew = async () => {
    const draft = newMeta(savedQuotes)
    setMeta(draft); setLines([]); setProductPickerOpen(true); setActiveSection('cotizacion')
    const number = await reserveQuoteNumber(savedQuotes.map((quote) => quote.meta.number))
    setMeta((current) => current.createdAt === draft.createdAt ? { ...current, number } : current)
  }
  const saveAndStartNew = async () => { await save(); await startNew() }
  const loadQuote = (quote: SavedQuote) => { setMeta({ ...quote.meta, outputCurrency: 'USD' }); setLines(quote.lines); setProductPickerOpen(false); setActiveSection('cotizacion') }
  const sendWhatsApp = (phone = whatsappPhone) => {
    const quote = snapshot()
    const message = serializeQuoteForWhatsApp(quote, rules, paymentPolicies.find((item) => item.id === meta.paymentMethod))
    window.open(whatsappUrl(phone, message), '_blank', 'noopener,noreferrer')
    setWhatsappOpen(false)
  }
  const matchingClient = clients.find((item) => item.company.trim().toLowerCase() === meta.client.trim().toLowerCase())
  const availablePhones = [...new Set([...(matchingClient?.phones ?? []), meta.phone].filter(Boolean))]
  const openWhatsApp = () => { setWhatsappPhone(availablePhones[0] ?? ''); setNewWhatsappPhone(''); setWhatsappOpen(true) }
  const saveNewPhone = async () => {
    if (!matchingClient) return
    await addCommercialClientPhone(matchingClient.id, newWhatsappPhone, userId)
    const normalized = newWhatsappPhone.replace(/\D/g, '')
    setClients((current) => current.map((client) => client.id === matchingClient.id ? { ...client, phones: [...new Set([...client.phones, normalized])], phone: client.phone || normalized } : client))
    setWhatsappPhone(normalized); setNewWhatsappPhone('')
  }
  const canPreview = lines.length > 0 && totals.pendingLines === 0 && totals.currencies.size <= 1 && (meta.outputCurrency === 'USD' || meta.exchangeRate > 0)
  const selectClient = (clientId: string) => {
    const client = clients.find((item) => item.id === clientId)
    if (!client) return
    setMeta((current) => ({ ...current, client: client.company, contact: client.contact, phone: client.phone, email: client.email }))
  }
  const selectPaymentPolicy = (id: string) => {
    const policy = paymentPolicies.find((item) => item.id === id)
    setMeta((current) => ({ ...current, paymentMethod: id, discountPercent: policy?.discountPercent ?? current.discountPercent, surchargePercent: policy?.surchargePercent ?? current.surchargePercent }))
  }

  return (
    <>
      <nav className="workspace-nav">
        <div className="nav-brand"><BrandMark brand="Grupo Poliplast" /><span>Cotizador comercial</span></div>
        <div className="nav-tabs"><button className={activeSection === 'historial' || activeSection === 'cotizacion' ? 'active' : ''} onClick={() => setActiveSection('historial')}><b>▤</b>Cotizaciones <span>{savedQuotes.length}</span></button><button className={activeSection === 'catalogo' ? 'active' : ''} onClick={() => setActiveSection('catalogo')}><b>▦</b>Catálogo</button>{canAccessAdministration && <button className={activeSection === 'administracion' ? 'active' : ''} onClick={() => setActiveSection('administracion')}><b>⚙</b>Administración</button>}</div>
        <div className="nav-user"><span>{userEmail}</span>{activeSection !== 'historial' && <button className="new-quote-button" onClick={startNew}>+ Nueva cotización</button>}</div>
      </nav>

      {activeSection === 'administracion' ? <AdminPanel userEmail={userEmail} /> : activeSection === 'historial' ? (
        <main className="history-page">
          <div className="page-intro page-intro-actions"><div><span className="eyebrow">Seguimiento comercial</span><h1>Cotizaciones</h1><p className="muted">{quoteSyncStatus === 'compartido' ? 'Historial sincronizado en todas tus computadoras.' : quoteSyncStatus === 'guardando' ? 'Sincronizando…' : quoteSyncStatus === 'cargando' ? 'Buscando cotizaciones…' : 'Modo local: la sincronización todavía no está disponible.'}</p></div><div className="history-actions">{lines.length > 0 && <button className="secondary-action" onClick={() => setActiveSection('cotizacion')}>Continuar borrador {meta.number}</button>}<button className="primary-action inline" onClick={startNew}>+ Nueva cotización</button></div></div>
          {savedQuotes.length > 0 && <div className="history-filters" aria-label="Filtrar cotizaciones">{(['todas', 'borrador', 'enviada', 'aceptada', 'rechazada'] as const).map((status) => <button key={status} className={historyStatus === status ? 'active' : ''} onClick={() => setHistoryStatus(status)}>{status} <span>{status === 'todas' ? savedQuotes.length : savedQuotes.filter((quote) => quote.meta.status === status).length}</span></button>)}</div>}
          {savedQuotes.length === 0 ? <div className="empty-state">Todavía no guardaste cotizaciones.</div> : visibleQuotes.length === 0 ? <div className="empty-state">No hay cotizaciones con ese estado.</div> : <div className="history-list">{visibleQuotes.map((quote) => <article key={quote.meta.number}><div><strong>{quote.meta.client || 'Sin cliente'}</strong><span>{quote.meta.number} · {quote.lines.length} renglones · {new Date(quote.updatedAt).toLocaleString('es-AR')}</span></div><span className={`status status-${quote.meta.status}`}>{quote.meta.status}</span><button onClick={() => loadQuote(quote)}>Continuar</button></article>)}</div>}
        </main>
      ) : activeSection === 'catalogo' ? (
        <main className="catalog-page">
          <div className="page-intro page-intro-actions"><div><span className="eyebrow">Catálogo comercial</span><h1>Productos</h1><p className="muted">Buscá por nombre, SKU, familia o subfamilia y agregá cada producto a la cotización activa.</p></div><button className="primary-action inline" onClick={() => setActiveSection('cotizacion')}>Ver cotización ({lines.length})</button></div>
          <CatalogBrowser title="Catálogo Grupo Poliplast" onAdd={add} exchangeRate={meta.exchangeRate} allowPriceListPrint />
        </main>
      ) : (
        <main className="quote-page">
          <section className="quote-builder">
            <div className="quote-heading"><div><span className="eyebrow">Herramienta interna</span><h1>{editingSavedQuote ? `Editando cotización ${meta.number}` : 'Nueva cotización'}</h1><p className="muted">{editingSavedQuote ? 'Los cambios conservarán el mismo número y quedarán disponibles para todo el equipo.' : 'Cotizá con el catálogo vigente y conservá el control antes de enviar.'}</p></div><div className="quote-status">{meta.number}</div></div>
            <div className={`client-card ${clientOpen ? 'open' : 'collapsed'}`}>
              <button className="client-toggle" onClick={() => setClientOpen((value) => !value)}><div className="section-title"><span>01</span><div><h2>{meta.client || 'Cliente opcional'}</h2><p>{clientOpen ? 'Datos que aparecerán en la propuesta.' : 'Podés cotizar sin completar datos.'}</p></div></div><strong>{clientOpen ? 'Ocultar' : 'Agregar datos'}</strong></button>
              {clientOpen && <div className="client-fields">
                {clients.length > 0 && <label className="crm-client-picker">Elegir del CRM<select defaultValue="" onChange={(event) => selectClient(event.target.value)}><option value="">Buscar entre {clients.length} empresas…</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.company}{client.contact ? ` · ${client.contact}` : ''}</option>)}</select></label>}
                <label>Empresa o cliente<input value={meta.client} onChange={(e) => updateMeta('client', e.target.value)} placeholder="Razón social o nombre" /></label>
                <label>Persona de contacto<input value={meta.contact} onChange={(e) => updateMeta('contact', e.target.value)} placeholder="Nombre y apellido" /></label>
                <label>WhatsApp<input value={meta.phone} onChange={(e) => updateMeta('phone', e.target.value)} placeholder="54911..." /></label>
                <label>Email<input type="email" value={meta.email} onChange={(e) => updateMeta('email', e.target.value)} placeholder="cliente@empresa.com" /></label>
                <label>Validez<select value={meta.validDays} onChange={(e) => updateMeta('validDays', Number(e.target.value))}><option value={3}>3 días</option><option value={7}>7 días</option><option value={10}>10 días</option><option value={15}>15 días</option><option value={30}>30 días</option></select></label>
              </div>}
            </div>
            <div className="quote-items-heading"><div className="section-title products-title"><span>02</span><div><h2>Ítems a cotizar</h2><p>Editá cantidades y condiciones antes de emitir.</p></div></div>{(lines.length > 0 || productPickerOpen) && <button className="secondary-action" onClick={() => setProductPickerOpen((value) => !value)}>{productPickerOpen ? 'Cerrar buscador' : '+ Agregar productos'}</button>}</div>
            {productPickerOpen && <section className="quote-product-picker"><CatalogBrowser title="Buscar y agregar productos" onAdd={add} minimumSearchLength={3} /></section>}
          </section>

          <section className="quote-rail" id="quote-summary">
            <div className="rail-title"><div><span className="eyebrow">Resumen</span><h2>{meta.client || 'Cotización sin cliente'}</h2></div><span className="line-count">{lines.length}</span></div>
            {lines.length === 0 ? <button className="quote-empty quote-empty-action" onClick={() => setProductPickerOpen(true)}><strong>+ Agregar productos</strong><span>Buscá por nombre o SKU</span></button> : <div className="quote-lines">{lines.map((line) => {
              const details = linePricingDetails(line, meta.priceMode, rules, lines, meta.exchangeRate)
              const price = details.price
              const exceedsApprovedStock = line.variant.approvedStock && line.quantity > line.variant.approvedStock.quantity
              return <div className="quote-line" key={line.id}><div className="quote-line-head"><strong>{line.productName}</strong><button aria-label={`Quitar ${line.productName}`} onClick={() => setLines((current) => current.filter((item) => item.id !== line.id))}>×</button></div><div className="quote-line-meta">{line.variant.sku} · {details.priceLabel}</div>{exceedsApprovedStock && <div className="stock-warning">Cantidad supera el último saldo aprobado ({line.variant.approvedStock!.quantity} {line.variant.approvedStock!.unit}). Confirmar disponibilidad.</div>}<div className="quote-line-values"><label>Cantidad<input type="number" min="0.01" step="0.01" value={line.quantity} onChange={(e) => setLines((current) => current.map((item) => item.id === line.id ? { ...item, quantity: Math.max(.01, Number(e.target.value) || .01) } : item))} /></label><div><span className="unit-price">{price ? `${money(price.amount, price.currency)} / ${line.variant.unit} · IVA incluido` : 'Precio pendiente'}</span>{price && <span className="price-trace">Neto {money((details.netUnitAmount ?? 0) * details.unitsPerPack, price.currency)} + IVA {(price.vatRate * 100).toFixed(0)}%</span>}<strong className="line-total">{price ? money(price.amount * line.quantity, price.currency) : '—'}</strong></div></div><div className="price-reason"><span>{details.physicalUnits} unidades físicas</span><p>{details.condition} {details.outcome}</p></div></div>
            })}</div>}

            <div className="commercial-controls">
              <label>Política de precios<select value={meta.priceMode} onChange={(e) => updateMeta('priceMode', e.target.value as PriceMode)}><option value="automatico">Reglas comerciales automáticas</option><option value="consumidor_final">Forzar consumidor final</option><option value="mayorista">Forzar mayorista</option></select><small className="exchange-source">{meta.priceMode === 'automatico' ? automaticPricingSummary(lines, totals.appliedPriceMode, rules) : `Aplicada: ${totals.appliedPriceMode === 'mayorista' ? 'Mayorista' : 'Consumidor final'}`}</small></label>
              <label className="compact-control payment-control">Forma de pago<div className="inline-control"><select value={meta.paymentMethod} onChange={(e) => selectPaymentPolicy(e.target.value as PaymentMethod)}>{paymentPolicies.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}</select>{meta.paymentMethod === 'cheque' && <select aria-label="Plazo del cheque" value={meta.paymentTermDays ?? 0} onChange={(e) => updateMeta('paymentTermDays', Number(e.target.value))}>{[0, 15, 30, 45, 60, 90, 120].map((days) => <option key={days} value={days}>{days} días</option>)}</select>}</div></label>
              <label className="compact-control status-control">Estado<select value={meta.status} onChange={(e) => updateMeta('status', e.target.value as QuoteMeta['status'])}><option value="borrador">Borrador</option><option value="enviada">Enviada</option><option value="aceptada">Aceptada</option><option value="rechazada">Rechazada</option></select></label>
              <label className="compact-control exchange-control">Tipo de cambio<div className="exchange-pill"><span>TC</span>{exchangeMode === 'manual' ? <input aria-label="Tipo de cambio manual ARS/USD" type="number" min="0" value={meta.exchangeRate} onChange={(e) => { updateMeta('exchangeRate', Number(e.target.value)); setExchangeInfo({ source: 'Manual', fetchedAt: '', loading: false, error: '' }) }} /> : <strong>{meta.exchangeRate || '—'}</strong>}<button type="button" onClick={() => exchangeMode === 'automatico' ? setExchangeMode('manual') : refreshAutomaticExchange()}>{exchangeMode === 'automatico' ? 'BNA' : 'manual'}</button>{exchangeMode === 'manual' && <button type="button" aria-label="Volver a tipo de cambio automático" onClick={refreshAutomaticExchange}>↻</button>}</div></label>
              <label className="compact-control discount-control">Descuento<div className="discount-pill"><input aria-label="Descuento porcentual" type="number" min="0" max="100" value={meta.discountPercent} disabled={!canAdjustCommercialTerms} onChange={(e) => updateMeta('discountPercent', Number(e.target.value))} /><span>%</span></div></label>
              <label className="full-field">Observaciones<textarea rows={3} value={meta.notes} onChange={(e) => updateMeta('notes', e.target.value)} placeholder="Entrega, aplicación, condición especial..." /></label>
            </div>

            {rulesStatus === 'error' && <p className="quote-warning">Reglas comerciales no disponibles</p>}
            {totals.currencies.size > 1 && <p className="quote-warning">Hay precios base en monedas distintas. Separá la cotización o normalizá las listas.</p>}
            {totals.pendingLines > 0 && <p className="quote-warning">{totals.pendingLines} renglón/es sin precio aplicable para esa cantidad.</p>}
            {stockWarnings.length > 0 && <p className="quote-warning">{stockWarnings.length} renglón/es superan el último stock aprobado. La cotización puede continuar, pero hay que confirmar disponibilidad.</p>}
            <div className="quote-totals"><div><span>Subtotal final</span><strong>{money(totals.subtotal, sourceCurrency)}</strong></div>{totals.discount > 0 && <div><span>Descuento</span><strong>− {money(totals.discount, sourceCurrency)}</strong></div>}{totals.surcharge > 0 && <div><span>Recargo</span><strong>{money(totals.surcharge, sourceCurrency)}</strong></div>}<div><span>IVA incluido</span><strong>{money(totals.vat, sourceCurrency)}</strong></div><div className="grand-total"><span>Total {meta.outputCurrency}</span><strong>{money(totals.convertedTotal, meta.outputCurrency)}</strong></div>{sourceCurrency === 'USD' && meta.exchangeRate > 0 && <><div className="peso-equivalent"><span>Equivalente estimado en pesos</span><strong>{money(totals.total * meta.exchangeRate, 'ARS')}</strong></div><small className="exchange-legend">USD {money(totals.total, 'USD')} × {money(meta.exchangeRate, 'ARS')} por dólar. {exchangeInfo.loading ? 'Actualizando cotización…' : exchangeInfo.error || exchangeInfo.source}.</small></>}</div>
            <div className="autosave-note" aria-live="polite">✓ Borrador protegido automáticamente en este equipo · {quoteSyncStatus === 'compartido' ? 'historial compartido activo' : quoteSyncStatus === 'guardando' ? 'sincronizando…' : 'guardado compartido pendiente'}</div>
            <div className="rail-actions"><button onClick={save}>Solo guardar</button><button onClick={() => setPreviewOpen(true)} disabled={!canPreview}>Vista previa</button><button onClick={openWhatsApp} disabled={!canPreview}>WhatsApp</button><button className="primary-action" onClick={saveAndStartNew} disabled={lines.length === 0}>{editingSavedQuote ? 'Guardar cambios y crear otra' : 'Guardar y crear otra'}</button></div>
          </section>
        </main>
      )}

      {lastAdded && <div className="add-toast" role="status">✓ {lastAdded}</div>}
      {activeSection === 'catalogo' && lines.length > 0 && <button className="mobile-quote-bar" onClick={() => setActiveSection('cotizacion')}><span>{lines.length} producto{lines.length === 1 ? '' : 's'}</span><strong>{money(totals.convertedTotal, meta.outputCurrency)}</strong><b>Ver cotización →</b></button>}

      {previewOpen && <QuotePreview quote={snapshot()} rules={rules} onClose={() => setPreviewOpen(false)} />}
      {whatsappOpen && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Elegir número de WhatsApp"><section className="admin-confirm"><h2>Enviar cotización por WhatsApp</h2><p className="muted">Elegí uno de los números guardados o agregá otro sin borrar los anteriores.</p>{availablePhones.length > 0 ? <div className="stack">{availablePhones.map((phone) => <label key={phone}><input type="radio" name="whatsapp-phone" checked={whatsappPhone === phone} onChange={() => setWhatsappPhone(phone)} /> {phone}</label>)}</div> : <p className="quote-warning">Este cliente todavía no tiene teléfonos guardados.</p>}<label>Agregar número<input value={newWhatsappPhone} onChange={(event) => setNewWhatsappPhone(event.target.value)} placeholder="Ej. 11 5555-1234" /></label>{!matchingClient && newWhatsappPhone && <p className="quote-warning">Elegí primero una empresa del CRM para guardar el número en su ficha.</p>}<div className="admin-actions"><button onClick={() => setWhatsappOpen(false)}>Cancelar</button><button disabled={!matchingClient || newWhatsappPhone.replace(/\D/g, '').length < 8} onClick={saveNewPhone}>Guardar número</button><button className="primary-action inline" disabled={!whatsappPhone} onClick={() => sendWhatsApp()}>Continuar a WhatsApp</button></div></section></div>}
    </>
  )
}
