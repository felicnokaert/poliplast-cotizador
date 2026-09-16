# Panorama y próxima etapa — Sistema Comercial Grupo Poliplast

**Fecha de corte:** 16/09/2026  
**Horizonte inmediato:** cierre coordinado al 18/09/2026  
**Propósito:** consolidar CRM, cotizador, catálogo, operación comercial, automatizaciones y próximos pasos en una única referencia.

## 1. Resumen ejecutivo

Grupo Poliplast ya cuenta con dos piezas técnicas centrales desplegadas: el CRM y el cotizador comercial. El CRM reporta buena estabilidad técnica y continúa su rework visual; el cotizador ya funciona como aplicación independiente, con historial compartido, catálogo, administración de precios y reglas comerciales, cálculo en USD con equivalencia en ARS y preparación de mensajes de WhatsApp.

El principal límite actual no es construir más pantallas, sino validar la operación real y ordenar los datos. En particular, quedan la depuración definitiva de productos y variantes, la revisión humana de 249 casos ambiguos, el uso cotidiano por el equipo comercial y la definición de las futuras integraciones con inventario, fichas técnicas y Contabilium.

El índice de madurez técnica del CRM (81,2% según la última auditoría reportada) no debe interpretarse como adopción comercial. Del mismo modo, que el cotizador tenga 113 pruebas aprobadas no reemplaza una prueba real completa con usuarios, clientes, precios y mensajes.

## 2. Criterio de confianza de este informe

- **Verificado:** comprobado en código, tests, build, despliegue o documentación técnica vigente del repositorio correspondiente.
- **Reportado:** proviene de handoffs, memorias o cierres anteriores, sin nueva comprobación integral en este corte.
- **Pendiente de validación:** existe técnicamente o fue planificado, pero todavía requiere uso real, decisión de Felipe o verificación en el sistema de origen.

## 3. Estado general

| Frente | Estado | Confianza | Lectura ejecutiva |
| --- | --- | --- | --- |
| CRM | 🟡 En consolidación | Verificado + reportado | Estable técnicamente; falta completar rework visual y QA operativo con datos reales. |
| Cotizador | 🟡 Núcleo listo | Verificado | Aplicación productiva y probada; falta cerrar catálogo y validación operativa. |
| Catálogo maestro | 🟡 En depuración | Verificado | Administración disponible; variantes y duplicados todavía requieren criterio humano. |
| Mercado Libre | 🟡 Monitoreado | Reportado | Auditoría separada del CRM; los cambios continúan siendo manuales. |
| Shopify | 🟡 Requiere seguimiento | Reportado | Automatización autorizada para SEO; queda confirmar si se trató la caída de conversión reportada. |
| Prospección y ventas | 🟡 En ejecución | Reportado | Hay método, metas y materiales; los KPI reales no tienen fuente automática consolidada. |
| Inventario | 🟡 Sistema separado | Reportado | La app de conteo será la futura fuente de stock por SKU; integración con cotizador pendiente. |
| Contabilium | ⚪ Futuro | Reportado | Se conserva como destino de emisión/comercialización, no como generador actual del mensaje del cotizador. |

## 4. CRM (`poli-crm`)

### Estado técnico reportado al 16/09

- Producción: `https://poli-crm.vercel.app/`.
- Commit reportado: `b0a343f`.
- 451/451 pruebas aprobadas, build limpio y despliegue `READY`.
- Cron diario operativo desde el 14/09, con backup automático en Supabase Storage y retención de 14 días.
- Indicador de salud si el mantenimiento diario no corre durante 36 horas.
- Integración OAuth de Mercado Libre retirada del CRM por falta de uso real.
- Rework visual en curso con identidad de Grupo Poliplast; restan Ventas, Tareas, Base técnica, Cartera y Academia.

### Estado funcional reportado

- Empresas con identidad única y múltiples contactos/teléfonos.
- Triage comercial, ayuda contextual, historial, tareas, Academia y persistencia implementados.
- WhatsApp General en uso real.
- WhatsApp Penosil y WhatsApp Juan diferidos; no deben reportarse como operativos.
- Falta transformar la disponibilidad técnica en uso cotidiano comprobado por el equipo.

## 5. Cotizador comercial unificado (`poliplast-cotizador`)

### Estado verificado en este repositorio

- Producción: `https://poliplast-cotizador.vercel.app/`.
- Aplicación separada del CRM, conectada a la misma infraestructura de datos gobernada en Supabase.
- Navegación principal: Cotizaciones, Catálogo y Administración.
- Historial como puerta de entrada y acción para crear una nueva cotización.
- Numeración comercial secuencial desde `0001`.
- Cotizaciones compartidas en Supabase con snapshot histórico por renglón y respaldo local.
- Búsqueda de productos desde tres caracteres o por SKU, evitando desplegar el catálogo completo.
- Precios operados en USD; el total equivalente en ARS se calcula usando el tipo de cambio vigente o manual.
- Tipo de cambio automático con posibilidad de reemplazo manual visible.
- Forma de pago, descuento, estado y observaciones compactados en la interfaz.
- Flujo de guardado, guardado y nueva cotización, vista previa y preparación de WhatsApp.
- Selección o incorporación de teléfono antes de continuar a WhatsApp; el envío final continúa siendo decisión humana.
- Catálogo con filtros y listas minorista/mayorista imprimibles desde el navegador.
- La lista mayorista incluye únicamente productos con condición mayorista aplicable.
- Administración de familia, subfamilia, precio unitario en USD y estado activo/inactivo.
- Políticas comerciales versionadas, desactivables y auditables, sin borrado destructivo.
- Penosil: umbral global de USD 1.800 netos / USD 2.178 final, permitiendo mezclar productos y cajas.
- Tramos por SKU o familia con cantidad mínima, máxima opcional, precio neto y previsualización del precio final con IVA.
- Identidad visual y logos por familia, con variantes adaptables al esquema claro/oscuro cuando corresponda.
- Última verificación técnica: 15 archivos de pruebas, 113/113 tests aprobados, lint aprobado y build productivo aprobado.

### Catálogo y variantes

- 53 variantes marcadas `ACTIVE=FALSO` permanecen ocultas.
- 466 filas fueron detectadas como agrupables con alta confianza, distribuidas en 95 grupos.
- 249 filas son ambiguas y requieren decisión humana; no se fusionan automáticamente.
- Archivo de trabajo: `C:\Users\felip\OneDrive\Desktop\Poliplast\04_Informes\Revision_variantes_cotizador_2026-09-15.xlsx`.
- Decisiones admitidas: `AGRUPAR`, `MANTENER SEPARADO`, `DESACTIVAR` o `REVISAR`.

### Qué no debe considerarse cerrado todavía

- Prueba operativa completa con Felipe y al menos otro usuario.
- Validación de precios y reglas reales por cada familia.
- Consolidación definitiva estilo Shopify de productos y variantes.
- Integración con stock por depósito.
- Fichas técnicas, recomendaciones y venta asistida desde CRM.
- Emisión fiscal o documento formal desde Contabilium.
- Métricas de aceptación, rechazo y conversión de cotizaciones.

## 6. Mercado Libre y Shopify

### Mercado Libre

- La integración dentro del CRM fue retirada.
- La operación real de cinco cuentas continúa mediante una tarea programada de lectura/auditoría.
- No se pausan publicaciones ni se ejecutan modificaciones automáticamente.
- Los duplicados sospechosos deben informarse con número de publicación para decisión manual.
- Hallazgos históricos reportados: duplicados de Resina Epoxi y Easyspray Kit, y campaña FOAM ACOS.

### Shopify

- La tarea programada de martes y jueves puede corregir automáticamente SEO title, meta description y alt text del catálogo antiguo.
- Pendientes reportados: faltantes SEO, colecciones fantasma, brecha ML→Shopify y productos activos con stock cero.
- Riesgo a confirmar: caída reportada de 85% semana contra semana en checkout/conversión.

## 7. Ventas y prospección

### Equipo y metas

- **Ezequiel:** Mar del Plata / Costa Atlántica, Resinplast e Imperpur, venta presencial.
- **Brenda:** Buenos Aires, canal digital y Mercado Libre.
- **Felipe:** alcance nacional, prospección industrial B2B y catálogo cruzado.
- Meta en ritmo crucero: 4 a 6 clientes nuevos por mes por comercial.
- Objetivo de facturación outbound: crecimiento de 20% a 30%.
- Objetivo transversal: cross-selling entre unidades.

### Prospección por familia

- Completadas y reportadas: CARROZADOS/PRFV, QUÍMICA y PENOSIL.
- Pendientes: PLANCHAS PUR, PURMAC, BALDES, PISOS y POLIUREA.
- Los KPI comerciales continúan dependiendo de carga o confirmación humana; ante ausencia de datos deben figurar como `sin confirmar`.

## 8. Gobierno de la información

| Información | Fuente oficial |
| --- | --- |
| Clientes, contactos, conversaciones y tareas | CRM `poli-crm` |
| Cotizaciones, renglones y snapshots comerciales | Cotizador + Supabase |
| Productos, precios y reglas usadas por el cotizador | Catálogo administrable + Supabase |
| Prioridades y trabajo en curso | Trello `VENTAS — Grupo Poliplast` |
| Método comercial y playbooks | `docs/SISTEMA_COMERCIAL_GRUPO_POLIPLAST.md` |
| Reportes para el equipo | Drive: `00_CONTROL` y `05_REPORTES` |
| Prospección por familia | Drive: `03_PROSPECCION/Investigacion_por_familia/` + `PROSPECCION_MAESTRA.xlsx` |
| Stock físico | App de conteo por SKU, hasta definir integración |
| Emisión administrativa/fiscal | Contabilium |

### Advertencia multi-computadora

Las tareas programadas y carpetas locales de las dos computadoras de Felipe no se sincronizan automáticamente. Ningún informe debe asumir que una ejecución o archivo de una computadora existe en la otra. El estado consolidado debe residir en fuentes compartidas —CRM, Supabase, Trello o Drive— y no únicamente en memorias locales.

## 9. Riesgos y mitigaciones

| Riesgo | Impacto | Mitigación recomendada | Responsable |
| --- | --- | --- | --- |
| Confundir estabilidad técnica con adopción | Decisiones basadas en una madurez ficticia | Medir cotizaciones reales, usuarios activos y resultados comerciales | Felipe + equipo |
| Productos duplicados o variantes mal agrupadas | Precio o producto incorrecto | Resolver el Excel de revisión; no fusionar casos ambiguos | Felipe |
| Reglas mayoristas incompletas | Cotizaciones inconsistentes | Validación gradual por familia y versionado de reglas | Felipe + administrador |
| Fuentes locales divergentes | Informes contradictorios | Mover decisiones y seguimiento a fuentes compartidas | Felipe + responsables técnicos |
| Stock desactualizado | Promesas comerciales incorrectas | Mantener stock fuera del cálculo hasta integrar la app por SKU | Inventario + técnico |
| Caída de conversión Shopify sin investigar | Pérdida de ventas | Confirmar el dato y abrir análisis específico | Felipe / canal digital |
| Exceso de alcance antes del cierre | Mucho trabajo abierto y poco validado | Congelar nuevas funciones y priorizar QA + datos | Felipe + Codex/Claude |

## 10. Decisiones que todavía hacen falta

1. **Variantes:** completar primero los casos comerciales de mayor impacto del Excel, no necesariamente las 249 filas de una sola vez.
2. **Reglas mezcladas:** definir por familia si una cotización combinada evalúa cantidades por SKU, por grupo de variantes, por familia o por total monetario.
3. **Stock:** confirmar qué API o tabla compartirá la app de conteo y cuál será la frecuencia de actualización.
4. **Integración CRM–cotizador:** decidir si la primera integración será solamente abrir/crear cotizaciones desde la ficha de empresa o también devolver estados y totales al CRM.
5. **Contabilium:** definir el momento exacto del traspaso: cotización aceptada, pedido confirmado o emisión administrativa.
6. **KPI:** acordar quién registra aceptación, rechazo y motivo de pérdida.
7. **Fase 6 — definición cerrada:** pertenece al frente Catálogo/Compras y cubre costos, precios y rentabilidad. La fuente normativa es el Anexo A de `SISTEMA_COMERCIAL_GRUPO_POLIPLAST.md`; no corresponde reabrirla como pregunta ni incorporarla como fase de ventas.

## 11. Próxima etapa recomendada

### Etapa A — Cierre operativo del cotizador

**Objetivo:** demostrar que el flujo completo funciona con datos reales antes de ampliar alcance.

1. Felipe crea una cotización real o controlada con dos o tres productos de familias distintas.
2. Verifica precios USD, total final, equivalencia ARS, forma de pago y condición comercial aplicada.
3. Guarda, vuelve al historial y reabre la cotización desde otra sesión o equipo.
4. Abre la selección de teléfonos y revisa la vista previa de WhatsApp sin necesidad de enviarla.
5. Imprime una lista minorista total y una mayorista filtrada por familia.
6. Registra defectos concretos con cliente, SKU, cantidad, resultado esperado y resultado obtenido.

**Criterio de salida:** cero errores críticos en guardado, reapertura, cálculo o preparación de WhatsApp; diferencias de catálogo documentadas.

### Etapa B — Saneamiento comercial del catálogo

**Objetivo:** pasar de variantes importadas a productos comerciales claros.

1. Resolver primero Penosil, Resinplast, Baldes, Poliuretanos y Purmac/Repuestos.
2. Mantener variantes legítimas: presentación, peso, litros, color, metros o modelo técnico.
3. Desactivar kits destinados a marketplaces cuando el cotizador deba vender por unidad.
4. Agrupar únicamente casos explícitamente aprobados.
5. Completar precios unitarios y reglas mayoristas faltantes en USD.

**Criterio de salida:** cada producto visible tiene SKU, familia, nombre comercial, unidad, precio minorista y una política mayorista explícita o marcada como inexistente.

### Etapa C — Unión mínima CRM–cotizador

**Objetivo:** evitar doble carga sin convertir ambas aplicaciones en un monolito.

1. Desde la empresa del CRM, abrir una nueva cotización con empresa y teléfonos precargados.
2. Desde el CRM, consultar historial, estado y total de las cotizaciones de esa empresa.
3. Mantener productos, reglas y cálculo dentro del cotizador.
4. Mantener conversaciones, tareas y seguimiento dentro del CRM.

**Criterio de salida:** una empresa tiene una identidad única y su historial comercial puede consultarse sin duplicar contactos.

### Etapa D — Stock y asistencia técnica

**Objetivo:** enriquecer la venta sin bloquear el uso actual.

1. Integrar stock disponible por SKU desde la app de conteo.
2. Mostrar disponibilidad como información, no como bloqueo, hasta validar precisión.
3. Vincular fichas técnicas y recomendaciones desde CRM.
4. Incorporar sugerencias de venta complementaria con cantidades estimadas y explicación visible.

### Etapa E — Contabilium y medición

**Objetivo:** cerrar el circuito administrativo y aprender del resultado comercial.

1. Transferir una cotización aceptada a Contabilium sin reconstruirla manualmente.
2. Registrar aceptación, rechazo y motivo de pérdida.
3. Medir cotizaciones creadas, enviadas, aceptadas, tiempo de respuesta, margen y conversión.
4. Comparar estos KPI con las metas del plan comercial trimestral.

## 12. Reparto de responsabilidades después del 18/09

| Responsable | Alcance |
| --- | --- |
| Felipe | Validar precios, reglas, variantes, prioridades y resultados reales. |
| Equipo comercial | Usar el flujo, reportar defectos con ejemplos y mantener estados comerciales. |
| Codex / Claude Code | Continuidad técnica, correcciones, tests, despliegues e integraciones de repositorios. |
| Claude / chat de ventas | Prospección, documentación comercial, síntesis y preparación de materiales. |
| CRM | Fuente de clientes, relaciones, conversaciones y tareas. |
| Cotizador | Fuente de cotizaciones, reglas aplicadas y snapshots de precios. |

## 13. Qué significa “terminado”

El sistema no se considera terminado por cantidad de pantallas, tests o documentación. Se considera cerrado el primer ciclo cuando:

- un usuario crea una cotización correcta;
- otro usuario puede encontrarla y abrirla;
- el precio y la regla aplicada son explicables;
- el cliente puede recibir un mensaje claro;
- el resultado comercial queda registrado;
- los datos sobreviven a cambios posteriores de catálogo;
- y el equipo puede repetir el proceso sin asistencia técnica.

Hasta entonces, el producto está técnicamente avanzado y operativamente en validación.
