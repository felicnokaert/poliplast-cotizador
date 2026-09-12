import { useEffect, useMemo, useState } from 'react'
import { applyCostImport, applyPriceImport, buildCostImportRows, buildPriceImportRows, downloadCsv, loadAdminOverview, previewAdminImport, revertCostImport, revertPriceImport, rowsToCsv, type AdminImportPreview, type AdminOverview, type PriceImportKind } from '../lib/admin'

export function AdminPanel() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [preview, setPreview] = useState<AdminImportPreview[]>([])
  const [previewFile, setPreviewFile] = useState('')
  const [previewContent, setPreviewContent] = useState('')
  const [confirming, setConfirming] = useState<'costos' | 'precios' | null>(null)
  const [applying, setApplying] = useState(false)
  const [result, setResult] = useState<{ jobId: string; applied: number; kind: 'costos' | 'precios' } | null>(null)
  const [priceKind, setPriceKind] = useState<PriceImportKind>('consumidor_final')
  const [priceListName, setPriceListName] = useState(`Actualización ${new Date().toLocaleDateString('es-AR')}`)
  const [priceCurrency, setPriceCurrency] = useState<'ARS' | 'USD'>('USD')
  const [priceValidFrom, setPriceValidFrom] = useState(new Date().toISOString().slice(0, 10))
  useEffect(() => { loadAdminOverview().then(setData).catch((reason) => setError(reason instanceof Error ? reason.message : 'No se pudo cargar Administración')) }, [])
  const currentCosts = useMemo(() => data?.costs.filter((cost) => cost.status === 'confirmado' && (!cost.valid_until || new Date(cost.valid_until) >= new Date())) ?? [], [data])
  const previewSummary = useMemo(() => ({ changes: preview.filter((row) => row.status === 'cambio').length, errors: preview.filter((row) => row.status === 'error').length, unchanged: preview.filter((row) => row.status === 'sin_cambios').length }), [preview])

  const inspectFile = async (file?: File) => {
    if (!file || !data) return
    const content = await file.text()
    setPreviewFile(file.name); setPreviewContent(content); setResult(null)
    setPreview(previewAdminImport(content, data.catalog))
  }

  const costRows = useMemo(() => buildCostImportRows(preview), [preview])
  const priceRows = useMemo(() => buildPriceImportRows(preview, priceKind), [preview, priceKind])
  const applyCosts = async () => {
    setApplying(true); setActionError('')
    try { const applied = await applyCostImport(previewFile, previewContent, costRows); setResult({ jobId: applied.job_id, applied: applied.applied, kind: 'costos' }); setConfirming(null); setData(await loadAdminOverview()) }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : 'No se pudo aplicar el lote de costos.') }
    finally { setApplying(false) }
  }
  const applyPrices = async () => {
    setApplying(true); setActionError('')
    try { const applied = await applyPriceImport({ fileName: previewFile, content: previewContent, rows: priceRows, kind: priceKind, listName: priceListName, currency: priceCurrency, vatRate: .21, validFrom: priceValidFrom }); setResult({ jobId: applied.job_id, applied: applied.applied, kind: 'precios' }); setConfirming(null); setData(await loadAdminOverview()) }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : 'No se pudo aplicar la lista de precios.') }
    finally { setApplying(false) }
  }
  const revertLast = async () => {
    if (!result) return
    setApplying(true); setActionError('')
    try { if (result.kind === 'costos') await revertCostImport(result.jobId); else await revertPriceImport(result.jobId); setResult(null); setData(await loadAdminOverview()) }
    catch (reason) { setActionError(reason instanceof Error ? reason.message : 'No se pudo revertir el lote.') }
    finally { setApplying(false) }
  }

  if (error) return <main className="admin-page"><div className="empty-state error">{error}</div></main>
  if (!data) return <main className="admin-page"><div className="empty-state">Verificando permisos y datos…</div></main>
  if (!data.isAdmin) return <main className="admin-page"><div className="empty-state"><h2>Acceso administrativo</h2><p className="muted">Tu cuenta puede cotizar, pero no tiene permiso para leer costos ni importaciones.</p></div></main>

  return <main className="admin-page">
    <div className="page-intro"><span className="eyebrow">Solo administradores</span><h1>Control comercial</h1><p className="muted">Costos, stock aprobado e importaciones permanecen separados de la vista del vendedor.</p></div>
    {actionError && <div className="empty-state error"><strong>No se aplicaron cambios.</strong><p>{actionError}</p></div>}
    <div className="admin-metrics"><article><span>Revisiones de costo</span><strong>{data.costs.length}</strong><small>{currentCosts.length} vigentes/confirmadas</small></article><article><span>SKU con stock aprobado</span><strong>{data.inventory.length}</strong><small>Con fecha de último conteo</small></article><article><span>Últimos lotes</span><strong>{data.imports.length}</strong><small>Trazabilidad de importación</small></article></div>
    <section className="admin-section stack"><div><h2>Stock por depósito</h2><p className="muted">El stock no se edita como un precio: se registra por depósito, se cuenta y luego se aprueba. Una cotización solo consulta disponibilidad; nunca descuenta mercadería.</p></div><div className="location-grid">{data.locations.filter((location) => location.active).length === 0 ? <span className="pending-control">Todavía no hay depósitos activos configurados.</span> : data.locations.filter((location) => location.active).map((location) => { const balances = data.inventory.filter((item) => item.location_id === location.id); return <article key={location.id}><span>{location.code}</span><strong>{location.name}</strong><small>{balances.length} SKU con saldo aprobado</small></article> })}</div><p className="muted">Próximo flujo: exportar plantilla por depósito → cargar conteo → revisar diferencias → aprobar saldo. Villa Domínico y Mar del Plata deben mantenerse separados.</p></section>
    <section className="admin-section"><div><h2>Exportación segura</h2><p className="muted">Descargá una matriz editable por SKU con precios, costos y stock. Solo una cuenta administradora puede verla.</p></div><div className="admin-actions"><button disabled={!data.catalog.length} onClick={() => downloadCsv(`catalogo-admin-poliplast-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(data.catalog))}>Exportar matriz completa</button><button className="secondary" disabled={!data.costs.length} onClick={() => downloadCsv(`costos-poliplast-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(data.costs))}>Solo costos</button></div></section>
    <section className="admin-section stack"><div><h2>Actualización masiva controlada</h2><p className="muted">Editá la matriz exportada y cargala acá. Primero se valida; costos y precios se aplican en lotes separados.</p></div><label className="csv-drop">Seleccionar CSV<input type="file" accept=".csv,text/csv" onChange={(event) => inspectFile(event.target.files?.[0])} /></label>{preview.length > 0 && <div className="import-preview"><div className="import-summary"><strong>{previewFile}</strong><span className="change">{previewSummary.changes} cambios</span><span className="error">{previewSummary.errors} errores</span><span>{previewSummary.unchanged} sin cambios</span></div>{previewSummary.errors > 0 && <p className="quote-warning">El archivo está bloqueado: corregí todos los errores antes de aplicar.</p>}<div className="preview-rows">{preview.filter((row) => row.status !== 'sin_cambios').slice(0, 50).map((row) => <div key={`${row.row}-${row.sku}`} className={`preview-row ${row.status}`}><strong>Fila {row.row} · {row.sku || 'sin SKU'}</strong><span>{[...row.errors, ...row.changes].join(' · ')}</span></div>)}</div><div className="price-import-settings"><label>Lista a actualizar<select value={priceKind} onChange={(event) => setPriceKind(event.target.value as PriceImportKind)}><option value="consumidor_final">Consumidor final</option><option value="mayorista">Mayorista</option></select></label><label>Nombre de versión<input value={priceListName} onChange={(event) => setPriceListName(event.target.value)} /></label><label>Moneda<select value={priceCurrency} onChange={(event) => setPriceCurrency(event.target.value as 'ARS' | 'USD')}><option>USD</option><option>ARS</option></select></label><label>Vigente desde<input type="date" value={priceValidFrom} onChange={(event) => setPriceValidFrom(event.target.value)} /></label></div><div className="admin-actions"><button disabled={previewSummary.errors > 0 || !costRows.length || applying} onClick={() => setConfirming('costos')}>Revisar {costRows.length} costos</button><button disabled={previewSummary.errors > 0 || !priceRows.length || !priceListName.trim() || applying} onClick={() => setConfirming('precios')}>Revisar {priceRows.length} precios {priceKind === 'mayorista' ? 'mayoristas' : 'CF'}</button></div><p className="muted">El stock queda separado: requiere depósito, conteo y aprobación.</p></div>}</section>
    {result && <section className="admin-section"><div><h2>Lote aplicado</h2><p className="muted">{result.applied} revisiones nuevas. Identificador: {result.jobId}</p></div><button className="secondary" disabled={applying} onClick={revertLast}>Revertir este lote</button></section>}
    <section className="admin-section stack"><div><h2>Estado de gobierno</h2><p className="muted">La edición masiva exige carga, vista previa, validación y confirmación. Esta versión no sobrescribe costos ni precios silenciosamente.</p></div><div className="governance-grid"><span>✓ Costos con aplicación reversible</span><span>✓ Precios CF/mayorista versionados</span><span>✓ SKU normalizado y único</span><span>✓ Lotes auditables</span><span>✓ Sin borrado directo</span><span className="pending-control">Pendiente: conteos de stock por depósito con aprobación</span></div></section>
    {confirming && <div className="admin-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-title"><div className="admin-confirm"><h2 id="import-title">Confirmar {confirming === 'costos' ? 'nuevos costos' : 'nueva lista de precios'}</h2><p>Se aplicarán <strong>{confirming === 'costos' ? costRows.length : priceRows.length} cambios</strong>. La versión anterior no se borra y el lote podrá revertirse.</p>{confirming === 'precios' && <p className="muted">{priceKind === 'mayorista' ? 'Mayorista' : 'Consumidor final'} · {priceListName} · {priceCurrency} · IVA incluido 21%</p>}<p className="muted">Archivo: {previewFile}</p><div className="admin-actions"><button className="secondary" disabled={applying} onClick={() => setConfirming(null)}>Cancelar</button><button disabled={applying} onClick={confirming === 'costos' ? applyCosts : applyPrices}>{applying ? 'Aplicando…' : confirming === 'costos' ? 'Aplicar costos' : 'Crear lista y aplicar'}</button></div></div></div>}
  </main>
}
