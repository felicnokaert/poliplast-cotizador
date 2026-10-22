import { useEffect, useMemo, useState } from 'react'
import { customerInsights, loadCustomerComprobantes, ownQuotesFor, summarizeCustomer, type ComprobanteRow } from '../lib/customerHistory'
import type { SavedQuote } from '../lib/quote'

const STATUS: Record<string, { label: string; tone: string }> = { activo: { label: 'Activo', tone: 'ok' }, dormido: { label: 'Dormido', tone: 'warn' }, inactivo: { label: 'Inactivo', tone: 'off' } }
const pesos = (value: number) => `$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value)}`
const dateText = (value: string) => value.split('-').reverse().join('/')

/** Ficha del cliente dentro de la cotización: facturación en Contabilium + cotizaciones anteriores + avisos útiles. */
export function CustomerHistoryCard({ names, quotes, currentNumber }: { names: string[]; quotes: SavedQuote[]; currentNumber: string }) {
  const key = names.filter(Boolean).join('|')
  const [state, setState] = useState<{ key: string; status: 'loading' | 'ready' | 'error'; rows: ComprobanteRow[] }>({ key: '', status: 'loading', rows: [] })
  useEffect(() => {
    const list = key.split('|').filter(Boolean)
    if (!list.some((name) => name.trim().length >= 4)) return undefined
    let cancelled = false
    const timer = window.setTimeout(() => {
      loadCustomerComprobantes(list)
        .then((rows) => { if (!cancelled) setState({ key, status: 'ready', rows }) })
        .catch(() => { if (!cancelled) setState({ key, status: 'error', rows: [] }) })
    }, 450)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [key])
  const current = state.key === key ? state : { key, status: 'loading' as const, rows: [] }
  const history = useMemo(() => (current.status === 'ready' ? summarizeCustomer(current.rows, names) : null), [current.status, current.rows, names])
  const own = useMemo(() => ownQuotesFor(quotes, names, currentNumber), [quotes, names, currentNumber])
  const insights = customerInsights(history, own)
  if (!names.some((name) => name.trim().length >= 4)) return null
  const lastOwn = [...own].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0]
  return (
    <section className="customer-history" aria-label="Ficha del cliente">
      <header><span className="eyebrow">Ficha del cliente</span>{history?.status && <em className={`badge-status ${STATUS[history.status].tone}`}>{STATUS[history.status].label}</em>}</header>
      {current.status === 'loading' && <p className="muted small">Mirando su historial en Contabilium…</p>}
      {current.status === 'error' && <p className="muted small">No se pudo leer la facturación de Contabilium ahora.</p>}
      {current.status === 'ready' && !history && <p className="muted small">No encontré facturas con ese nombre en Contabilium (puede figurar con otra razón social).</p>}
      {history && (
        <dl>
          <div><dt>Última compra</dt><dd>{history.lastPurchase ? <>{dateText(history.lastPurchase)}<small> · hace {history.daysSince} días</small></> : '—'}</dd></div>
          <div><dt>Últimos 24 meses</dt><dd>{history.purchases24} compras<small> · {pesos(history.total24)}</small></dd></div>
          <div><dt>Frecuencia</dt><dd>{history.frequencyDays ? `cada ~${history.frequencyDays} días` : '—'}</dd></div>
          <div><dt>Cotizaciones en Contabilium</dt><dd>{history.quotesInContabilium}{history.lastQuote && <small> · última {dateText(history.lastQuote)}</small>}</dd></div>
        </dl>
      )}
      {own.length > 0 && <p className="small">En este cotizador: <strong>{own.length}</strong> cotización{own.length === 1 ? '' : 'es'} anterior{own.length === 1 ? '' : 'es'}{lastOwn && <> · la última N° {lastOwn.meta.number} ({lastOwn.meta.status})</>}.</p>}
      {insights.length > 0 && <ul className="customer-history-insights">{insights.map((text) => <li key={text}>{text}</li>)}</ul>}
    </section>
  )
}
