// Genera src/dark-theme.css: el modo oscuro del cotizador (21/11, Felipe: «que responda al modo noche como el CRM»).
// Mismo método que poli-crm (scripts/build-dark-theme.mjs): cada regla con fondo claro se repite con fondo oscuro, el texto
// oscuro se aclara y las variables de color se redefinen. Se aplica con data-theme="dark" en <html> (lo manda el CRM)
// o, suelto, si el dispositivo está en oscuro. Uso: node scripts/build-dark-theme.mjs  (--check para la prueba).
import { readFileSync, writeFileSync } from 'node:fs';

const FILES = ['src/index.css', 'src/glass.css', 'src/crm-theme.css', 'src/polish.css'];
const css = FILES.map((file) => readFileSync(file, 'utf8')).join('\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]+;/g, '');
const SURFACE = '#1c1c1f';
const SURFACE2 = '#26262a';
const hexLum = (hex) => { const h = hex.replace('#', ''); const f = h.length <= 4 ? h.slice(0, 3).split('').map((c) => c + c).join('') : h.slice(0, 6); const [r, g, b] = [0, 2, 4].map((i) => parseInt(f.slice(i, i + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

const rules = new Map();
const colorRules = new Map();
const blockRe = /([^{}@]+)\{([^{}]*)\}/g;
let m;
while ((m = blockRe.exec(css))) {
  const selectors = m[1].trim();
  if (!selectors || selectors.startsWith('from') || /^\d/.test(selectors) || selectors.includes('@') || /^:root|^html$|^body$/.test(selectors)) continue;
  // La vista previa y lo impreso son «papel»: quedan siempre claros.
  if (/preview|print|paper|pdf/i.test(selectors)) continue;
  for (const decl of m[2].split(';')) {
    const cm = decl.match(/^\s*color\s*:\s*(#[0-9a-f]{3}|#[0-9a-f]{6})\s*$/i);
    if (cm) {
      const l = hexLum(cm[1]);
      for (const sel of selectors.split(',')) { if (l < 0.22) colorRules.set(sel.trim(), '#e7e7e9'); else if (l < 0.42) colorRules.set(sel.trim(), '#b4b5b9'); else colorRules.delete(sel.trim()); }
      continue;
    }
    const match = decl.match(/^\s*background(?:-color)?\s*:\s*(.+?)\s*$/i);
    if (!match) continue;
    const value = match[1];
    let target = null;
    if (/^(white|#fff|#ffffff|var\(--surface\))$/i.test(value)) target = SURFACE;
    else if (/^rgba?\(\s*255\s*,\s*255\s*,\s*255/i.test(value) || /^rgba\(var\(--surface-rgb\)/.test(value)) target = SURFACE;
    else if (/^var\(--[\w-]+,\s*#[0-9a-f]{3,6}\)$/i.test(value) && hexLum(value.match(/#[0-9a-f]{3,6}/i)[0]) > 0.8) target = SURFACE2;
    else if (/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value) && hexLum(value) > 0.8) target = hexLum(value) > 0.95 ? SURFACE : SURFACE2;
    else if (/^linear-gradient/.test(value) && (value.match(/#[0-9a-f]{6}\b/gi) || []).some((h) => hexLum(h) > 0.85)) target = SURFACE;
    for (const sel of selectors.split(',')) { if (target) rules.set(sel.trim(), target); else rules.delete(sel.trim()); }
  }
}

const vars = `
  color-scheme: dark;
  --bg: #121214; --bg-rgb: 18, 18, 20;
  --surface: #1c1c1f; --surface-rgb: 28, 28, 31; --surface-alt: #26262a; --surface-hover: #232327; --surface-selected: #2c1e1f;
  --border: #34343a; --border-strong: #44444b; --border-hover: #55555c;
  --text: #e7e7e9; --text-rgb: 231, 231, 233; --muted: #a9aaae; --text-secondary: #b4b5b9; --text-tertiary: #8f9095;
  --accent-soft: #3a1c1c; --success: #6cc3a6; --success-soft: #17302a; --warning: #f0c46c; --warning-soft: #3a2e14;
  --danger: #f19a8e; --error-soft: #3d1f1c; --focus: #6aa6cf; --focus-rgb: 106, 166, 207;
  --crm-forest: #f1f1f2; --crm-gray: #a3a4a8; --surface-subtle: #1d1d20;
  --shadow-flat: 0 1px 1px rgba(0, 0, 0, .3); --shadow-subtle: 0 6px 20px rgba(0, 0, 0, .45);`;

const surfaceRules = [...rules.entries()].map(([sel, bg]) => `${sel} { background: ${bg}; }`)
  .concat([...colorRules.entries()].filter(([sel]) => !/sidebar|crm-brand|:disabled/.test(sel) && !/primary/.test(sel.replace(/:not\([^)]*\)/g, ''))).map(([sel, c]) => `${sel} { color: ${c}; }`)).join('\n');
const extras = `
body { background: #121214; color: #e7e7e9; }
input, select, textarea { background: #1d1d20; color: #e7e7e9; border-color: #3b3b41; }
.history-filters button.active, .admin-section button, .price-list-actions button { color: #141416; }
.secondary-action, button.secondary, .rail-actions button:not(.primary-action), .history-list article button, .catalog-table-head, .catalog-grid-table th { color: #e7e7e9; border-color: #3b3b41; }
.quote-preview, .print-price-list, .print-photo-catalog { color-scheme: light; --bg: #f5f5f6; --surface: #ffffff; --surface-rgb: 255, 255, 255; --surface-alt: #f1f1f2; --border: #dcdcde; --text: #1c1c1c; --text-rgb: 28, 28, 28; --muted: #5c5d60; --text-secondary: #57585b; --text-tertiary: #797a7d; --crm-forest: #1c1c1c; background: #ffffff; color: #1c1c1c; }`;
const scopeExtras = (prefix) => extras.split('\n').filter((r) => r.trim()).map((r) => {
  const open = r.indexOf('{');
  return `${r.slice(0, open).split(',').map((x) => `${prefix} ${x.trim()}`).join(', ')} ${r.slice(open)}`;
}).join('\n');
// Selectores con «,» sueltos: cada uno lleva su prefijo.
const prefixed = (prefix) => surfaceRules.split('\n').map((rule) => { const open = rule.indexOf('{'); return `${rule.slice(0, open).split(',').map((x) => `${prefix} ${x.trim()}`).join(', ')} ${rule.slice(open)}`; }).join('\n');
const scoped = (prefix) => `${prefix} {${vars}\n}\n${prefixed(prefix)}\n${scopeExtras(prefix)}`;
// Solo en pantalla: al imprimir o guardar el PDF siempre sale claro.
const out = `/* GENERADO por scripts/build-dark-theme.mjs — no editar a mano. */
@media screen {
${scoped(':root[data-theme="dark"]').split('\n').map((l) => '  ' + l).join('\n')}
}
@media screen and (prefers-color-scheme: dark) {
${scoped(':root:not([data-theme="light"])').split('\n').map((l) => '  ' + l).join('\n')}
}
`;
if (process.argv.includes('--check')) {
  if (readFileSync('src/dark-theme.css', 'utf8') !== out) { console.error('src/dark-theme.css está viejo: correr node scripts/build-dark-theme.mjs'); process.exit(1); }
  console.log('modo oscuro al día');
} else {
  writeFileSync('src/dark-theme.css', out);
  console.log('reglas con fondo claro:', rules.size, '· textos:', colorRules.size);
}
