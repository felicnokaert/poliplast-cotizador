# Poliplast Cotizador — Design System

> Una herramienta comercial rápida, compacta y confiable: primero se entiende la cotización; después se percibe la marca.

## 1. Visual Theme & Atmosphere

**Style:** Commercial Workspace — sistema comercial contemporáneo, sobrio y de alta densidad.

**Keywords:** claro, compacto, ordenado, confiable, industrial, ágil, consistente, legible.

**Tone:** profesional y cercano, con jerarquía visual fuerte — **no** decorativo, futurista, lúdico ni recargado.

**Feel:** una mesa de trabajo comercial bien ordenada: todo está a mano, nada compite con el precio y los productos.

**Interaction Tier:** L1 — refinado estático.

**Dependencies:** CSS y React existentes. No agregar GSAP, Lenis, WebGL ni librerías de animación.

**Product architecture:**

- Historial de cotizaciones como entrada principal.
- Acción primaria visible: `Nueva cotización`.
- Cotizador como espacio de trabajo de dos áreas: edición y resumen sticky.
- Catálogo como segundo destino de navegación.
- Administración visible solamente para usuarios autorizados.
- Identidad principal neutral de Grupo Poliplast.
- Resinplast, Penosil y PURMAC aparecen como acentos contextuales en productos, filtros, listas impresas y vistas previas; nunca cambian toda la interfaz.

## 2. Color Palette & Roles

```css
:root {
  /* Backgrounds */
  --bg: #f5f6f4;
  --bg-rgb: 245, 246, 244;
  --surface: #ffffff;
  --surface-rgb: 255, 255, 255;
  --surface-alt: #f0f2ef;
  --surface-subtle: #fafbfa;
  --surface-hover: #f7f8f6;
  --surface-selected: #fdf1f0;

  /* Borders */
  --border: #dde1dc;
  --border-strong: #c8cec7;
  --border-hover: #aeb7ad;

  /* Text */
  --text: #1c211e;
  --text-rgb: 28, 33, 30;
  --text-secondary: #59615b;
  --text-tertiary: #7c857f;
  --text-inverse: #ffffff;

  /* Grupo Poliplast */
  --accent: #b4231d;
  --accent-rgb: 180, 35, 29;
  --accent-hover: #941c17;
  --accent-soft: #f8e7e5;
  --accent-contrast: #ffffff;

  /* Brand context */
  --brand-resinplast: #0877b9;
  --brand-resinplast-rgb: 8, 119, 185;
  --brand-resinplast-soft: #e8f4fa;
  --brand-penosil: #de3d28;
  --brand-penosil-rgb: 222, 61, 40;
  --brand-penosil-soft: #fcedea;
  --brand-purmac: #214f73;
  --brand-purmac-rgb: 33, 79, 115;
  --brand-purmac-soft: #e9f0f5;

  /* Semantic */
  --success: #24735a;
  --success-rgb: 36, 115, 90;
  --success-soft: #e9f5f0;
  --warning: #8a5a12;
  --warning-rgb: 138, 90, 18;
  --warning-soft: #fff4dc;
  --error: #b3261e;
  --error-rgb: 179, 38, 30;
  --error-soft: #fbe9e7;
  --info: #286a91;
  --info-soft: #eaf4f9;

  /* Focus and overlays */
  --focus: #2c6c91;
  --focus-rgb: 44, 108, 145;
  --overlay: rgba(var(--text-rgb), 0.58);
}
```

**Color rules:**

- Toda aplicación de color debe usar variables CSS; no se permiten hexadecimales sueltos en componentes.
- El rojo Poliplast identifica acciones principales y navegación activa, no superficies completas.
- Un mismo componente utiliza como máximo un color de marca contextual.
- Los colores de marca no comunican error, éxito ni advertencia.
- Totales en USD usan `--text`; la equivalencia ARS usa `--text-secondary`, nunca un rojo de alarma.
- Los estados no pueden depender solo del color: siempre incluyen texto, icono o forma.
- El contraste de texto y controles debe cumplir WCAG AA.

## 3. Typography Rules

**Font stack:**

```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;650;700;750&display=swap');

:root {
  --font-sans: "Inter", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --font-mono: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}
```

| Role | Font | Size | Weight | Line height | Letter spacing |
|---|---|---:|---:|---:|---:|
| Page title | Inter | 24px | 700 | 1.2 | -0.025em |
| Section title | Inter | 16px | 700 | 1.3 | -0.012em |
| Card title | Inter | 14px | 650 | 1.35 | -0.006em |
| Body | Inter | 14px | 400 | 1.5 | 0 |
| Compact body/table | Inter | 13px | 400 | 1.4 | 0 |
| Label | Inter | 12px | 650 | 1.35 | 0.01em |
| Eyebrow | Inter | 11px | 700 | 1.25 | 0.075em |
| KPI/total | Inter | 24–30px | 750 | 1.1 | -0.035em |
| SKU/numeric trace | Mono stack | 11–12px | 500 | 1.35 | 0 |

**Typography rules:**

- Los títulos de página no deben superar 28px en una aplicación interna.
- Precios, cantidades y números de cotización usan cifras tabulares: `font-variant-numeric: tabular-nums`.
- Las etiquetas son breves y visibles; no depender del placeholder como label.
- Mayúsculas solo para eyebrows, SKU y estados breves.
- **Nunca usar:** serif decorativa, tipografía manuscrita, condensed display, texto en mayúsculas para párrafos.

**Text decoration:**

- Sin gradientes de texto ni `text-shadow`.
- Los títulos se jerarquizan por tamaño, peso y espacio.
- Los links usan cambio de color y subrayado con offset en hover/focus.
- Los precios no usan efectos decorativos.

## 4. Component Stylings

### Buttons

```css
.button {
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 12px;
  background: var(--surface);
  color: var(--text);
  font: 650 13px/1.2 var(--font-sans);
  white-space: nowrap;
  transition: background-color 160ms ease, border-color 160ms ease,
              color 160ms ease, box-shadow 160ms ease, transform 100ms ease;
}
.button:hover:not(:disabled) {
  background: var(--surface-hover);
  border-color: var(--border-hover);
}
.button:active:not(:disabled) { transform: translateY(1px); }
.button:focus-visible {
  outline: 3px solid rgba(var(--focus-rgb), 0.2);
  outline-offset: 2px;
  border-color: var(--focus);
}
.button:disabled { opacity: 0.45; cursor: not-allowed; }
.button--primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--accent-contrast);
}
.button--primary:hover:not(:disabled) {
  border-color: var(--accent-hover);
  background: var(--accent-hover);
}
.button--quiet { border-color: transparent; background: transparent; }
.button--danger { color: var(--error); }
.button--danger:hover:not(:disabled) { background: var(--error-soft); }
.button--icon { width: 38px; padding: 0; }
```

Primary-action rules:

- Cada pantalla tiene una sola acción primaria visual.
- En cotización: `Guardar cambios y crear nueva` es primaria; `Guardar`, `Vista previa` y `WhatsApp` son secundarias.
- En historial: `Nueva cotización` es primaria.
- Acciones destructivas nunca usan el estilo primario.

### Inputs, selects and textareas

```css
.field { display: grid; gap: 5px; min-width: 0; }
.field__label { color: var(--text-secondary); font: 650 12px/1.35 var(--font-sans); }
.control {
  width: 100%;
  min-height: 38px;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--surface);
  color: var(--text);
  font: 400 14px/1.3 var(--font-sans);
  transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
}
.control:hover:not(:disabled) { border-color: var(--border-hover); }
.control:focus {
  outline: 0;
  border-color: var(--focus);
  box-shadow: 0 0 0 3px rgba(var(--focus-rgb), 0.16);
}
.control:disabled { background: var(--surface-alt); color: var(--text-tertiary); }
.control[aria-invalid="true"] {
  border-color: var(--error);
  box-shadow: 0 0 0 3px rgba(var(--error-rgb), 0.12);
}
```

### Cards and sections

```css
.panel {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-flat);
}
.panel--interactive {
  transition: border-color 160ms ease, box-shadow 160ms ease;
}
.panel--interactive:hover { border-color: var(--border-hover); }
.panel--interactive:focus-within {
  border-color: var(--focus);
  box-shadow: 0 0 0 3px rgba(var(--focus-rgb), 0.12);
}
```

Use fewer panels: client, products and summary may be distinct surfaces; individual form fields and every small setting must not become separate cards.

### Navigation

```css
.app-nav {
  position: sticky;
  top: 0;
  z-index: 30;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  min-height: 60px;
  border-bottom: 1px solid var(--border);
  background: rgba(var(--surface-rgb), 0.96);
}
.nav-link {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  padding: 7px 10px;
  border-radius: 7px;
  color: var(--text-secondary);
  font-weight: 650;
}
.nav-link:hover { color: var(--text); background: var(--surface-alt); }
.nav-link[aria-current="page"] { color: var(--accent); background: var(--accent-soft); }
.nav-link:focus-visible { outline: 3px solid rgba(var(--focus-rgb), 0.2); }
```

Desktop uses a compact top navigation. A permanent sidebar is rejected because the cotizador benefits from maximum horizontal space. Mobile converts navigation into a bottom bar or compact menu.

### Links

```css
.text-link {
  color: var(--accent);
  text-decoration: underline;
  text-decoration-color: transparent;
  text-underline-offset: 3px;
  transition: color 160ms ease, text-decoration-color 160ms ease;
}
.text-link:hover,
.text-link:focus-visible {
  color: var(--accent-hover);
  text-decoration-color: currentColor;
}
```

### Tags and badges

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 24px;
  border-radius: 999px;
  padding: 3px 8px;
  background: var(--surface-alt);
  color: var(--text-secondary);
  font: 650 11px/1.2 var(--font-sans);
}
.badge--success { background: var(--success-soft); color: var(--success); }
.badge--warning { background: var(--warning-soft); color: var(--warning); }
.badge--error { background: var(--error-soft); color: var(--error); }
.badge--resinplast { background: var(--brand-resinplast-soft); color: var(--brand-resinplast); }
.badge--penosil { background: var(--brand-penosil-soft); color: var(--brand-penosil); }
.badge--purmac { background: var(--brand-purmac-soft); color: var(--brand-purmac); }
```

### Tables and result lists

```css
.data-table { width: 100%; border-collapse: separate; border-spacing: 0; }
.data-table th {
  position: sticky;
  top: 60px;
  z-index: 2;
  padding: 9px 10px;
  border-bottom: 1px solid var(--border-strong);
  background: var(--surface-alt);
  color: var(--text-secondary);
  font: 650 11px/1.3 var(--font-sans);
  text-align: left;
}
.data-table td {
  padding: 10px;
  border-bottom: 1px solid var(--border);
  font-size: 13px;
}
.data-table tbody tr:hover { background: var(--surface-hover); }
.data-table tbody tr:focus-within { box-shadow: inset 3px 0 0 var(--focus); }
```

### Quote workspace

- Desktop: main editor `minmax(0, 1fr)` plus summary rail `360px`.
- Client section starts collapsed after enough data exists; the selected client remains visible in a compact identity row.
- Product search is the main affordance. Results appear only after 3 characters or a valid SKU fragment.
- Quote lines are rows, not isolated cards. Each row prioritizes product, quantity, applied unit price and line total.
- Detailed price reasoning lives behind `Ver cálculo`; never render all commercial conditions in the quote.
- Summary shows USD total first, ARS equivalent second, exchange rate and source in one compact control.
- Payment method, status, discount and exchange rate use a compact two-column control grid.
- Four final actions share height and visual rhythm; on small screens they form a 2×2 grid.

### Brand context

- Product cards/rows receive a 3px leading accent or badge, not a fully colored background.
- Printed price lists and quote previews may use the selected family logo and accent.
- Mixed-brand quotes use the Grupo Poliplast logo and primary palette.
- Browser light/dark logo variants affect only the logo asset; the application remains light in v1.

## 5. Layout Principles

**Container:**

- Application max width: `1540px`.
- Page horizontal padding: `clamp(16px, 2.2vw, 32px)`.
- History/catalog/admin readable width: `1180px` when a wider table is unnecessary.
- Quote editor uses the complete application width.

**Spacing scale:**

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
}
```

- Page sections: 24–32px.
- Component gaps: 8–16px.
- Panel padding: 16px desktop, 12–14px mobile.
- Dense table/quote rows: 8–12px vertically.

**Primary grid:**

```css
.quote-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(330px, 360px);
  gap: var(--space-5);
  align-items: start;
}
.quote-summary {
  position: sticky;
  top: calc(60px + var(--space-4));
  max-height: calc(100vh - 92px);
  overflow: auto;
}
```

**Page hierarchy:**

1. Navigation.
2. Short page header: title, context and primary action.
3. Filters or client identity.
4. Main working content.
5. Secondary/help content only when requested.

## 6. Depth & Elevation

```css
:root {
  --shadow-flat: 0 1px 1px rgba(var(--text-rgb), 0.025);
  --shadow-subtle: 0 6px 20px rgba(var(--text-rgb), 0.055);
  --shadow-elevated: 0 18px 50px rgba(var(--text-rgb), 0.14);
  --shadow-focus: 0 0 0 3px rgba(var(--focus-rgb), 0.16);
}
```

| Level | Treatment | Use |
|---|---|---|
| Flat | Border + `--shadow-flat` | Main panels, tables, cards |
| Subtle | `--shadow-subtle` | Sticky quote summary, open dropdown |
| Elevated | `--shadow-elevated` | Modal, confirmation dialog, product selector overlay |
| Focus | `--shadow-focus` | Keyboard/input focus only |

Depth comes primarily from surface contrast and borders. Never stack multiple prominent shadows.

## 7. Animation & Interaction

**Motion philosophy:** immediate feedback, short duration and no movement that delays quoting.

**Tier:** L1.

**Dependencies:** none.

### Page entrance

```css
@keyframes page-enter {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
.page-enter {
  animation: page-enter 220ms cubic-bezier(0.16, 1, 0.3, 1) both;
}
```

Use once on page/tab changes. Do not animate quote rows on every keystroke.

### Modal and drawer

```css
@keyframes dialog-enter {
  from { opacity: 0; transform: translateY(8px) scale(0.985); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}
.dialog { animation: dialog-enter 180ms cubic-bezier(0.16, 1, 0.3, 1) both; }
```

### Loading and saving

- Autosave feedback changes text/icon without moving layout.
- Buttons preserve width while loading.
- Use skeletons only for initial remote content; no full-page spinner after the shell is visible.

```css
@keyframes skeleton-pulse { 50% { opacity: 0.55; } }
.skeleton { animation: skeleton-pulse 1.2s ease-in-out infinite; }
```

### Hover and focus

- Buttons: background/border change in 160ms.
- Rows: background change only; no vertical lift.
- Product cards: border change; maximum 1px perceived movement.
- Tooltips appear after a short delay for icon-only controls.
- Keyboard focus is always visible.

### Reduced motion

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

## 8. Do's and Don'ts

### Do

- Priorizar producto, cantidad, precio unitario y total en cada renglón.
- Mostrar claramente qué se guardó, qué está en borrador y qué se envió.
- Usar una acción primaria por contexto.
- Mantener el resumen visible y compacto durante la edición.
- Mantener controles relacionados en la misma fila cuando haya espacio.
- Revelar explicaciones comerciales bajo demanda.
- Conservar las cifras alineadas y con dígitos tabulares.
- Reutilizar componentes, espaciado y estados en cotizador, catálogo y administración.
- Mostrar vacíos con una acción concreta: buscar, crear, importar o limpiar filtros.
- Verificar escritorio, notebook, tablet y teléfono antes de publicar.

### Don't

- ❌ No convertir cada campo o dato en una tarjeta independiente.
- ❌ No mostrar todas las políticas mayoristas dentro de una cotización.
- ❌ No usar cajas altas para contenidos de una sola línea.
- ❌ No usar más de una acción primaria roja en la misma vista.
- ❌ No mezclar USD y ARS como si fueran precios alternativos; USD es la moneda comercial y ARS una equivalencia final.
- ❌ No usar el rojo para totales normales, stock o equivalencia en pesos.
- ❌ No cambiar toda la aplicación de color al seleccionar una marca.
- ❌ No agregar animaciones de scroll, parallax, 3D, cursores personalizados ni fondos animados.
- ❌ No esconder labels reemplazándolos por placeholders.
- ❌ No presentar botones solo con iconos cuando la acción sea ambigua.
- ❌ No reducir objetivos táctiles por debajo de 44px en móvil.
- ❌ No truncar SKU, importes o nombres críticos sin una forma inmediata de verlos completos.
- ❌ No introducir una barra lateral fija en escritorio durante este rework.
- ❌ No rediseñar reglas de negocio desde CSS o componentes visuales.

## 9. Responsive Behavior

| Name | Width | Key changes |
|---|---:|---|
| Wide desktop | > 1280px | Editor + summary rail 360px; acciones en una fila |
| Desktop/notebook | 960–1279px | Summary rail 330px; campos compactos; navegación conserva tabs |
| Tablet | 720–959px | Una columna; resumen deja de ser sticky y aparece después de productos |
| Mobile | < 720px | Header compacto; acciones 2×2; tablas se convierten en filas estructuradas |
| Small mobile | < 420px | Una columna para formularios; botones críticos pueden ocupar todo el ancho |

**Touch targets:** mínimo `44px × 44px` en anchos menores a 720px.

**Collapsing strategy:**

- No ocultar información comercial crítica.
- Colapsar cliente, filtros avanzados y desglose del precio.
- Mantener siempre visible el total USD y el acceso a acciones finales.
- Catálogo y administración reemplazan tablas por filas apiladas con labels visibles cuando la tabla no entra.
- Modales pasan a `bottom sheet` o pantalla completa en móvil.

```css
@media (max-width: 959px) {
  .quote-workspace { grid-template-columns: 1fr; }
  .quote-summary { position: static; max-height: none; }
}

@media (max-width: 719px) {
  .app-shell { padding-inline: 12px; }
  .page-header { align-items: flex-start; }
  .form-grid { grid-template-columns: 1fr; }
  .quote-actions { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .button { min-height: 44px; }
  .desktop-only { display: none !important; }
}

@media (max-width: 419px) {
  .quote-actions { grid-template-columns: 1fr; }
  .page-header { display: grid; grid-template-columns: 1fr; }
}
```

## Phase C Acceptance Checklist

- Historial is the first application view.
- Nueva cotización opens a clean, deliberate workspace.
- No commercial calculations, persistence behavior or permissions regress.
- Search requires three characters or an SKU fragment.
- Summary is materially smaller than the current version.
- Exchange rate clearly communicates automatic vs manual.
- Final actions align in one row on wide screens, 2×2 on mobile/tablet.
- Admin sections use progressive disclosure and denser forms.
- Brand identity remains contextual.
- Keyboard navigation and focus states work throughout.
- Desktop and mobile screenshots are reviewed before deployment.
- Existing automated tests pass and new navigation/layout behavior receives coverage.
