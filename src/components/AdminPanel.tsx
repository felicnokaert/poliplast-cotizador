import { useEffect, useMemo, useState } from 'react'
import { downloadCsv, loadAdminOverview, previewAdminImport, rowsToCsv, type AdminImportPreview, type AdminOverview } from '../lib/admin'

export function AdminPanel() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<AdminImportPreview[]>([])
  const [previewFile, setPreviewFile] = useState('')
  useEffect(() => { loadAdminOverview().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo cargar Administración')) }, [])
  const currentCosts = useMemo(() => data?.costs.filter((cost) => cost.status === 'confirmado' && (!cost.valid_until || new Date(cost.valid_until) >= new Date())) ?? [], [data])
  const previewSummary = useMemo(() => ({ changes: preview.filter((row) => row.status === 'cambio').length, errors: preview.filter((row) => row.status === 'error').length, unchanged: preview.filter((row) => row.status === 'sin_cambios').length }), [preview])

  const inspectFile = async (file?: File) => {
    if (!file || !data) return
    setPreviewFile(file.name)
    setPreview(previewAdminImport(await file.text(), data.catalog))
  }

  if (error) return <main className="admin-page"><div className="empty-state error">{error}</div></main>
  if (!data) return <main className="admin-page"><div className="empty-state">Verificando permisos y datos…</div></main>
  if (!data.isAdmin) return <main className="admin-page"><div className="empty-state"><h2>Acceso administrativo</h2><p className="muted">Tu cuenta puede cotizar, pero no tiene permiso para leer costos ni importaciones.</p></div></main>

  return <main className="admin-page">
    <div className="page-intro"><span className="eyebrow">Solo administradores</span><h1>Control comercial</h1><p className="muted">Costos, stock aprobado e importaciones permanecen separados de la vista del vendedor.</p></div>
    <div className="admin-metrics"><article><span>Revisiones de costo</span><strong>{data.costs.length}</strong><small>{currentCosts.length} vigentes/confirmadas</small></article><article><span>SKU con stock aprobado</span><strong>{data.inventory.length}</strong><small>Con fecha de último conteo</small></article><article><span>Últimos lotes</span><strong>{data.imports.length}</strong><small>Trazabilidad de importación</small></article></div>
    <section className="admin-section"><div><h2>Exportación segura</h2><p className="muted">Descargá una matriz editable por SKU con precios, costos y stock. Solo una cuenta administradora puede verla.</p></div><div className="admin-actions"><button disabled={!data.catalog.length} onClick={() => downloadCsv(`catalogo-admin-poliplast-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(data.catalog))}>Exportar matriz completa</button><button className="secondary" disabled={!data.costs.length} onClick={() => downloadCsv(`costos-poliplast-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(data.costs))}>Solo costos</button></div></section>
    <section className="admin-section stack"><div><h2>Vista previa de actualización masiva</h2><p className="muted">Podés editar la matriz exportada y cargarla acá. Esta etapa analiza el archivo: no escribe ni reemplaza nada.</p></div><label className="csv-drop">Seleccionar CSV<input type="file" accept=".csv,text/csv" onChange={(event) => inspectFile(event.target.files?.[0])} /></label>{preview.length > 0 && <div className="import-preview"><div className="import-summary"><strong>{previewFile}</strong><span className="change">{previewSummary.changes} cambios</span><span className="error">{previewSummary.errors} errores</span><span>{previewSummary.unchanged} sin cambios</span></div>{previewSummary.errors > 0 && <p className="quote-warning">El archivo está bloqueado: corregí todos los errores antes de aplicar.</p>}<div className="preview-rows">{preview.filter((row) => row.status !== 'sin_cambios').slice(0, 50).map((row) => <div key={`${row.row}-${row.sku}`} className={`preview-row ${row.status}`}><strong>Fila {row.row} · {row.sku || 'sin SKU'}</strong><span>{[...row.errors, ...row.changes].join(' · ')}</span></div>)}</div><p className="muted">Vista previa únicamente. La aplicación reversible será el próximo paso y exigirá confirmación explícita.</p></div>}</section>
    <section className="admin-section stack"><div><h2>Estado de gobierno</h2><p className="muted">La edición masiva exige carga, vista previa, validación y confirmación. Esta versión no sobrescribe costos ni precios silenciosamente.</p></div><div className="governance-grid"><span>✓ Costos protegidos por RLS</span><span>✓ SKU normalizado y único</span><span>✓ Lotes auditables</span><span>✓ Sin borrado directo</span><span className="pending-control">Pendiente: editor/importador con vista previa</span></div></section>
  </main>
}
