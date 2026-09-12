import { useEffect, useMemo, useState } from 'react'
import { downloadCsv, loadAdminOverview, rowsToCsv, type AdminOverview } from '../lib/admin'

export function AdminPanel() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { loadAdminOverview().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo cargar Administración')) }, [])
  const currentCosts = useMemo(() => data?.costs.filter((cost) => cost.status === 'confirmado' && (!cost.valid_until || new Date(cost.valid_until) >= new Date())) ?? [], [data])

  if (error) return <main className="admin-page"><div className="empty-state error">{error}</div></main>
  if (!data) return <main className="admin-page"><div className="empty-state">Verificando permisos y datos…</div></main>
  if (!data.isAdmin) return <main className="admin-page"><div className="empty-state"><h2>Acceso administrativo</h2><p className="muted">Tu cuenta puede cotizar, pero no tiene permiso para leer costos ni importaciones.</p></div></main>

  return <main className="admin-page">
    <div className="page-intro"><span className="eyebrow">Solo administradores</span><h1>Control comercial</h1><p className="muted">Costos, stock aprobado e importaciones permanecen separados de la vista del vendedor.</p></div>
    <div className="admin-metrics"><article><span>Revisiones de costo</span><strong>{data.costs.length}</strong><small>{currentCosts.length} vigentes/confirmadas</small></article><article><span>SKU con stock aprobado</span><strong>{data.inventory.length}</strong><small>Con fecha de último conteo</small></article><article><span>Últimos lotes</span><strong>{data.imports.length}</strong><small>Trazabilidad de importación</small></article></div>
    <section className="admin-section"><div><h2>Exportación segura</h2><p className="muted">Los costos solo se exportan desde una cuenta administradora. El archivo no modifica la base.</p></div><button disabled={!data.costs.length} onClick={() => downloadCsv(`costos-poliplast-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(data.costs))}>Exportar costos CSV</button></section>
    <section className="admin-section stack"><div><h2>Estado de gobierno</h2><p className="muted">La edición masiva exige carga, vista previa, validación y confirmación. Esta versión no sobrescribe costos ni precios silenciosamente.</p></div><div className="governance-grid"><span>✓ Costos protegidos por RLS</span><span>✓ SKU normalizado y único</span><span>✓ Lotes auditables</span><span>✓ Sin borrado directo</span><span className="pending-control">Pendiente: editor/importador con vista previa</span></div></section>
  </main>
}
