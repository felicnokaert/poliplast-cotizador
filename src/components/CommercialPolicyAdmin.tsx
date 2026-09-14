import { useEffect, useMemo, useState } from "react";
import { createCommercialRule, formatRuleLabel, loadCommercialRules, retireCommercialRule } from "../lib/commercialRules";
import { DEFAULT_PAYMENT_POLICIES, loadPaymentPolicies, savePaymentPolicy, type PaymentPolicy } from "../lib/paymentPolicies";
import type { AdminCatalogRow } from "../lib/admin";
import type { CommercialRule } from "../types/commercialRules";

export function CommercialPolicyAdmin({ catalog, userEmail }: { catalog: AdminCatalogRow[]; userEmail: string }) {
  const families = useMemo(() => [...new Set(catalog.map((r) => r.familia).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es-AR")), [catalog]);
  const [rules, setRules] = useState<CommercialRule[]>([]),
    [payments, setPayments] = useState<PaymentPolicy[]>(DEFAULT_PAYMENT_POLICIES),
    [message, setMessage] = useState("");
  const [editingRule, setEditingRule] = useState<string | null>(null),
    [retiringRule, setRetiringRule] = useState<string | null>(null),
    [retireReason, setRetireReason] = useState(""),
    [targetSearch, setTargetSearch] = useState("");
  const [form, setForm] = useState({
    scope: "family" as "family" | "sku",
    family: "",
    variantId: "",
    comparator: "gte" as "gt" | "gte",
    min: 1,
    max: "",
    net: 0,
    currency: "USD" as const,
    unit: "unidad",
    source: "",
    validFrom: new Date().toISOString().slice(0, 10),
    aggregateByFamily: false,
  });
  const reloadRules = async () => setRules(await loadCommercialRules());
  useEffect(() => {
    loadCommercialRules().then(setRules);
    loadPaymentPolicies().then(setPayments);
  }, []);
  const selectedFamily = form.family || families[0] || "";
  const selectedVariant = catalog.find((row) => row.variant_id === form.variantId);
  const matchingVariants = targetSearch.trim().length < 3 ? [] : catalog.filter((row) => row.active && [row.sku, row.producto].some((value) => value.toLowerCase().includes(targetSearch.trim().toLowerCase()))).slice(0, 60);
  useEffect(() => {
    if (!form.family && families[0]) window.setTimeout(() => setForm((value) => ({ ...value, family: families[0] })), 0);
  }, [families, form.family]);
  const activeRules = rules.filter((rule) => rule.status === "confirmado" && (!rule.valid_until || rule.valid_until >= new Date().toISOString().slice(0, 10)));
  const saveRule = async () => {
    try {
      await createCommercialRule(
        {
          scope_type: form.scope,
          family: form.scope === "family" ? selectedFamily : null,
          variant_id: form.scope === "sku" ? form.variantId : null,
          pack_group: null,
          quantity_comparator: form.comparator,
          min_quantity: form.min,
          max_quantity: form.max === "" ? null : Number(form.max),
          net_amount: form.net,
          vat_rate: 0.21,
          currency: form.currency,
          unit: form.unit,
          valid_from: form.validFrom,
          valid_until: null,
          source: form.source,
          notes: "",
          aggregate_by_family: form.scope === "sku" && form.aggregateByFamily,
          aggregate_by_pack_group: false,
          supersedes_rule_id: editingRule,
        },
        userEmail,
      );
      setEditingRule(null);
      await reloadRules();
      setMessage(editingRule ? "Nueva versión guardada; la anterior conserva su historial." : "Regla creada como nueva versión auditable.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "No se pudo guardar.");
    }
  };
  const editRule = (rule: CommercialRule) => {
    setEditingRule(rule.id);
    setForm({
      scope: rule.scope_type,
      family: rule.family ?? "",
      variantId: rule.variant_id ?? "",
      comparator: rule.quantity_comparator,
      min: rule.min_quantity,
      max: rule.max_quantity == null ? "" : String(rule.max_quantity),
      net: rule.net_amount,
      currency: "USD",
      unit: rule.unit,
      source: rule.source,
      validFrom: new Date().toISOString().slice(0, 10),
      aggregateByFamily: rule.aggregate_by_family,
    });
  };
  const updatePayment = (id: string, field: keyof PaymentPolicy, value: string | number) => setPayments((xs) => xs.map((x) => (x.id === id ? { ...x, [field]: value } : x)));
  return (
    <>
      <section className="admin-section stack">
        <div>
          <h2>Políticas mayoristas</h2>
          <p className="muted">Revisá primero las reglas vigentes. Las modificaciones crean una versión nueva; desactivar no elimina el historial.</p>
        </div>
        <div className="commercial-rule-list">
          {activeRules.map((rule) => (
            <article key={rule.id}>
              <div>
                <strong>{formatRuleLabel(rule)}</strong>
                <small>{rule.source}</small>
              </div>
              <button onClick={() => editRule(rule)}>Editar</button>
              <button
                className="danger-outline"
                onClick={() => {
                  setRetiringRule(rule.id);
                  setRetireReason("");
                }}
              >
                Desactivar
              </button>
            </article>
          ))}
        </div>
        <details>
          <summary>{editingRule ? "Editando una condición" : "+ Crear condición mayorista"}</summary>
          <div className="policy-form">
            <label>
              Aplicar a
              <select value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value as "family" | "sku" })}>
                <option value="family">Toda una familia</option>
                <option value="sku">Un producto / SKU</option>
              </select>
            </label>
            {form.scope === "sku" ? <label className="wide">
              Producto / SKU
              <input type="search" placeholder="Escribí 3 letras o el SKU" value={targetSearch} onChange={(e) => setTargetSearch(e.target.value)} />
              <select value={form.variantId} onChange={(e) => setForm({ ...form, variantId: e.target.value })} disabled={matchingVariants.length === 0 && !selectedVariant}>
                <option value="">Seleccionar…</option>
                {selectedVariant && !matchingVariants.some((row) => row.variant_id === selectedVariant.variant_id) && <option value={selectedVariant.variant_id}>{selectedVariant.sku} · {selectedVariant.producto}</option>}
                {matchingVariants.map((row) => <option key={row.variant_id} value={row.variant_id}>{row.sku} · {row.producto}</option>)}
              </select>
            </label> :
            <label>
              Familia
              <select value={form.family} onChange={(e) => setForm({ ...form, family: e.target.value })}>
                {families.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </label>}
            <label>
              Condición
              <select
                value={form.comparator}
                onChange={(e) =>
                  setForm({
                    ...form,
                    comparator: e.target.value as "gt" | "gte",
                  })
                }
              >
                <option value="gte">Desde</option>
                <option value="gt">Más de</option>
              </select>
            </label>
            <label>
              Desde
              <input type="number" min=".01" value={form.min} onChange={(e) => setForm({ ...form, min: Number(e.target.value) })} />
            </label>
            <label>
              Hasta (opcional)
              <input type="number" min={form.min} placeholder="Sin máximo" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
            </label>
            <label>
              Precio neto
              <input type="number" min="0" step=".0001" value={form.net} onChange={(e) => setForm({ ...form, net: Number(e.target.value) })} />
            </label>
            <label>
              Moneda
              <strong className="fixed-currency">USD</strong>
            </label>
            <label>
              Unidad
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
            </label>
            {form.scope === "sku" && <label><span>Cómputo</span><span className="checkbox-line"><input type="checkbox" checked={form.aggregateByFamily} onChange={(e) => setForm({ ...form, aggregateByFamily: e.target.checked })} /> Sumar toda la familia{selectedVariant ? ` (${selectedVariant.familia})` : ""}</span></label>}
            <label className="wide">
              Fuente / aprobación
              <input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder="Quién confirmó y cuándo" />
            </label>
          </div>
          <div className="admin-actions">
            <button disabled={(form.scope === "family" ? !selectedFamily : !form.variantId) || form.min <= 0 || (form.max !== "" && Number(form.max) < form.min) || form.net <= 0 || !form.source.trim()} onClick={saveRule}>
              {editingRule ? "Guardar nueva versión" : "Crear regla"}
            </button>
            {editingRule && (
              <button className="secondary" onClick={() => setEditingRule(null)}>
                Cancelar edición
              </button>
            )}
            <span className="muted">{activeRules.length} vigentes</span>
          </div>
        </details>
      </section>
      <section className="admin-section stack">
        <div>
          <h2>Formas de pago</h2>
          <p className="muted">El texto y los ajustes se aplican al elegir la condición.</p>
        </div>
        <div className="payment-policy-list">
          {payments.map((p) => (
            <article key={p.id}>
              <input aria-label={`Nombre ${p.id}`} value={p.name} onChange={(e) => updatePayment(p.id, "name", e.target.value)} />
              <input aria-label={`Texto ${p.id}`} value={p.customerText} onChange={(e) => updatePayment(p.id, "customerText", e.target.value)} />
              <label>
                Dto. %
                <input type="number" value={p.discountPercent} onChange={(e) => updatePayment(p.id, "discountPercent", Number(e.target.value))} />
              </label>
              <label>
                Recargo %
                <input type="number" value={p.surchargePercent} onChange={(e) => updatePayment(p.id, "surchargePercent", Number(e.target.value))} />
              </label>
              <button
                onClick={async () => {
                  try {
                    await savePaymentPolicy(p);
                    setMessage(`Condición “${p.name}” guardada.`);
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : "Aplicá primero la migración.");
                  }
                }}
              >
                Guardar
              </button>
            </article>
          ))}
        </div>
      </section>
      {message && (
        <div className="policy-message" role="status">
          {message}
        </div>
      )}
      {retiringRule && (
        <div className="admin-confirm-backdrop" role="dialog" aria-modal="true" aria-label="Desactivar política mayorista">
          <div className="admin-confirm">
            <h2>Desactivar política</h2>
            <p>Dejará de aplicarse en nuevas cotizaciones, pero conservará su historial.</p>
            <label>
              Motivo
              <input value={retireReason} onChange={(event) => setRetireReason(event.target.value)} placeholder="Ej. lista reemplazada" />
            </label>
            <div className="admin-actions">
              <button className="secondary" onClick={() => setRetiringRule(null)}>
                Cancelar
              </button>
              <button
                disabled={retireReason.trim().length < 3}
                onClick={async () => {
                  try {
                    await retireCommercialRule(retiringRule, retireReason);
                    setRetiringRule(null);
                    await reloadRules();
                    setMessage("Política desactivada.");
                  } catch (error) {
                    setMessage(error instanceof Error ? error.message : "No se pudo desactivar.");
                  }
                }}
              >
                Confirmar baja
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
