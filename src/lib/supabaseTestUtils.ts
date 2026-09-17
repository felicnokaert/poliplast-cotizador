import { vi } from 'vitest'

/**
 * Builder encadenable para simular respuestas de Supabase en tests, sin tocar
 * la base real. Cada método de la cadena (`select`, `update`, `eq`, etc.)
 * devuelve el mismo builder; `single()` y el propio builder (via `then`)
 * resuelven al resultado configurado.
 */
export function makeQueryResult(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = ['select', 'update', 'insert', 'upsert', 'eq', 'limit', 'order', 'range', 'delete', 'in']
  for (const method of chain) builder[method] = vi.fn(() => builder)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve)
  return builder
}
