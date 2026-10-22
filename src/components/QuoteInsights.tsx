import { useMemo } from 'react'
import { BarChart3, MessageCircle } from 'lucide-react'
import { followUpMessage, followUps, quoteInsights, repeatQuoters, statusBreakdown, topProducts } from '../lib/quoteInsights'
import { whatsappUrl, type SavedQuote } from '../lib/quote'
import type { CommercialRule } from '../types/commercialRules'

const usd = (value: number) => `US$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value)}`
const compact = (value: number) => (value >= 1000 ? `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value / 1000)}k` : String(Math.round(value)))

const STATUS_STYLE: Record<string, { label: string; color: string }> = {
  borrador: { label: 'Borrador', color: '#9a9b95' },
  enviada: { label: 'Enviada', color: '#d98a00' },
  aceptada: { label: 'Aceptada', color: '#2f8f4e' },
  rechazada: { label: 'Rechazada', color: '#ed1c24' },
}

function StatusDonut({ quotes }: { quotes: SavedQuote[] }) {
  const parts = statusBreakdown(quotes)
  const total = parts.reduce((sum, part) => sum + part.count, 0)
  const radius = 42, circumference = 2 * Math.PI * radius
  let offset = 0
  return (
    <section className="crm-chart-card crm-donut-card" aria-label="Cotizaciones por estado">
      <span className="eyebrow">Hoy</span>
      <h2>Por estado</h2>
      <div className="crm-donut-wrap">
        <svg viewBox="0 0 120 120" role="img" aria-label="Gráfico de cotizaciones por estado" className="crm-donut">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" opacity=".08" strokeWidth="16" />
          {total > 0 && parts.filter((part) => part.count > 0).map((part) => {
            const length = (part.count / total) * circumference
            const circle = <circle key={part.status} className="crm-donut-arc" cx="60" cy="60" r={radius} fill="none" stroke={STATUS_STYLE[part.status].color} strokeWidth="16" strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform="rotate(-90 60 60)"><title>{`${STATUS_STYLE[part.status].label}: ${part.count}`}</title></circle>
            offset += length
            return circle
          })}
          <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="800" fill="currentColor">{total}</text>
          <text x="60" y="74" textAnchor="middle" fontSize="9" fill="currentColor" opacity=".65">cotizaciones</text>
        </svg>
        <ul className="crm-legend">
          {parts.map((part) => <li key={part.status}><i style={{ background: STATUS_STYLE[part.status].color }} />{STATUS_STYLE[part.status].label}<b>{part.count}</b></li>)}
        </ul>
      </div>
    </section>
  )
}

function TopProducts({ quotes }: { quotes: SavedQuote[] }) {
  const items = topProducts(quotes)
  if (items.length === 0) return null
  const max = items[0].quotes
  return (
    <section className="crm-chart-card" aria-label="Productos más cotizados">
      <span className="eyebrow">Qué se cotiza más</span>
      <h2>Productos más cotizados</h2>
      <ol className="crm-rank">
        {items.map((item) => <li key={item.name}><span title={item.name}>{item.name}</span><div className="crm-rank-bar"><i style={{ width: `${(item.quotes / max) * 100}%` }} /></div><b>{item.quotes}</b></li>)}
      </ol>
    </section>
  )
}

// Tarjetas de números y gráfico de barras con el mismo estilo que Ventas en el CRM (SalesHistory.jsx).
export function QuoteInsights({ quotes, rules, onOpen }: { quotes: SavedQuote[]; rules: CommercialRule[]; onOpen?: (quote: SavedQuote) => void }) {
  const data = useMemo(() => quoteInsights(quotes, rules), [quotes, rules])
  const pending = useMemo(() => followUps(quotes, rules).slice(0, 5), [quotes, rules])
  const repeaters = useMemo(() => repeatQuoters(quotes, rules).slice(0, 4), [quotes, rules])
  const W = 720, H = 170, left = 8, top = 22, plotH = H - top - 30
  const slot = (W - left * 2) / data.bars.length
  const barW = Math.min(46, slot * 0.62)
  const max = Math.max(1, ...data.bars.map((bar) => bar.usd))
  return (
    <>
      <div className="crm-metrics">
        <div className="crm-metric"><span>Cotizaciones del mes</span><strong>{data.monthCount}</strong><small>{data.bars.at(-1)?.label} {new Date().getFullYear()}</small></div>
        <div className="crm-metric"><span>Cotizado en el mes</span><strong>{usd(data.monthUsd)}</strong><small>Total propuesto, con IVA</small></div>
        <div className="crm-metric"><span>Enviadas sin respuesta</span><strong>{data.waiting}</strong><small>Para hacer seguimiento</small></div>
        <div className="crm-metric"><span>Aceptadas</span><strong>{data.acceptance === null ? '—' : `${data.acceptance}%`}</strong><small>{data.accepted} de las respondidas</small></div>
      </div>
      {pending.length > 0 && (
        <section className="crm-chart-card crm-followups" aria-label="Para seguir">
          <span className="eyebrow">Para seguir hoy</span>
          <h2>Enviadas sin respuesta hace 3 días o más</h2>
          <ul>
            {pending.map(({ quote, days, usd: amount }) => (
              <li key={quote.meta.number}>
                <div><strong>{quote.meta.client || 'Consumidor final'}</strong><small>N° {quote.meta.number} · hace {days} días{amount > 0 ? ` · ${usd(amount)}` : ''}</small></div>
                <div className="crm-followup-actions">
                  {onOpen && <button type="button" onClick={() => onOpen(quote)}>Abrir</button>}
                  <a className={quote.meta.phone ? '' : 'disabled'} href={quote.meta.phone ? whatsappUrl(quote.meta.phone, followUpMessage(quote)) : undefined} target="_blank" rel="noreferrer" aria-disabled={!quote.meta.phone} title={quote.meta.phone ? 'Abre WhatsApp con el mensaje listo' : 'Esta cotización no tiene WhatsApp cargado'}><MessageCircle size={14} /> Seguimiento</a>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {repeaters.length > 0 && (
        <section className="crm-chart-card crm-followups crm-repeaters" aria-label="Cotizan seguido y no cierran">
          <span className="eyebrow">Conviene llamar</span>
          <h2>Cotizan seguido y todavía no compraron</h2>
          <p>Tres o más cotizaciones y ninguna aceptada: puede ser precio, plazo o cantidad. Preguntales qué los frena.</p>
          <ul>
            {repeaters.map((item) => (
              <li key={item.client}>
                <div><strong>{item.client}</strong><small>{item.quotes} cotizaciones · última hace {item.lastDays} días · {usd(item.totalUsd)} cotizados en total</small></div>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="crm-chart-grid">
        <section className="crm-chart-card" aria-label="Cotizado por mes">
          <span className="eyebrow">Últimos 6 meses</span>
          <h2><BarChart3 size={16} /> Cotizado por mes</h2>
          <p>Monto total de las cotizaciones de cada mes, en dólares. Una cotización no es una venta.</p>
          <svg className="crm-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Gráfico de montos cotizados por mes">
            <line x1={left} x2={W - left} y1={top + plotH} y2={top + plotH} stroke="currentColor" opacity=".15" />
            {data.bars.map((bar, index) => {
              const x = left + slot * index + (slot - barW) / 2
              const h = (bar.usd / max) * plotH
              const y = top + plotH - h
              return (
                <g key={bar.key} className="crm-bar" style={{ animationDelay: `${index * 55}ms` }}>
                  <title>{`${bar.label}: ${usd(bar.usd)} en ${bar.count} cotizaciones`}</title>
                  <rect x={x} y={y} width={barW} height={Math.max(h, bar.usd > 0 ? 2 : 0)} rx="5" fill="#ed1c24" opacity={bar.usd > 0 ? 1 : 0.15} />
                  {bar.usd > 0 && <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">{compact(bar.usd)}</text>}
                  <text x={x + barW / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="currentColor" opacity=".7">{bar.label}</text>
                </g>
              )
            })}
          </svg>
          <ul className="crm-chart-list" aria-label="Montos cotizados por mes">
            {data.bars.map((bar) => <li key={bar.key}><span>{bar.label}</span><b>{bar.usd > 0 ? usd(bar.usd) : '—'}</b><small>{bar.count} cotiz.</small></li>)}
          </ul>
        </section>
        <StatusDonut quotes={quotes} />
      </div>
      <TopProducts quotes={quotes} />
    </>
  )
}
