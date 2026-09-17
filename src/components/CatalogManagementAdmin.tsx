import { useEffect, useMemo, useState } from "react";
import { applyCatalogActiveReview, createCatalogProduct, createCatalogVariant, downloadCsv, previewCatalogActiveReview, rowsToCsv, setCatalogVariantActive, setCatalogVariantCost, setCatalogVariantPrice, updateCatalogClassification, updateCatalogProductName, updateCatalogVariantSku, type AdminCatalogRow, type CatalogActiveReviewPreview } from "../lib/admin";
import { buildCatalogReview } from "../lib/catalogReview";
import { formatRuleLabel, loadCommercialRules } from "../lib/commercialRules";
import type { CommercialRule } from "../types/commercialRules";
import { deleteBucketPhoto, listBucketPhotos, photoRelevance, productPhotoUrl, setCatalogProductPhoto, uploadProductPhoto, type BucketPhoto } from "../lib/productPhotos";
import { groupByColorVariant } from "../lib/colorVariants";

interface RowDraft {
  sku: string;
  minorista: string;
  mayorista: string;
  costo: string;
  reason: string;
}

function rowDraftFrom(row: AdminCatalogRow): RowDraft {
  return {
    sku: row.sku,
    minorista: row.precio_consumidor_final === "" ? "" : String(row.precio_consumidor_final),
    mayorista: row.precio_mayorista === "" ? "" : String(row.precio_mayorista),
    costo: row.costo === "" ? "" : String(row.costo),
    reason: "",
  };
}

export function CatalogManagementAdmin({ catalog, onChanged }: { catalog: AdminCatalogRow[]; onChanged: () => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [familyFilter, setFamilyFilter] = useState("todas");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, { family: string; subfamily: string }>>({});
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [newVariantDrafts, setNewVariantDrafts] = useState<Record<string, { sku: string; name: string; unit: string; unitsPerPack: string }>>({});
  const [rowDrafts, setRowDrafts] = useState<Record<string, RowDraft>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [rules, setRules] = useState<CommercialRule[]>([]);
  const [photos, setPhotos] = useState<BucketPhoto[]>([]);
  const [activeReview, setActiveReview] = useState<{ fileName: string; preview: CatalogActiveReviewPreview[] } | null>(null);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [photoPickerOpenFor, setPhotoPickerOpenFor] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState({ name: "", brand: "Grupo Poliplast", family: "", subfamily: "", sku: "", unit: "unidad" });

  useEffect(() => {
    listBucketPhotos().then(setPhotos).catch(() => setPhotos([]));
  }, []);
  useEffect(() => {
    loadCommercialRules().then(setRules).catch(() => setRules([]));
  }, []);

  const normalized = search.trim().toLowerCase();
  const families = useMemo(() => [...new Set(catalog.map((row) => row.familia).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-AR")), [catalog]);
  const subfamiliesByFamily = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of catalog) {
      if (!row.familia || !row.subfamilia) continue;
      const list = map.get(row.familia) ?? [];
      if (!list.includes(row.subfamilia)) list.push(row.subfamilia);
      map.set(row.familia, list);
    }
    for (const [family, list] of map) map.set(family, list.sort((a, b) => a.localeCompare(b, "es-AR")));
    return map;
  }, [catalog]);
  const CUSTOM_OPTION = "__nueva__";
  const summary = useMemo(() => ({
    active: catalog.filter((row) => row.active).length,
    inactive: catalog.filter((row) => !row.active).length,
    consumerPending: catalog.filter((row) => row.active && row.precio_consumidor_final === "").length,
    wholesaleReady: catalog.filter((row) => row.active && row.precio_mayorista !== "").length,
  }), [catalog]);
  const rows = useMemo(() => catalog.filter((row) => (includeInactive || row.active) && (familyFilter === "todas" || row.familia === familyFilter) && (normalized === "" || [row.sku, row.producto, row.variante, row.familia, row.subfamilia].some((value) => value.toLowerCase().includes(normalized)))), [catalog, familyFilter, includeInactive, normalized]);
  const allGroups = useMemo(() => {
    const map = new Map<string, { product_id: string; producto: string; familia: string; subfamilia: string; photo_path: string | null; rows: AdminCatalogRow[] }>();
    for (const row of rows) {
      const existing = map.get(row.product_id);
      if (existing) existing.rows.push(row);
      else map.set(row.product_id, { product_id: row.product_id, producto: row.producto, familia: row.familia, subfamilia: row.subfamilia, photo_path: row.photo_path, rows: [row] });
    }
    const priceKeyOf = (group: { rows: AdminCatalogRow[] }) => group.rows.map((row) => row.precio_consumidor_final).sort().join("|");
    const clusters = groupByColorVariant([...map.values()], (group) => group.producto, priceKeyOf);
    const withDots = clusters.map((cluster) => {
      const members = cluster.colorOptions.length > 1
        ? cluster.colorOptions.map((option) => option.product).sort((a, b) => a.producto.localeCompare(b.producto, "es-AR"))
        : [cluster.representative];
      return members.map((group, index) => ({
        ...group,
        colorDot: cluster.colorOptions.length > 1 ? cluster.colorOptions.find((option) => option.product === group)?.hex ?? null : null,
        clusterStart: index === 0,
      }));
    });
    withDots.sort((a, b) => a[0].producto.localeCompare(b[0].producto, "es-AR"));
    return withDots.flat();
  }, [rows]);
  const pageSize = 25;
  // Corta en trozos de ~pageSize, pero nunca en medio de un cluster de color
  // (si el corte cae en un "cluster-sibling", el trozo se extiende hasta el
  // próximo "cluster-start" para no partir visualmente el grupo).
  const pages = useMemo(() => {
    const chunks: (typeof allGroups)[] = [];
    let index = 0;
    while (index < allGroups.length) {
      let end = Math.min(index + pageSize, allGroups.length);
      while (end < allGroups.length && !allGroups[end].clusterStart) end += 1;
      chunks.push(allGroups.slice(index, end));
      index = end;
    }
    return chunks.length > 0 ? chunks : [[]];
  }, [allGroups]);
  const [pageState, setPageState] = useState({ page: 1, key: "" });
  const filterKey = `${normalized}|${familyFilter}|${includeInactive}`;
  const page = pageState.key === filterKey ? pageState.page : 1;
  const setPage = (updater: (value: number) => number) => setPageState({ page: updater(page), key: filterKey });
  const pageCount = pages.length;
  const currentPage = Math.min(page, pageCount);
  const groups = pages[currentPage - 1] ?? [];
  const categoryDraftFor = (group: { product_id: string; familia: string; subfamilia: string }) =>
    categoryDrafts[group.product_id] ?? { family: group.familia, subfamily: group.subfamilia };
  const rowDraftFor = (row: AdminCatalogRow) => rowDrafts[row.variant_id] ?? rowDraftFrom(row);
  const conditionFor = (variantId: string) => {
    const today = new Date().toISOString().slice(0, 10);
    const applicable = rules.filter((rule) => rule.variant_id === variantId && rule.status === "confirmado" && rule.valid_from <= today && (!rule.valid_until || rule.valid_until >= today));
    if (applicable.length === 0) return "—";
    return applicable.map((rule) => formatRuleLabel(rule)).join(" · ");
  };
  const refresh = async (text: string) => {
    setMessage(text);
    await onChanged();
  };

  const saveRow = async (row: AdminCatalogRow) => {
    const draft = rowDraftFor(row);
    const changedSku = draft.sku.trim() !== row.sku;
    const changedMinorista = draft.minorista !== (row.precio_consumidor_final === "" ? "" : String(row.precio_consumidor_final));
    const changedMayorista = draft.mayorista !== (row.precio_mayorista === "" ? "" : String(row.precio_mayorista));
    const changedCosto = draft.costo !== (row.costo === "" ? "" : String(row.costo));
    if (!changedSku && !changedMinorista && !changedMayorista && !changedCosto) return;
    if ((changedMinorista || changedMayorista || changedCosto) && draft.reason.trim().length < 3) {
      setMessage("Indicá una fuente o motivo (mínimo 3 caracteres) antes de guardar.");
      return;
    }
    if ((changedMinorista && draft.minorista === "") || (changedMayorista && draft.mayorista === "") || (changedCosto && draft.costo === "")) {
      setMessage("No se puede vaciar un precio o costo ya cargado: escribí el nuevo valor o desactivá la variante en vez de dejarlo en blanco.");
      return;
    }
    setBusy(row.variant_id);
    try {
      if (changedSku) await updateCatalogVariantSku(row.variant_id, draft.sku);
      if (changedMinorista) await setCatalogVariantPrice(row.variant_id, "consumidor_final", Number(draft.minorista), "USD", draft.reason);
      if (changedMayorista) await setCatalogVariantPrice(row.variant_id, "mayorista", Number(draft.mayorista), "USD", draft.reason);
      if (changedCosto) await setCatalogVariantCost(row.variant_id, Number(draft.costo), "USD", draft.reason);
      setRowDrafts((current) => { const next = { ...current }; delete next[row.variant_id]; return next; });
      await refresh(`${row.sku} actualizado.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo guardar la fila.");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="admin-section stack catalog-management">
      <div>
        <h2>Productos, categorías y precios</h2>
        <p className="muted">Buscá por nombre o SKU. Editá minorista, mayorista, costo y categoría por variante, y confirmá con un click.</p>
      </div>
      <div className="catalog-new-product-toggle">
        <button className="secondary" onClick={() => setShowNewProduct((value) => !value)}>{showNewProduct ? "Cancelar alta" : "+ Crear producto nuevo"}</button>
      </div>
      {showNewProduct && (
        <div className="catalog-new-product-form">
          <input placeholder="Nombre del producto" value={newProduct.name} onChange={(event) => setNewProduct((current) => ({ ...current, name: event.target.value }))} />
          <input placeholder="Marca (ej. Grupo Poliplast, Penosil)" value={newProduct.brand} onChange={(event) => setNewProduct((current) => ({ ...current, brand: event.target.value }))} />
          <input list="catalog-family-datalist" placeholder="Familia" value={newProduct.family} onChange={(event) => setNewProduct((current) => ({ ...current, family: event.target.value }))} />
          <datalist id="catalog-family-datalist">{families.map((family) => <option key={family} value={family} />)}</datalist>
          <input placeholder="Subfamilia (opcional)" value={newProduct.subfamily} onChange={(event) => setNewProduct((current) => ({ ...current, subfamily: event.target.value }))} />
          <input placeholder="SKU de la primera variante" value={newProduct.sku} onChange={(event) => setNewProduct((current) => ({ ...current, sku: event.target.value }))} />
          <input placeholder="Unidad (ej. unidad, kg)" value={newProduct.unit} onChange={(event) => setNewProduct((current) => ({ ...current, unit: event.target.value }))} />
          <button
            className="primary-action inline"
            disabled={busy === "new-product" || !newProduct.name.trim() || !newProduct.family.trim() || !newProduct.sku.trim()}
            onClick={async () => {
              setBusy("new-product");
              try {
                await createCatalogProduct(newProduct);
                setNewProduct({ name: "", brand: "Grupo Poliplast", family: "", subfamily: "", sku: "", unit: "unidad" });
                setShowNewProduct(false);
                await refresh(`${newProduct.name} creado. Buscalo para cargarle el precio.`);
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "No se pudo crear el producto.");
              } finally {
                setBusy("");
              }
            }}
          >
            Crear producto
          </button>
        </div>
      )}
      <div className="admin-summary-strip" aria-label="Estado del catálogo">
        <span><strong>{summary.active}</strong> activos</span>
        <span><strong>{summary.inactive}</strong> ocultos</span>
        <span className={summary.consumerPending ? "attention" : ""}><strong>{summary.consumerPending}</strong> sin minorista</span>
        <span><strong>{summary.wholesaleReady}</strong> con mayorista</span>
      </div>
      <div className="catalog-admin-search">
        <input type="search" aria-label="Buscar producto para administrar" placeholder="Buscar por nombre, SKU, familia o subfamilia" value={search} onChange={(event) => setSearch(event.target.value)} />
        <select aria-label="Filtrar por familia" value={familyFilter} onChange={(event) => setFamilyFilter(event.target.value)}>
          <option value="todas">Todas las familias</option>
          {families.map((family) => <option key={family} value={family}>{family}</option>)}
        </select>
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
      {allGroups.length === 0 ? (
        <p className="pending-control">No se encontraron productos.</p>
      ) : (
        <>
        <nav className="catalog-admin-pagination" aria-label="Páginas de productos">
          <span>{allGroups.length} producto{allGroups.length === 1 ? "" : "s"} · orden alfabético</span>
          <div>
            <button className="secondary" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
            <strong>Página {currentPage} de {pageCount}</strong>
            <button className="secondary" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
          </div>
        </nav>
        <div className="catalog-grid-groups">
          {groups.map((group) => {
            const categoryDraft = categoryDraftFor(group);
            const subfamilyOptions = subfamiliesByFamily.get(categoryDraft.family) ?? [];
            const familyIsCustom = categoryDraft.family !== "" && !families.includes(categoryDraft.family);
            const subfamilyIsCustom = categoryDraft.subfamily !== "" && !subfamilyOptions.includes(categoryDraft.subfamily);
            const categoryChanged = categoryDraft.family !== group.familia || categoryDraft.subfamily !== group.subfamilia;
            return (
              <div key={group.product_id} className={`catalog-grid-product${group.clusterStart ? " cluster-start" : " cluster-sibling"}`}>
                <div className="catalog-grid-product-header">
                  {group.colorDot && <span className="catalog-grid-color-dot" style={{ background: group.colorDot }} title="Mismo artículo, otro color" />}
                  {productPhotoUrl(group.photo_path) ? (
                    <img className="catalog-grid-thumb" src={productPhotoUrl(group.photo_path)!} alt={group.producto} />
                  ) : (
                    <div className="catalog-grid-thumb catalog-grid-thumb-empty">Sin foto</div>
                  )}
                  <label className="catalog-grid-name-editor">
                    Nombre del producto
                    <div className="catalog-grid-name-row">
                      <input
                        value={nameDrafts[group.product_id] ?? group.producto}
                        onChange={(event) => setNameDrafts((current) => ({ ...current, [group.product_id]: event.target.value }))}
                      />
                      <button
                        className="secondary"
                        disabled={busy === `name-${group.product_id}` || (nameDrafts[group.product_id] ?? group.producto) === group.producto}
                        onClick={async () => {
                          setBusy(`name-${group.product_id}`);
                          try {
                            await updateCatalogProductName(group.product_id, nameDrafts[group.product_id] ?? group.producto);
                            setNameDrafts((current) => { const next = { ...current }; delete next[group.product_id]; return next; });
                            await refresh("Nombre actualizado.");
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "No se pudo renombrar.");
                          } finally {
                            setBusy("");
                          }
                        }}
                      >
                        Guardar
                      </button>
                    </div>
                    {(nameDrafts[group.product_id] ?? group.producto).length > 55 && (
                      <small className="catalog-grid-name-warning">Nombre largo para la lista de precios con fotos: puede recortarse en la ficha impresa.</small>
                    )}
                  </label>
                  {(() => {
                    const isOpen = photoPickerOpenFor === group.product_id;
                    const sortedPhotos = [...photos].sort((a, b) => photoRelevance(b, group.producto) - photoRelevance(a, group.producto));
                    const currentPhoto = photos.find((photo) => photo.path === group.photo_path);
                    const assign = async (value: string | null, keepOpen = false) => {
                      setBusy(`photo-${group.product_id}`);
                      try {
                        await setCatalogProductPhoto(group.product_id, value);
                        if (!keepOpen) setPhotoPickerOpenFor(null);
                        await refresh(value ? `Foto asignada a ${group.producto}.` : `Foto quitada de ${group.producto}.`);
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "No se pudo asignar la foto.");
                      } finally {
                        setBusy("");
                      }
                    };
                    const removePhoto = async (photo: BucketPhoto) => {
                      if (!window.confirm(`¿Borrar definitivamente la foto "${photo.path}" del bucket? Se va a quitar de cualquier producto que la tenga puesta.`)) return;
                      setBusy(`photo-${group.product_id}`);
                      try {
                        await deleteBucketPhoto(photo.path);
                        setPhotos(await listBucketPhotos());
                        await refresh(`Foto borrada.`);
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "No se pudo borrar la foto.");
                      } finally {
                        setBusy("");
                      }
                    };
                    return (
                      <div className="catalog-grid-photo-picker">
                        <span>Foto del producto</span>
                        <div className="catalog-grid-photo-current">
                          {currentPhoto ? <img src={currentPhoto.url} alt={group.producto} /> : <div className="catalog-grid-photo-empty">Sin foto</div>}
                          <div className="catalog-grid-photo-current-actions">
                            <button type="button" className="catalog-grid-photo-thumb-more" onClick={() => setPhotoPickerOpenFor(group.product_id)}>
                              Ver galería ({sortedPhotos.length})
                            </button>
                            {group.photo_path && (
                              <button type="button" className="catalog-grid-photo-thumb-more" disabled={busy === `photo-${group.product_id}`} onClick={() => assign(null)}>
                                Quitar foto
                              </button>
                            )}
                          </div>
                        </div>
                        {isOpen && (
                          <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Galería de fotos" onClick={() => setPhotoPickerOpenFor(null)}>
                            <section className="photo-gallery-modal" onClick={(event) => event.stopPropagation()}>
                              <h2>Elegir foto para {group.producto}</h2>
                              <p className="muted">Click en una foto para asignarla. El tacho la borra del bucket para siempre (se usa para sacar duplicados).</p>
                              <div className="photo-gallery-grid">
                                {sortedPhotos.length === 0 && <span className="muted">Todavía no subiste fotos.</span>}
                                {sortedPhotos.map((photo) => (
                                  <div className="photo-gallery-item-wrap" key={photo.path}>
                                    <button
                                      type="button"
                                      className={`photo-gallery-item${group.photo_path === photo.path ? " selected" : ""}`}
                                      disabled={busy === `photo-${group.product_id}`}
                                      onClick={() => assign(photo.path)}
                                    >
                                      <img src={photo.url} alt={photo.path} />
                                    </button>
                                    <button
                                      type="button"
                                      className="catalog-grid-photo-thumb-delete"
                                      title="Borrar esta foto del bucket"
                                      disabled={busy === `photo-${group.product_id}`}
                                      onClick={() => removePhoto(photo)}
                                    >
                                      🗑
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div className="admin-actions"><button onClick={() => setPhotoPickerOpenFor(null)}>Cerrar</button></div>
                            </section>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <label
                    className="catalog-grid-photo-upload"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={async (event) => {
                      event.preventDefault();
                      const file = event.dataTransfer.files?.[0];
                      if (!file) return;
                      setBusy(`photo-${group.product_id}`);
                      try {
                        await uploadProductPhoto(group.product_id, file);
                        setPhotos(await listBucketPhotos());
                        await refresh(`Foto subida y asignada a ${group.producto}.`);
                      } catch (error) {
                        setMessage(error instanceof Error ? error.message : "No se pudo subir la foto.");
                      } finally {
                        setBusy("");
                      }
                    }}
                  >
                    Subir foto nueva (o arrastrar acá)
                    <input
                      type="file"
                      accept="image/*"
                      disabled={busy === `photo-${group.product_id}`}
                      onChange={async (event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (!file) return;
                        setBusy(`photo-${group.product_id}`);
                        try {
                          await uploadProductPhoto(group.product_id, file);
                          setPhotos(await listBucketPhotos());
                          await refresh(`Foto subida y asignada a ${group.producto}.`);
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "No se pudo subir la foto.");
                        } finally {
                          setBusy("");
                        }
                      }}
                    />
                  </label>
                  <div className="catalog-grid-category">
                    <label>
                      Familia
                      <select
                        value={familyIsCustom ? CUSTOM_OPTION : categoryDraft.family}
                        onChange={(event) => {
                          const value = event.target.value === CUSTOM_OPTION ? "" : event.target.value;
                          setCategoryDrafts((current) => ({ ...current, [group.product_id]: { family: value, subfamily: "" } }));
                        }}
                      >
                        <option value="">Sin familia</option>
                        {families.map((family) => <option key={family} value={family}>{family}</option>)}
                        <option value={CUSTOM_OPTION}>+ Nueva familia…</option>
                      </select>
                      {familyIsCustom && (
                        <input
                          autoFocus
                          placeholder="Nombre de la nueva familia"
                          value={categoryDraft.family}
                          onChange={(event) => setCategoryDrafts((current) => ({ ...current, [group.product_id]: { ...categoryDraft, family: event.target.value } }))}
                        />
                      )}
                    </label>
                    <label>
                      Subfamilia
                      <select
                        value={subfamilyIsCustom ? CUSTOM_OPTION : categoryDraft.subfamily}
                        onChange={(event) => {
                          const value = event.target.value === CUSTOM_OPTION ? "" : event.target.value;
                          setCategoryDrafts((current) => ({ ...current, [group.product_id]: { ...categoryDraft, subfamily: value } }));
                        }}
                      >
                        <option value="">Sin subfamilia</option>
                        {subfamilyOptions.map((subfamily) => <option key={subfamily} value={subfamily}>{subfamily}</option>)}
                        <option value={CUSTOM_OPTION}>+ Nueva subfamilia…</option>
                      </select>
                      {subfamilyIsCustom && (
                        <input
                          autoFocus
                          placeholder="Nombre de la nueva subfamilia"
                          value={categoryDraft.subfamily}
                          onChange={(event) => setCategoryDrafts((current) => ({ ...current, [group.product_id]: { ...categoryDraft, subfamily: event.target.value } }))}
                        />
                      )}
                    </label>
                    <button
                      className="secondary"
                      disabled={busy === group.product_id || !categoryChanged}
                      onClick={async () => {
                        setBusy(group.product_id);
                        try {
                          await updateCatalogClassification(group.product_id, categoryDraft.family, categoryDraft.subfamily);
                          setCategoryDrafts((current) => { const next = { ...current }; delete next[group.product_id]; return next; });
                          await refresh(`Categoría de ${group.producto} guardada.`);
                        } catch (error) {
                          setMessage(error instanceof Error ? error.message : "No se pudo guardar.");
                        } finally {
                          setBusy("");
                        }
                      }}
                    >
                      Guardar categoría
                    </button>
                  </div>
                </div>
                <table className="catalog-grid-table">
                  <thead>
                    <tr>
                      <th>Variante</th>
                      <th>Minorista (USD)</th>
                      <th>Mayorista (USD)</th>
                      <th title="El costo se carga sin IVA">Costo (USD, sin IVA)</th>
                      <th>Condición comercial</th>
                      <th>Motivo del cambio</th>
                      <th>Activo</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => {
                      const draft = rowDraftFor(row);
                      const original = rowDraftFrom(row);
                      const rowChanged = draft.sku.trim() !== original.sku || draft.minorista !== original.minorista || draft.mayorista !== original.mayorista || draft.costo !== original.costo;
                      const setDraft = (patch: Partial<RowDraft>) => setRowDrafts((current) => ({ ...current, [row.variant_id]: { ...draft, ...patch } }));
                      return (
                        <tr key={row.variant_id} className={!row.active ? "inactive" : ""}>
                          <td>
                            <input className="catalog-grid-sku-input" value={draft.sku} onChange={(event) => setDraft({ sku: event.target.value })} />
                            <span>{row.variante || row.unidad}</span>
                          </td>
                          <td><input type="number" min="0" step=".0001" value={draft.minorista} placeholder="—" onChange={(event) => setDraft({ minorista: event.target.value })} /></td>
                          <td><input type="number" min="0" step=".0001" value={draft.mayorista} placeholder="—" onChange={(event) => setDraft({ mayorista: event.target.value })} /></td>
                          <td><input type="number" min="0" step=".0001" value={draft.costo} placeholder="—" onChange={(event) => setDraft({ costo: event.target.value })} /></td>
                          <td className="catalog-grid-condition">
                            {conditionFor(row.variant_id) === "—" ? <span className="muted">—</span> : <span className="catalog-grid-info-icon" tabIndex={0} title={conditionFor(row.variant_id)}>i</span>}
                          </td>
                          <td><input value={draft.reason} placeholder="Ej. lista confirmada por Felipe" disabled={!rowChanged} onChange={(event) => setDraft({ reason: event.target.value })} /></td>
                          <td>
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
                          </td>
                          <td>
                            <button className="primary-action inline" disabled={!rowChanged || busy === row.variant_id} onClick={() => saveRow(row)}>
                              Guardar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {(() => {
                  const newVariant = newVariantDrafts[group.product_id] ?? { sku: "", name: "", unit: "unidad", unitsPerPack: "" };
                  const setNewVariant = (patch: Partial<typeof newVariant>) => setNewVariantDrafts((current) => ({ ...current, [group.product_id]: { ...newVariant, ...patch } }));
                  return (
                    <div className="catalog-grid-add-variant">
                      <input placeholder="SKU nuevo" value={newVariant.sku} onChange={(event) => setNewVariant({ sku: event.target.value })} />
                      <input placeholder="Nombre de la variante" value={newVariant.name} onChange={(event) => setNewVariant({ name: event.target.value })} />
                      <input placeholder="Unidad (ej. unidad, kg)" value={newVariant.unit} onChange={(event) => setNewVariant({ unit: event.target.value })} />
                      <input placeholder="Unidades por caja (opcional)" type="number" min="1" value={newVariant.unitsPerPack} onChange={(event) => setNewVariant({ unitsPerPack: event.target.value })} />
                      <button
                        disabled={busy === `newvariant-${group.product_id}` || !newVariant.sku.trim() || !newVariant.name.trim()}
                        onClick={async () => {
                          setBusy(`newvariant-${group.product_id}`);
                          try {
                            await createCatalogVariant(group.product_id, { sku: newVariant.sku, name: newVariant.name, unit: newVariant.unit, unitsPerPack: newVariant.unitsPerPack ? Number(newVariant.unitsPerPack) : undefined });
                            setNewVariantDrafts((current) => { const next = { ...current }; delete next[group.product_id]; return next; });
                            await refresh(`Variante ${newVariant.sku} creada. Cargale el precio abajo.`);
                          } catch (error) {
                            setMessage(error instanceof Error ? error.message : "No se pudo crear la variante.");
                          } finally {
                            setBusy("");
                          }
                        }}
                      >
                        + Agregar variante a este producto
                      </button>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
        <nav className="catalog-admin-pagination" aria-label="Páginas de productos">
          <div>
            <button className="secondary" disabled={currentPage === 1} onClick={() => setPage((value) => value - 1)}>Anterior</button>
            <strong>Página {currentPage} de {pageCount}</strong>
            <button className="secondary" disabled={currentPage === pageCount} onClick={() => setPage((value) => value + 1)}>Siguiente</button>
          </div>
        </nav>
        </>
      )}
      {message && (
        <div className="policy-message" role="status">
          {message}
        </div>
      )}
    </section>
  );
}
