export interface ExchangeRateResult { rate: number; source: string; fetchedAt: string; quotationDate?: string }

export function parseOfficialDollar(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const candidate = payload as Record<string, unknown>
  const value = Number(candidate.venta ?? candidate.precio ?? candidate.value)
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
}

export function parseBnaDollar(payload: unknown): ExchangeRateResult | null {
  if (!payload || typeof payload !== 'object') return null
  const candidate = payload as Record<string, unknown>
  const rate = Number(candidate.rate)
  if (!Number.isFinite(rate) || rate <= 0) return null
  const quotationDate = candidate.quotationDate ? String(candidate.quotationDate) : undefined
  const source = String(candidate.source || 'BNA · Dólar billete vendedor')
  return {
    rate: Math.round(rate * 100) / 100,
    source: quotationDate ? `${source} · cotización ${quotationDate}` : source,
    fetchedAt: String(candidate.fetchedAt || new Date().toISOString()),
    quotationDate,
  }
}

export async function fetchOfficialDollar(): Promise<ExchangeRateResult> {
  try {
    const response = await fetch('/api/bna-dollar')
    if (response.ok) {
      const result = parseBnaDollar(await response.json())
      if (result) return result
    }
  } catch { /* En Vite local el endpoint puede no existir: usamos un respaldo. */ }

  const fallback = await fetch('https://dolarapi.com/v1/dolares/oficial')
  if (!fallback.ok) throw new Error('No se pudo consultar el dólar vendedor')
  const rate = parseOfficialDollar(await fallback.json())
  if (!rate) throw new Error('La fuente no devolvió una cotización válida')
  return { rate, source: 'DolarAPI · Oficial venta (respaldo)', fetchedAt: new Date().toISOString() }
}
