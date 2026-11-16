# Plan: módulo Taller (trabajos, CNC y producción)

> Estado: **solo planeado, nada construido.** Acordado con Carlos el 15–16 nov 2026. Revisar antes de empezar la etapa 1.

## Por qué
Hoy el operario de la CNC baja los archivos de las diseñadoras desde una carpeta de Google Drive que usa todo el
mundo con una sola cuenta; hace poco borraron una carpeta sin querer. Se quiere que los archivos se usen **solo desde
la app** y llevar el seguimiento de cada trabajo (por hacer → en proceso → listo).

La CNC es el primer caso de algo más grande: muestras de pintura para el pintor, planos y despieces de las
diseñadoras, armado en taller, encargos a herreros/tapiceros/vidrieros, instalación. Todo debe caber en el mismo diseño.

## Las tres capas

### 1. El trabajo (base de todo y de «Mis trabajos»)
Un encargo concreto para alguien. Todos los tipos comparten:
- **Tipo** (CNC, muestra de pintura, plano, despiece, armado, encargo externo, instalación…), con campos propios por tipo.
- **Responsable**: persona de Personal (todos los de la empresa están ahí), contratista o proveedor externo (Directorio).
- **Quién lo pidió.**
- **Proyecto** (opcional: hay trabajos internos del taller) y **orden de producción** (opcional; se usa desde la etapa 3).
- **Estado**: Por hacer → En proceso → Listo, más Cancelado.
- **Fechas**: pedido, para cuándo, empezó, terminó.
- **Archivos, notas e historial** (quién cambió qué y cuándo: sirve para medir tiempos y atrasos).
- **Avisos**: al responsable cuando le llega un trabajo; a quien lo pidió cuando queda listo (la app ya tiene notificaciones push).

**«Mis trabajos»** sirve igual para todos (operario CNC, pintor, diseñadoras, armadores…): cada uno ve lo suyo.

### 2. La orden de producción (el plano)
La unidad de producción **no es el ítem de la cotización sino el plano**: un plano puede juntar varios ítems
(ej.: bar + mueble de TV + bufetera de una sala = 3 ítems, 1 plano), y su armado puede repartirse entre varios
armadores. Se enlaza con **uno o varios ítems** de la cotización aprobada (y, por si acaso, un ítem podría repartirse
entre planos). De ella cuelgan sus trabajos.

### 3. El recorrido (hoy en Jotform)
Medidas → plano → idas y vueltas con cliente/arquitecto → aprobación del cliente → formulario de Jotform con plano,
cotización de proveedores y despiece → **Brainer aprueba o rechaza** (se repite hasta aprobar) → las diseñadoras
facturan con el proveedor (corte y canteo) y cargan las fechas de entrega a taller → **ahí cierran su ciclo** → taller
(armado) → instalación.

**Decisión: conectar Jotform, no reemplazarlo.** Las diseñadoras siguen en Jotform; la app lee los envíos (plano,
cotización de proveedores, despiece, estado de la aprobación, fechas de entrega) y arma/actualiza la orden de
producción. Cuando queda aprobada y con fechas, en la app empieza lo del taller. Si algún día conviene llevar el flujo
completo a la app, se decide después.

## Contratos que nacen de la orden de producción
Los contratos de armado (ebanistas) y de pintura (pintores) se crearán desde la orden de producción, ya valorizados
con las **tarifas de mano de obra** que existen (por m², metro lineal o unidad, y por fase), y quedan **sin asignar**
hasta darle un contratista. Hoy se crean a mano para poder pagarlos.
Implica:
- El **metraje** (m² de armado, m² de pintura, ml, unidades) debe llegar **como datos**, no solo dentro del plano
  (campos en Jotform o al crear la orden). Decidir en su etapa.
- Un contrato podrá existir **sin contratista** y **enlazado a su orden de producción** (cambio pequeño al modelo de contratos).

## Fronteras con otros módulos
- **Almacén / Compras**: inventario, suministros y materiales de stock.
- **Taller (trabajo tipo «encargo externo»)**: lo que se manda a hacer para un mueble específico (espejo, estructura de
  metal, tapizado), con proveedor del Directorio, fecha prometida, seguimiento de entrega y costo. El seguimiento vive en
  producción; si hace falta, se enlaza el costo con compras o gastos del proyecto sin duplicar el seguimiento.

## Quién ve qué
- **Todos ven todo** (la fila de la CNC, de pintura, etc.), con filtro **«solo lo mío»**.
- **El dinero** (valores de contratos, costos) sigue restringido con los permisos actuales.
- Crean órdenes de CNC: **diseñadoras y jefe de taller**. Hoy hay **un solo operario** (ya está en Personal).

## Archivos
- Viven en **Google Drive** (unidad compartida), en la carpeta del proyecto, subcarpeta «CNC»; los internos en
  «Taller interno». **Nadie entra a Drive**: se sube, descarga y borra solo desde la app; borrar en la app borra en Drive
  (Drive los guarda 30 días en su papelera). Sin carpetas con permiso abierto: la app entra con su propia llave.
  No se usa el almacenamiento de Supabase (para no pagarlo).
- **Tamaños reales (revisados el 15 nov):** DXF 80–180 KB; DWG de 30 KB a **10 MB**; SketchUp hasta 65 MB (el operario
  no usaría SketchUp, solo AutoCAD; Carlos lo confirma).
- **Problema técnico:** hoy la descarga pasa por el servidor de la app (límite ~4 MB). Subir grandes ya funciona (va
  directo a Drive). Antes de construir, **probar con un DWG de 10 MB** dos salidas: enviar por partes a través de la app,
  o enlace temporal que vence en minutos. Ninguna abre carpetas.

## Etapas
1. **Trabajos + tipo CNC + «Mis trabajos»** — crear (diseñadoras / jefe de taller), asignar al operario, archivos en
   Drive, estados, fechas, avisos, tablero en el módulo **Taller** (todo visible + «solo lo mío»), trabajos en la ficha del
   proyecto. Ya deja el espacio para colgarse de una orden de producción.
2. **Muestras de pintura** — se crean desde el formulario de Jotform que ya llenan las chicas; asignadas al pintor (contratista).
3. **Órdenes de producción** leídas desde Jotform (plano, despiece, aprobación de Brainer, fechas), enlazadas a ítems de
   la cotización, con el metraje.
4. **Taller** — contratos de armado y pintura desde la orden (sin asignar hasta darlos), armado repartido entre
   armadores, encargos externos (herrero, tapicero, espejos), instalación.
5. **Tableros** — tiempos, atrasos y carga por persona.

## Pendientes por verificar
- [ ] ¿Jotform deja leer el **estado de aprobación** de Brainer (no solo el envío)? Si no, otra vía (aviso cuando cambia).
- [ ] Cómo capturar el **metraje** como datos.
- [ ] Descarga de **archivos grandes** (probar con DWG de 10 MB).
- [ ] Qué formato abre el operario (Carlos lo averigua).
- [ ] Estructura de carpetas de proyecto en Drive (dónde crear «CNC» y «Taller interno»).

## Nombre
Módulo **«Taller»** (se puede cambiar después).
