import { useMemo } from 'react'
import { BarChart3 } from 'lucide-react'
import { quoteInsights } from '../lib/quoteInsights'
import type { SavedQuote } from '../lib/quote'
import type { CommercialRule } from '../types/commercialRules'

const usd = (value: number) => `US$ ${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(value)}`
const compact = (value: number) => (value >= 1000 ? `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value / 1000)}k` : String(Math.round(value)))

// Tarjetas de números y gráfico de barras con el mismo estilo que Ventas en el CRM (SalesHistory.jsx).
export function QuoteInsights({ quotes, rules }: { quotes: SavedQuote[]; rules: CommercialRule[] }) {
  const data = useMemo(() => quoteInsights(quotes, rules), [quotes, rules])
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
              <g key={bar.key} className="crm-bar">
                <title>{`${bar.label}: ${usd(bar.usd)} en ${bar.count} cotizaciones`}</title>
                <rect x={x} y={y} width={barW} height={Math.max(h, bar.usd > 0 ? 2 : 0)} rx="5" fill="#ed1c24" opacity={bar.usd > 0 ? 1 : 0.15} />
                {bar.usd > 0 && <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize="10" fontWeight="700" fill="currentColor">{compact(bar.usd)}</text>}
                <text x={x + barW / 2} y={H - 9} textAnchor="middle" fontSize="11" fill="currentColor" opacity=".7">{bar.label}</text>
              </g>
            )
          })}
        </svg>
      </section>
    </>
  )
}
