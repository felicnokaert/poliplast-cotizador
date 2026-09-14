import { useEffect, useMemo, useState } from "react";
import { applyCostImport, applyPriceImport, buildCostImportRows, buildPriceImportRows, downloadCsv, loadAdminOverview, previewAdminImport, revertCostImport, revertPriceImport, rowsToCsv, type AdminImportPreview, type AdminOverview, type PriceImportKind } from "../lib/admin";
import { CommercialPolicyAdmin } from "./CommercialPolicyAdmin";
import { CatalogManagementAdmin } from "./CatalogManagementAdmin";

export function AdminPanel({ userEmail = "" }: { userEmail?: string }) {
  const [section, setSection] = useState<"catalogo" | "politicas" | "masivo" | "stock">("catalogo");
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [preview, setPreview] = useState<AdminImportPreview[]>([]);
  const [previewFile, setPreviewFile] = useState("");
  const [previewContent, setPreviewContent] = useState("");
  const [confirming, setConfirming] = useState<"costos" | "precios" | null>(null);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{
    jobId: string;
    applied: number;
    kind: "costos" | "precios";
  } | null>(null);
  const [priceKind, setPriceKind] = useState<PriceImportKind>("consumidor_final");
  const [priceListName, setPriceListName] = useState(`Actualización ${new Date().toLocaleDateString("es-AR")}`);
  const priceCurrency = "USD" as const;
  const [priceValidFrom, setPriceValidFrom] = useState(new Date().toISOString().slice(0, 10));
  useEffect(() => {
    loadAdminOverview()
      .then(setData)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "No se pudo cargar Administración"));
  }, []);
  const currentCosts = useMemo(() => data?.costs.filter((cost) => cost.status === "confirmado" && (!cost.valid_until || new Date(cost.valid_until) >= new Date())) ?? [], [data]);
  const previewSummary = useMemo(
    () => ({
      changes: preview.filter((row) => row.status === "cambio").length,
      errors: preview.filter((row) => row.status === "error").length,
      unchanged: preview.filter((row) => row.status === "sin_cambios").length,
    }),
    [preview],
  );

  const inspectFile = async (file?: File) => {
    if (!file || !data) return;
    const content = await file.text();
    setPreviewFile(file.name);
    setPreviewContent(content);
    setResult(null);
    setPreview(previewAdminImport(content, data.catalog));
  };

  const costRows = useMemo(() => buildCostImportRows(preview), [preview]);
  const priceRows = useMemo(() => buildPriceImportRows(preview, priceKind), [preview, priceKind]);
  const applyCosts = async () => {
    setApplying(true);
    setActionError("");
    try {
      const applied = await applyCostImport(previewFile, previewContent, costRows);
      setResult({
        jobId: applied.job_id,
        applied: applied.applied,
        kind: "costos",
      });
      setConfirming(null);
      setData(await loadAdminOverview());
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "No se pudo aplicar el lote de costos.");
    } finally {
      setApplying(false);
    }
  };
  const applyPrices = async () => {
    setApplying(true);
    setActionError("");
    try {
      const applied = await applyPriceImport({
        fileName: previewFile,
        content: previewContent,
        rows: priceRows,
        kind: priceKind,
        listName: priceListName,
        currency: priceCurrency,
        vatRate: 0.21,
        validFrom: priceValidFrom,
      });
      setResult({
        jobId: applied.job_id,
        applied: applied.applied,
        kind: "precios",
      });
      setConfirming(null);
      setData(await loadAdminOverview());
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "No se pudo aplicar la lista de precios.");
    } finally {
      setApplying(false);
    }
  };
  const revertLast = async () => {
    if (!result) return;
    setApplying(true);
    setActionError("");
    try {
      if (result.kind === "costos") await revertCostImport(result.jobId);
      else await revertPriceImport(result.jobId);
      setResult(null);
      setData(await loadAdminOverview());
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "No se pudo revertir el lote.");
    } finally {
      setApplying(false);
    }
  };
  const reload = async () => setData(await loadAdminOverview());

  if (error)
    return (
      <main className="admin-page">
        <div className="empty-state error">{error}</div>
      </main>
    );
  if (!data)
    return (
      <main className="admin-page">
        <div className="empty-state">Verificando permisos y datos…</div>
      </main>
    );
  if (!data.isAdmin)
    return (
      <main className="admin-page">
        <div className="empty-state">
          <h2>Acceso administrativo</h2>
          <p className="muted">Tu cuenta puede cotizar, pero no tiene permiso para leer costos ni importaciones.</p>
        </div>
      </main>
    );

  return (
    <main className="admin-page">
      <div className="page-intro">
        <span className="eyebrow">Solo administradores</span>
        <h1>Administración</h1>
        <p className="muted">Productos, precios y reglas comerciales organizados en un solo lugar.</p>
      </div>
      <nav className="admin-tabs" aria-label="Secciones de administración">
        <button className={section === "catalogo" ? "active" : ""} onClick={() => setSection("catalogo")}>
          Productos y precios
        </button>
        <button className={section === "politicas" ? "active" : ""} onClick={() => setSection("politicas")}>
          Políticas y pagos
        </button>
        <button className={section === "masivo" ? "active" : ""} onClick={() => setSection("masivo")}>
          Importar / exportar
        </button>
        <button className={section === "stock" ? "active" : ""} onClick={() => setSection("stock")}>
          Stock
        </button>
      </nav>
      {actionError && (
        <div className="empty-state error">
          <strong>No se aplicaron cambios.</strong>
          <p>{actionError}</p>
        </div>
      )}
      {section === "catalogo" && <CatalogManagementAdmin catalog={data.catalog} onChanged={reload} />}
      {section === "politicas" && <CommercialPolicyAdmin catalog={data.catalog} userEmail={userEmail} />}
      {section === "stock" && (
        <>
          <div className="admin-metrics">
            <article>
              <span>SKU con stock aprobado</span>
              <strong>{data.inventory.length}</strong>
              <small>Con fecha de último conteo</small>
            </article>
            <article>
              <span>Depósitos activos</span>
              <strong>{data.locations.filter((location) => location.active).length}</strong>
              <small>Separados por ubicación</small>
            </article>
          </div>
          <section className="admin-section stack">
            <div>
              <h2>Stock por depósito</h2>
              <p className="muted">Los conteos se cargan en la app de stock y se vinculan al catálogo por SKU. La cotización sólo consulta el último saldo cerrado.</p>
            </div>
            <div className="admin-actions">
              <a className="button-link" href="https://poliplast-conteo-stock.netlify.app/" target="_blank" rel="noreferrer">Abrir app de conteo</a>
            </div>
            <div className="location-grid">
              {data.locations.filter((location) => location.active).length === 0 ? (
                <span className="pending-control">Todavía no hay depósitos activos configurados.</span>
              ) : (
                data.locations
                  .filter((location) => location.active)
                  .map((location) => {
                    const balances = data.inventory.filter((item) => item.location_id === location.id);
                    return (
                      <article key={location.id}>
                        <span>{location.code}</span>
                        <strong>{location.name}</strong>
                        <small>{balances.length} SKU con saldo aprobado</small>
                      </article>
                    );
                  })
              )}
            </div>
            <p className="muted">Vinculación prevista: depósito + SKU + último conteo cerrado. Los conteos en curso no modifican la disponibilidad comercial.</p>
          </section>
        </>
      )}
      {section === "masivo" && (
        <>
          <div className="admin-metrics">
            <article>
              <span>Revisiones de costo</span>
              <strong>{data.costs.length}</strong>
              <small>{currentCosts.length} vigentes</small>
            </article>
            <article>
              <span>Últimos lotes</span>
              <strong>{data.imports.length}</strong>
              <small>Trazabilidad</small>
            </article>
          </div>
          <section className="admin-section">
            <div>
              <h2>Exportar</h2>
              <p className="muted">Descargá una matriz editable por SKU.</p>
            </div>
            <div className="admin-actions">
              <button disabled={!data.catalog.length} onClick={() => downloadCsv(`catalogo-admin-poliplast-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(data.catalog))}>
                Matriz completa
              </button>
              <button className="secondary" disabled={!data.costs.length} onClick={() => downloadCsv(`costos-poliplast-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(data.costs))}>
                Sólo costos
              </button>
            </div>
          </section>
          <section className="admin-section stack">
            <div>
              <h2>Importar cambios</h2>
              <p className="muted">Primero se valida; costos y precios se aplican por separado.</p>
            </div>
            <label className="csv-drop">
              Seleccionar CSV
              <input type="file" accept=".csv,text/csv" onChange={(event) => inspectFile(event.target.files?.[0])} />
            </label>
            {preview.length > 0 && (
              <div className="import-preview">
                <div className="import-summary">
                  <strong>{previewFile}</strong>
                  <span className="change">{previewSummary.changes} cambios</span>
                  <span className="error">{previewSummary.errors} errores</span>
                  <span>{previewSummary.unchanged} sin cambios</span>
                </div>
                {previewSummary.errors > 0 && <p className="quote-warning">Corregí todos los errores antes de aplicar.</p>}
                <div className="preview-rows">
                  {preview
                    .filter((row) => row.status !== "sin_cambios")
                    .slice(0, 50)
                    .map((row) => (
                      <div key={`${row.row}-${row.sku}`} className={`preview-row ${row.status}`}>
                        <strong>
                          Fila {row.row} · {row.sku || "sin SKU"}
                        </strong>
                        <span>{[...row.errors, ...row.changes].join(" · ")}</span>
                      </div>
                    ))}
                </div>
                <div className="price-import-settings">
                  <label>
                    Lista
                    <select value={priceKind} onChange={(event) => setPriceKind(event.target.value as PriceImportKind)}>
                      <option value="consumidor_final">Consumidor final</option>
                      <option value="mayorista">Mayorista</option>
                    </select>
                  </label>
                  <label>
                    Versión
                    <input value={priceListName} onChange={(event) => setPriceListName(event.target.value)} />
                  </label>
                  <label>
                    Moneda
                    <strong className="fixed-currency">USD</strong>
                  </label>
                  <label>
                    Desde
                    <input type="date" value={priceValidFrom} onChange={(event) => setPriceValidFrom(event.target.value)} />
                  </label>
                </div>
                <div className="admin-actions">
                  <button disabled={previewSummary.errors > 0 || !costRows.length || applying} onClick={() => setConfirming("costos")}>
                    Revisar {costRows.length} costos
                  </button>
                  <button disabled={previewSummary.errors > 0 || !priceRows.length || !priceListName.trim() || applying} onClick={() => setConfirming("precios")}>
                    Revisar {priceRows.length} precios
                  </button>
                </div>
              </div>
            )}
          </section>
          {result && (
            <section className="admin-section">
              <div>
                <h2>Lote aplicado</h2>
                <p className="muted">
                  {result.applied} revisiones · {result.jobId}
                </p>
              </div>
              <button className="secondary" disabled={applying} onClick={revertLast}>
                Revertir lote
              </button>
            </section>
          )}
        </>
      )}
      {confirming && (
        <div className="admin-confirm-backdrop" role="dialog" aria-modal="true" aria-labelledby="import-title">
          <div className="admin-confirm">
            <h2 id="import-title">Confirmar {confirming === "costos" ? "nuevos costos" : "nueva lista de precios"}</h2>
            <p>
              Se aplicarán <strong>{confirming === "costos" ? costRows.length : priceRows.length} cambios</strong>. La versión anterior no se borra y el lote podrá revertirse.
            </p>
            {confirming === "precios" && (
              <p className="muted">
                {priceKind === "mayorista" ? "Mayorista" : "Consumidor final"} · {priceListName} · {priceCurrency} · IVA incluido 21%
              </p>
            )}
            <p className="muted">Archivo: {previewFile}</p>
            <div className="admin-actions">
              <button className="secondary" disabled={applying} onClick={() => setConfirming(null)}>
                Cancelar
              </button>
              <button disabled={applying} onClick={confirming === "costos" ? applyCosts : applyPrices}>
                {applying ? "Aplicando…" : confirming === "costos" ? "Aplicar costos" : "Crear lista y aplicar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
