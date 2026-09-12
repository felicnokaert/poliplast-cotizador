export interface ExchangeRateResult { rate: number; source: string; fetchedAt: string }

export function parseOfficialDollar(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null
  const candidate = payload as Record<string, unknown>
  const value = Number(candidate.venta ?? candidate.precio ?? candidate.value)
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null
}

export async function fetchOfficialDollar(): Promise<ExchangeRateResult> {
  const response = await fetch('https://dolarapi.com/v1/dolares/oficial')
  if (!response.ok) throw new Error('No se pudo consultar el dólar oficial')
  const rate = parseOfficialDollar(await response.json())
  if (!rate) throw new Error('La fuente no devolvió una cotización válida')
  return { rate, source: 'DolarAPI · Oficial venta', fetchedAt: new Date().toISOString() }
}
