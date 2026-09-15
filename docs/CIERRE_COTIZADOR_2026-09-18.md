# Cierre operativo del cotizador — 18/09/2026

## Alcance prioritario

1. UI de catálogo y administración.
2. Edición clara de políticas mayoristas.
3. Detección segura de productos y variantes.
4. Archivo único para decisiones dudosas.
5. Corrección de errores críticos.
6. Pruebas y verificación visual.
7. Publicación y documentación.

## Estado

- La navegación, el historial y el espacio de cotización usan el sistema definido en `DESIGN.md`.
- El catálogo exige tres caracteres o un fragmento de SKU antes de mostrar resultados.
- Administración permite buscar, filtrar por familia, editar familia/subfamilia, editar precios unitarios en USD y activar/desactivar variantes.
- El resumen administrativo informa activos, ocultos, productos sin precio minorista y productos con mayorista.
- Las políticas comerciales se pueden buscar, versionar y desactivar sin borrar historial.
- Penosil se calcula con umbral global de USD 1.800 netos (USD 2.178 final) y permite mezclar productos y cajas.
- Los tramos por familia o SKU admiten cantidad mínima, máxima opcional y precio neto; la interfaz muestra el final con IVA antes de guardar.
- Las 53 variantes marcadas `ACTIVE=FALSO` permanecen ocultas.
- La revisión de variantes identificó 466 filas agrupables de alta confianza en 95 grupos y 249 filas que requieren decisión humana. No se fusionan registros ambiguos automáticamente.

## Archivo de revisión

`C:\Users\felip\OneDrive\Desktop\Poliplast\04_Informes\Revision_variantes_cotizador_2026-09-15.xlsx`

La columna `DECISIÓN FELIPE` acepta: `AGRUPAR`, `MANTENER SEPARADO`, `DESACTIVAR` o `REVISAR`. Las columnas amarillas son las únicas que necesitan edición manual.

## Verificación antes de publicar

- `npm run lint`
- `npm test`
- `npm run build`
- revisión visual de historial, cotización, catálogo y administración;
- confirmación del despliegue productivo en Vercel.

## Fuera de este cierre

- sincronización definitiva con inventario por depósito;
- fichas técnicas y recomendaciones desde CRM;
- emisión fiscal o PDF desde Contabilium;
- consolidación irreversible de grupos que todavía tengan decisión pendiente.
