# Plan: módulo Taller (trabajos, CNC y producción)

> Estado (17 nov): **Etapa 1 construida** (sección Taller → Trabajos con el tipo CNC, archivos en Drive, avisos, pestaña Taller en la ficha del proyecto; permiso `taller`). Antes: Acordado con Carlos el 15–16 nov 2026. Revisar antes de empezar la etapa 1.

## Decisiones de estructura (16 nov)
- **Módulo «Taller»**, con sus partes internas como hoy tiene Almacén (subsecciones / pestañas; la forma exacta se decide en diseño):
  1. **Torre de control** — vista de gerente: **cada carril (fila) es un proyecto, cada tarjeta es un mueble/plano, cada
     columna es una etapa** del recorrido en **secuencia** (diseño → aprobación → corte y canteo → armado → pintura si lleva →
     instalación). Las tarjetas avanzan de columna. Al abrir un mueble se ven sus trabajos. *(Llega en la etapa 3.)*
  2. **Trabajos** — la cola por área (CNC, muestras de pintura…). *(Se construye en la etapa 1.)*
- **Recorrido ≠ trabajos.** Las etapas del recorrido van una tras otra y mueven el mueble. Los trabajos (un corte de CNC,
  una muestra) son **independientes**: tienen su propio estado y **no mueven ni frenan** el recorrido; pueden enlazarse a un
  proyecto o mueble solo como referencia.
- Las etapas con responsable (ej. armado repartido entre armadores) también aparecen en «Asignados a mí» de esa persona,
  aunque sigan siendo pasos de la secuencia.
- **No hay sección «Mis trabajos».** Lo de cada uno es un **filtro**: **Todos / Asignados a mí / Pedidos por mí**, más tipo,
  responsable y proyecto. La app recuerda el último filtro de cada persona (el operario abre en «Asignados a mí»).
- **Inicio por rol (proyecto aparte, más adelante):** el Dashboard pasa a ser la página de inicio de cada usuario según su rol
  (sus trabajos pendientes y atrasados, alertas, aprobaciones esperando, gráficos de sus módulos). Ahí se juntan «lo mío» de
  todas las áreas. Mientras tanto, el operario entra directo a la pestaña Trabajos con su filtro.

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
- **Formato confirmado (16 nov): las diseñadoras le pasan al operario solo DXF** (80–180 KB). La descarga a través de la
  app (límite ~4 MB) alcanza. Igual se muestra un aviso claro si alguien sube algo más pesado. (DWG de hasta 10 MB y
  SketchUp de hasta 65 MB existen en Drive, pero no son de la CNC; si algún tipo de trabajo los necesita, resolver la
  descarga grande entonces.)

## Etapas
1. **Sección nueva con la pestaña Trabajos + tipo CNC** — crear (diseñadoras / jefe de taller), asignar al operario,
   DXF en Drive, estados, fechas, avisos, tablero y lista con filtros (Todos / Asignados a mí / Pedidos por mí, tipo,
   responsable, proyecto), trabajos en la ficha del proyecto. Ya deja el espacio para colgarse de una orden de producción.
2. **Muestras de pintura** — se crean desde el formulario de Jotform que ya llenan las chicas; asignadas al pintor (contratista).
3. **Órdenes de producción** leídas desde Jotform (plano, despiece, aprobación de Brainer, fechas), enlazadas a ítems de
   la cotización, con el metraje.
4. **Taller** — contratos de armado y pintura desde la orden (sin asignar hasta darlos), armado repartido entre
   armadores, encargos externos (herrero, tapicero, espejos), instalación.
5. **Tableros** — tiempos, atrasos y carga por persona.

## Pendientes por verificar
- [ ] ¿Jotform deja leer el **estado de aprobación** de Brainer (no solo el envío)? Si no, otra vía (aviso cuando cambia).
- [ ] Cómo capturar el **metraje** como datos.
- [x] Formato de la CNC: **DXF** (confirmado). Descarga grande no hace falta para la etapa 1.
- [x] Nombre: **Taller**.
- [x] El operario usa **computadora** (avisos en el navegador de esa computadora; aceptar notificaciones una vez; la lista también se actualiza sola).
- [x] Datos de una orden de CNC: **proyecto (o interno), archivo(s) DXF, posiblemente el plano (PDF u otro), notas**; más responsable (el operario por defecto) y para cuándo.
- [x] El operario **no sube nada** de vuelta: solo descarga.
- [x] **Sin** estado «Con problema» por ahora.
- [x] Editan y borran **todas las diseñadoras** (y quien tenga acceso a Taller): se cubren entre ellas. Borrar pide confirmación y manda los archivos a la papelera de Drive (30 días).
- [ ] ¿El operario ya tiene usuario en la app? (si no, invitarlo desde Settings → Usuarios)
- [ ] Estructura de carpetas de proyecto en Drive (dónde crear «CNC» y «Taller interno»).

## Nombre
**Taller.**

## Etapa 2 · Muestras de pintura (18 nov, publicada)

- Reemplaza el formulario de Jotform «Solicitud Muestra Pintura». Una solicitud = trabajo `muestra` con varias muestras
  (nombre, tipo SW/BM/Chapilla/Otro, tipo de chapilla, fotos de referencia). Pintor por turno (contratista), aviso por
  correo, fecha al sábado (dom–mié → ese sábado; jue–sáb → el siguiente), editable.
- Lista solo con foto terminada de cada muestra y código oficial si es SW/BM (la base lo exige).
- **Dónde vive**: Taller queda solo con el tablero. *Historial de colores* = `/taller/colores` (botón en el encabezado);
  los colores de un proyecto salen en su pestaña Taller. *Configuración* (pintores del turno y tipos de chapilla) =
  Settings → Formularios (solo admin), con atajo «Configurar» dentro de la solicitud. Settings → Formularios es el
  lugar para la configuración de los próximos formularios.
