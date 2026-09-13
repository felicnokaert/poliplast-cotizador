# Diagnóstico de unidades físicas pendientes

Fecha de observación: 2026-09-13. Entorno: catálogo autenticado de Supabase, aplicación local.

## Hallazgo

- SKU `KT-ALCCV2-603513-2`
- Nombre: `ALMOHADA CERVICAL 60X35 BLANCA VISCO (X2) + CUELLO PARA VIAJE (X 2)`
- Cantidad cotizada: 1 presentación
- Resultado del motor usando `catalog_variants.attributes.units_per_pack`: **1 unidad física**

El nombre describe un kit con componentes múltiples, pero el atributo autoritativo disponible hace que el motor compute una sola unidad física. No se corrigió ni se infirió una cantidad desde el nombre porque este bloque no autoriza cambios en Supabase ni homologaciones visuales.

## Acción requerida

Felipe/Claude Code deben confirmar qué significa “unidad física” para kits mixtos y, sólo con esa definición aprobada, corregir `catalog_variants.attributes.units_per_pack` y su `pack_group` si corresponde. Hasta entonces el cotizador mantiene el valor persistido y hace visible el cómputo para que el vendedor pueda detectar la discrepancia.

## Control positivo

El SKU `ALVEB-CL6035-2` (`ALMOHADA DE VELLON 60 X 35 CLÁSICA X 2`) computó correctamente 2 unidades físicas por presentación. En QA, 100 packs mostraron 200 unidades y faltante de 1 unidad para mayorista; 101 packs mostraron 202 unidades y activaron la regla aprobada de USD 5,15 neto + IVA 21% = USD 6,2315 final por unidad física.

## Penosil observado en el cambio a umbral monetario

El SKU `KT-PS-810ML-12 (ESP+PIST)` no tiene una regla mayorista confirmada vinculable por `pack_group` en los datos cargados. En una mezcla que superó USD 1.800 netos, el motor aplicó mayorista al SKU confirmado `PS-810ML-6` y mantuvo consumidor final para el kit, mostrando “precio mayorista pendiente”. Hace falta confirmar/cargar el precio mayorista del kit antes de que toda la lista Penosil pueda cumplir literalmente la política comercial indicada.
