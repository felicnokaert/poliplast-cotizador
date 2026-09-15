import { useMemo, useState } from "react";
import { applyCatalogActiveReview, downloadCsv, previewCatalogActiveReview, rowsToCsv, setCatalogVariantActive, setCatalogVariantPrice, updateCatalogClassification, type AdminCatalogRow, type CatalogActiveReviewPreview, type PriceImportKind } from "../lib/admin";
import { buildCatalogReview } from "../lib/catalogReview";

export function CatalogManagementAdmin({ catalog, onChanged }: { catalog: AdminCatalogRow[]; onChanged: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { family: string; subfamily: string }>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [activeReview, setActiveReview] = useState<{ fileName: string; preview: CatalogActiveReviewPreview[] } | null>(null);
  const [priceEditor, setPriceEditor] = useState<{
    variantId: string;
    kind: PriceImportKind;
    amount: string;
    reason: string;
  } | null>(null);
  const normalized = search.trim().toLowerCase();
  const rows = useMemo(() => (normalized.length < 3 ? [] : catalog.filter((row) => (includeInactive || row.active) && [row.sku, row.producto, row.variante, row.familia, row.subfamilia].some((value) => value.toLowerCase().includes(normalized))).slice(0, 60)), [catalog, includeInactive, normalized]);
  const draftFor = (row: AdminCatalogRow) =>
    drafts[row.product_id] ?? {
      family: row.familia,
      subfamily: row.subfamilia,
    };
  const refresh = async (text: string) => {
    setMessage(text);
    await onChanged();
  };
  return (
    <section className="admin-section stack catalog-management">
      <div>
        <h2>Productos, categorías y precios</h2>
        <p className="muted">Buscá por nombre o SKU. Editá precios unitarios en USD y ocultá presentaciones que no quieras ofrecer.</p>
      </div>
      <div className="catalog-admin-search">
        <input type="search" aria-label="Buscar producto para administrar" placeholder="Escribí al menos 3 letras o un SKU" value={search} onChange={(event) => setSearch(event.target.value)} />
        <label>
          <input type="checkbox" checked={includeInactive} onChange={(event) => setIncludeInactive(event.target.checked)} /> Ver desactivados
        </label>
        <button className="secondary" onClick={() => {
          const review = buildCatalogReview(catalog).map(({ product_id, variant_id, ...item }) => ({ ...item, variant_id, product_id }));
          downloadCsv(`revision-catalogo-${new Date().toISOString().slice(0, 10)}.csv`, rowsToCsv(review));
          setMessage(`${review.length} filas exportadas para revisión. No se modificó el catálogo.`);
        }}>Exportar dudas CSV</button>
        <label className="secondary file-button">
          Importar CSV revisado
          <input
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const preview = previewCatalogActiveReview(await file.text(), catalog);
              setActiveReview({ fileName: file.name, preview });
              const changes = preview.filter((item) => item.status === "cambio").length;
              const errors = preview.filter((item) => item.status === "error").length;
              setMessage(`${file.name}: ${changes} cambios de ACTIVE y ${errors} errores.`);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      {activeReview && (
        <div className="catalog-review-import">
          <div>
            <strong>{activeReview.fileName}</strong>
            <span>{activeReview.preview.filter((item) => item.status === "cambio").length} cambios · {activeReview.preview.filter((item) => item.status === "sin_cambios").length} sin cambios · {activeReview.preview.filter((item) => item.status === "error").length} errores</span>
          </div>
          {activeReview.preview.some((item) => item.status === "error") && (
            <ul>{activeReview.preview.filter((item) => item.status === "error").slice(0, 8).map((item) => <li key={`${item.row}-${item.sku}`}>Fila {item.row} · {item.sku || "sin SKU"}: {item.errors.join("; ")}</li>)}</ul>
          )}
          <div className="admin-actions">
            <button
              disabled={busy === "active-review" || activeReview.preview.some((item) => item.status === "error") || !activeReview.preview.some((item) => item.status === "cambio")}
              onClick={async () => {
                setBusy("active-review");
                try {
                  const applied = await applyCatalogActiveReview(activeReview.preview);
                  setActiveReview(null);
                  await refresh(`${applied} variantes actualizadas desde el CSV.`);
                } catch (error) {
                  setMessage(error instanceof Error ? error.message : "No se pudo aplicar el CSV.");
                } finally {
                  setBusy("");
                }
              }}
            >Aplicar ACTIVE</button>
            <button className="secondary" onClick={() => setActiveReview(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {normalized.length < 3 ? (
        <p className="pending-control">Ingresá al menos 3 caracteres.</p>
      ) : rows.length === 0 ? (
        <p className="pending-control">No se encontraron productos.</p>
      ) : (
        <div className="catalog-admin-list">
          {rows.map((row) => {
            const draft = draftFor(row);
            const editingPrice = priceEditor?.variantId === row.variant_id;
            return (
              <article key={row.variant_id} className={!row.active ? "inactive" : ""}>
                <div className="catalog-admin-identity">
                  <strong>{row.producto}</strong>
                  <span>
                    {row.sku} · {row.variante || row.unidad}
                  </span>
                  <small>
                    Minorista {row.precio_consumidor_final === "" ? "pendiente" : `${row.moneda_precio} ${row.precio_consumidor_final}`} · Mayorista {row.precio_mayorista === "" ? "pendiente" : `${row.moneda_precio} ${row.precio_mayorista}`}
                  </small>
                </div>
                <label>
                  Familia
                  <input
                    value={draft.family}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [row.product_id]: {
                          ...draft,
                          family: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Subfamilia
                  <input
                    value={draft.subfamily}
                    onChange={(event) =>
                      setDrafts((current) => ({
                        ...current,
                        [row.product_id]: {
                          ...draft,
                          subfamily: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <button
                  onClick={() =>
                    setPriceEditor(
                      editingPrice
                        ? null
                        : {
                            variantId: row.variant_id,
                            kind: "consumidor_final",
                            amount: String(row.precio_consumidor_final),
                            reason: "",
                          },
                    )
                  }
                >
                  {editingPrice ? "Cerrar precios" : "Editar precios"}
                </button>
                <button
                  disabled={busy === row.product_id || (draft.family === row.familia && draft.subfamily === row.subfamilia)}
                  onClick={async () => {
                    setBusy(row.product_id);
                    try {
                      await updateCatalogClassification(row.product_id, draft.family, draft.subfamily);
                      await refresh(`Categoría de ${row.producto} guardada.`);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  Guardar categoría
                </button>
                <button
                  className={row.active ? "danger-outline" : "secondary"}
                  disabled={busy === row.variant_id}
                  onClick={async () => {
                    setBusy(row.variant_id);
                    try {
                      await setCatalogVariantActive(row.variant_id, !row.active);
                      await refresh(row.active ? `${row.sku} se ocultó del cotizador.` : `${row.sku} volvió al cotizador.`);
                    } catch (error) {
                      setMessage(error instanceof Error ? error.message : "No se pudo cambiar el estado.");
                    } finally {
                      setBusy("");
                    }
                  }}
                >
                  {row.active ? "Desactivar" : "Restaurar"}
                </button>
                {editingPrice && priceEditor && (
                  <div className="catalog-price-editor">
                    <label>
                      Lista
                      <select
                        value={priceEditor.kind}
                        onChange={(event) => {
                          const kind = event.target.value as PriceImportKind;
                          setPriceEditor({
                            ...priceEditor,
                            kind,
                            amount: String(kind === "mayorista" ? row.precio_mayorista : row.precio_consumidor_final),
                          });
                        }}
                      >
                        <option value="consumidor_final">Minorista</option>
                        <option value="mayorista">Mayorista</option>
                      </select>
                    </label>
                    <label>
                      Precio unitario
                      <input
                        type="number"
                        min="0"
                        step=".0001"
                        value={priceEditor.amount}
                        onChange={(event) =>
                          setPriceEditor({
                            ...priceEditor,
                            amount: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Moneda
                      <strong className="fixed-currency">USD</strong>
                    </label>
                    <label className="price-reason-field">
                      Fuente o motivo
                      <input
                        value={priceEditor.reason}
                        onChange={(event) =>
                          setPriceEditor({
                            ...priceEditor,
                            reason: event.target.value,
                          })
                        }
                        placeholder="Ej. lista confirmada por Felipe"
                      />
                    </label>
                    <button
                      disabled={busy === row.variant_id || priceEditor.amount === "" || priceEditor.reason.trim().length < 3}
                      onClick={async () => {
                        setBusy(row.variant_id);
                        try {
                          await setCatalogVariantPrice(row.variant_id, priceEditor.kind, Number(priceEditor.amount), "USD", priceEditor.reason);
                          setPriceEditor(null);
                          await refresh(`${priceEditor.kind === "mayorista" ? "Mayorista" : "Minorista"} de ${row.sku} guardado.`);
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "No se pudo guardar el precio.");
                        } finally {
                          setBusy("");
                        }
                      }}
                    >
                      Guardar precio
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
      {message && (
        <div className="policy-message" role="status">
          {message}
        </div>
      )}
    </section>
  );
}
