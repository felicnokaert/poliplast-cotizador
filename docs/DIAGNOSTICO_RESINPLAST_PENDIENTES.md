# Diagnóstico: Resinplast sin mayorista, ADHEP y 840T

**Tipo:** solo lectura. No se cargó ningún valor nuevo ni se infirió ninguna conversión.
**Fecha:** 12/09/2026

## Hallazgo que corrige un dato previo

Se venía asumiendo "100 SKU Resinplast, 70 sin mayorista". La cifra real en el catálogo cargado es otra:

- **Familia RESINPLAST, `status = vigente`: 480 SKU en total.**
- **30 con precio mayorista confirmado** (lote `Resinplast Mayorista 2026`, ver reporte anterior).
- **450 sin mayorista.**

## Por qué 480 y no ~100: desglose por subfamilia

| Subfamilia | Total | Con mayorista |
|---|---:|---:|
| Pigmentos | 265 | 0 |
| Resinas Epoxi | 82 | 2 |
| Moldes | 26 | 0 |
| Accesorios | 24 | 2 |
| Gel Coats | 16 | 2 |
| Fibras y Tejidos | 15 | 9 |
| Diluyentes y Solventes | 13 | 3 |
| Resinas Náuticas | 11 | 1 |
| Foam | 8 | 0 |
| Catalizadores | 7 | 4 |
| Desmoldantes | 6 | 3 |
| Cargas y Aditivos | 4 | 4 |
| Pinceles y Rodillos | 3 | 0 |

**Lectura, sin inferir nada más allá de contar filas:**

- `Pigmentos` (265) y `Moldes` (26) no aparecen en ninguna categoría del PDF `Resinplast · Mayorista 2026.pdf`. Es probable que el "100 SKU" que se venía manejando se refiriera solo al núcleo comercial del PDF (resinas, catalizadores, diluyentes, desmoldantes, fibras, cargas, gel coats, pinceles, epoxi puro), sin pigmentos ni moldes — pero **esto es una hipótesis, no until que alguien lo confirme**. No excluí nada del conteo por mi cuenta.
- `Resinas Epoxi` (82) está inflado por combos tipo kit (`KT-REPOXI-*`, `KT-R29-*`, `KT-GC*`) que combinan resina + tela en distintos gramajes — son ítems de venta compuestos, no las materias primas sueltas que cotiza el PDF. No decidí si deben o no tener mayorista propio.

**Antes de tocar estos 450, hace falta que alguien (Felipe/Codex) confirme el alcance real**: ¿el "núcleo Resinplast" a mayorista son ~100 SKU (excluyendo pigmentos, moldes, foam y kits), o realmente hay que cotizar mayorista para las 480 variantes?

## Caso ADHEP — units incompatibles, no solo presentaciones distintas

El PDF cotiza `ADHEP` a USD 8,70/kg como ítem único. El catálogo tiene 5 variantes, y el problema es más profundo que "5 tamaños distintos": **las unidades de venta no son homogéneas**.

| SKU | Nombre | Unidad de venta | Consumidor final actual |
|---|---|---|---:|
| ADHEPLAST-0.5 | Adhesivo poliuretánico 500CC | unidad | USD 13,897 |
| ADHEPLAST-1 | Adhesivo poliuretánico 1000CC | unidad | USD 22,131 |
| ADHEPLAST-2 | Adhesivo poliuretánico 2000CC | unidad | USD 45,472 |
| ADHEPLAST-5 | Adhesivo poliuretánico X 5 KG | unidad | USD 114,902 |
| ADHEPLAST-10 | Adhesivo poliuretánico X 10KG | unidad | USD 229,803 |

Tres presentaciones están en **CC** (volumen) y dos en **KG** (peso). Convertir el precio por kg del PDF a cada una exige la densidad del producto (g/cm³) para las de CC, dato que no está en ningún lado del catálogo ni del PDF. No lo inventé. Queda pendiente de que Felipe confirme la densidad o directamente el precio mayorista de cada presentación.

## Caso 840T — confirmado ausente, no es un problema de nomenclatura

Busqué por SKU (`%840%`) y por nombre (`%cera%desmold%`, `%840%`) en toda la familia RESINPLAST: **cero resultados**. "Cera desmoldante 840" (USD 5,60/u. en el PDF) no existe como producto en el catálogo cargado bajo ningún código. No es un caso de sufijo faltante como los 6 que sí se resolvieron la vez pasada — genuinamente no está. Si el producto se vende, hay que darlo de alta primero en el Catálogo Maestro (fuera del alcance de esta corrección de precios).

## Trazabilidad

Nada de este documento generó filas en `catalog_import_jobs`/`catalog_import_rows` porque no se aplicó ningún cambio — es puro diagnóstico. La carga previa de los 30 mayoristas sigue siendo el único lote real, en el job `fe687190-30a1-49c2-9c12-536985cdf330`.

## Pendiente de decisión (no de mi parte)

1. Confirmar el alcance real de "Resinplast mayorista": ¿~100 SKU núcleo (sin pigmentos/moldes/kits) o las 480 variantes?
2. ADHEP: densidad o precio mayorista directo por presentación.
3. 840T: si se vende, darlo de alta en el Catálogo Maestro antes de cotizarlo.

No voy a tocar componentes React ni estilos mientras dure el bloque de rediseño de Codex. Este diagnóstico queda esperando aprobación antes de cualquier carga nueva.
