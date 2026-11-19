/**
 * La guía del módulo de Contratistas para la IA (MCP): cómo funciona de
 * verdad (sale de src/lib/contractors/ y de las migraciones de la base),
 * para que explique con las reglas de la app y no adivine. Si cambia una
 * regla allá, se cambia acá.
 */
export const CONTRACTORS_GUIDE = `# Guía: Contratistas en Ebony Manager

Ebony Custom Woodwork (Panamá) trabaja con contratistas: **ebanistas** (arman e instalan muebles) y **pintores**. Esta guía explica cómo la app lleva lo que se les debe. Todos los montos están en dólares (USD).

## 1. El estado de cuenta (la base de todo)

Cada contratista tiene un **estado de cuenta**: una lista de movimientos con fecha. Cada movimiento:
- **sube el saldo** ("a favor": Ebony le debe más), o
- **baja el saldo** ("reduce": Ebony le debe menos, o el contratista debe).

**Saldo = Σ a favor − Σ lo que reduce.** No se guarda: se calcula siempre de los movimientos.
- Saldo **positivo** → Ebony le debe al contratista.
- Saldo **negativo** → el contratista le debe a Ebony (se le pagó o adelantó de más, o tiene descuentos pendientes).

Tipos de movimiento (categoría → efecto):
- **Trabajo, Extra, Bono** → suben el saldo (es lo que se ganó). El trabajo suele llevar piezas con medidas × tarifa.
- **Pago** → baja (dinero entregado).
- **Adelanto** → baja (dinero entregado antes de que se gane).
- **Préstamo** (cada cuota), **Herramienta, Daño, InDrive, Gasto operativo, Otro** → bajan (descuentos).
- **Material** → baja, salvo que se marque "Ebony asume el material": entonces queda anotado pero **no mueve el saldo**.
- **Ajuste** → la persona elige si sube o baja (para corregir).

Una **cuota de préstamo o descuento con fecha futura** (programada) **todavía no cuenta** en el saldo de hoy. Los demás movimientos cuentan en cuanto se registran, tengan la fecha que tengan.

## 2. Contratos

Un **proyecto** es la obra (ej. "Casa Costa del Este"). Un **contrato** es lo que se le encarga a **un** contratista dentro de un proyecto (ej. "Cocina y closets"). Un contratista puede tener varios contratos, en el mismo proyecto o en otros.

- **Valor del contrato** = la suma de los movimientos marcados con ese contrato (trabajo, extra, bono, ajuste). Si se agrega un extra al contrato, su valor sube.
- **Abonado** = lo que se le ha ido pagando a ese contrato (ver abonos).
- **Pendiente** (campo falta_por_pagar) = valor − abonado. Si da negativo, se le abonó de más.
- **Avance de pago (%)** = abonado ÷ valor.
- **Estado**: *Activo* (en curso) o *Terminado*.

## 3. Abonos: cómo un pago llega a un contrato

Todo lo que **baja** el saldo **fuera** de un contrato (un pago, una cuota de préstamo, un adelanto, un material, un daño…) es una **fuente**. Los **abonos** reparten cada fuente entre:
- **contratos** (para ir cubriendo su valor), o
- **créditos sueltos**: lo acreditado **sin** contrato (ej. la historia vieja anterior a usar contratos, o un bono suelto).

Lo que una fuente todavía no tiene repartido queda **"a cuenta"**, y se aplica primero en el próximo pago.

**Siempre cuadra:**
saldo = Σ lo que falta de los contratos + Σ lo que falta de los créditos sueltos − Σ lo que está a cuenta sin repartir.

**Al registrar un pago** (desde la ficha o en el cierre de quincena): primero se usa lo que está **a cuenta** (cuotas de préstamo, adelantos, materiales, descuentos ya registrados) y **el resto es lo que se entrega en efectivo**. Por eso a veces "se abonan $500 a un contrato" pero en efectivo sale menos: parte la cubrieron descuentos que ya estaban a cuenta.

## 4. Cierre de quincena (pagos)

Los contratistas se pagan por **quincena** (el 15 y el último día del mes).
- Mientras la quincena está en **borrador** se decide cuánto abonar a cada contrato de cada contratista; no mueve nada.
- Al marcarla **pagada**, por cada contratista se registra su pago a la fecha de pago, aplicando primero lo que está a cuenta y el resto en efectivo.
- **Reabrir** la quincena deshace exactamente esos pagos y abonos y la deja en borrador.

## 5. Préstamos y descuentos en cuotas

Un préstamo (también adelanto, herramienta, daño, InDrive u otro) se registra con su **monto**, **interés** si tiene y **cuotas** con fecha. Cada cuota es un movimiento que baja el saldo en su fecha; las cuotas futuras no cuentan todavía. Del préstamo se ve: lo prestado, lo ya descontado (cuotas vencidas), lo pendiente y la próxima cuota.

## 6. Retención de garantía (pintores)

A los **pintores** se les retiene un % (hoy 10%) del trabajo y extras **a favor**, desde la fecha en que empezó la regla, **mientras el proyecto no esté terminado**. No es un descuento: es un **tope**. En el contrato no se puede abonar más que *valor − retenido*, así que lo retenido queda pendiente y se puede pagar en cuanto el proyecto se marca terminado. Redondeo hacia arriba al centavo (a favor de la empresa).

## 7. Cierre de saldo

Al inactivar o liquidar a un contratista se puede **cerrar su saldo**: se reparte lo que está a cuenta, se salda la retención pendiente y un ajuste deja el saldo en cero.

## Cómo explicar

- Habla en español claro, sin jerga contable. Siempre con montos y fechas concretas.
- Para "¿por qué tiene ese saldo?": separa lo ganado (trabajo/extra/bono), lo entregado (pagos/adelantos) y los descuentos (cuotas, material, daños), y cuadra.
- Para un contrato: valor, abonado, pendiente, retenido (si es pintor) y qué se puede pagar hoy.
- Si algo no cuadra o no tienes el dato, dilo. No inventes movimientos.
- Por esta conexión se puede **crear un contrato** (crear_contrato), **registrar un abono** (registrar_abono), **registrar un movimiento** en el estado de cuenta (registrar_movimiento: material, gasto operativo, extra, bono, trabajo o ajuste) y **registrar un préstamo o descuento en cuotas** (registrar_descuento: préstamo, adelanto, herramienta, daño, InDrive u otro), siempre en dos pasos: primero la vista previa, y solo con el "sí" de la persona se confirma. Lo demás (cierres de quincena, editar, cancelar o borrar) se hace en la app.

## Crear un contrato desde una foto o un plano

1. Identifica al contratista y el proyecto (pregunta si no está claro) y busca sus tarifas con tarifas_mano_de_obra (las del tipo del contratista: ebanista o pintor).
2. Saca de la imagen cada pieza con sus medidas y conviértelas a la unidad de la tarifa: **m²** = ancho × alto en metros; **ML** = metros lineales; **unidad** = cantidad de piezas. En ebanistas, el armado y la instalación son tarifas distintas (fase).
3. Si una medida no se lee, es ambigua o no hay una tarifa que corresponda, **pregunta**; no la inventes.
4. Pide la vista previa, muéstrasela a la persona (piezas, cantidades, precios y total) y confirma solo si dice que sí.

## Registrar un abono

Indica cuánto va a cada contrato (no puede pasar de lo que se puede pagar hoy, por la retención de pintores). La vista previa dice cuánto se descuenta de lo que está a cuenta y cuánto se entrega en efectivo: explícaselo a la persona antes de confirmar.

## Registrar un movimiento (ej. "agrégale material que le resta")

Es lo mismo que "Agregar movimiento" en la ficha del contratista:
- **Material** y **gasto operativo** restan. Se pueden **abonar a un contrato** (contrato_id): cubren parte de lo que falta pagarle de ese contrato, y lo que no quepa queda a cuenta. Un material que **Ebony asume** (ebony_asume) queda anotado pero no le resta ni se abona.
- **Extra** y **bono** suman; con contrato_id son parte del valor de ese contrato. Un **trabajo** suma y va **siempre** a un contrato (si no existe, usa crear_contrato).
- **Ajuste**: pregúntale a la persona si **suma** o **resta** (direccion); no lo supongas.
- El monto va en dólares, o por área (m2 × costo_por_m2).
- **Préstamos, adelantos, herramientas, daños e InDrive** no van aquí: van con registrar_descuento (con cuotas). Los pagos van con registrar_abono.

Si no sabes a qué contrato va, usa la herramienta contratos y pregunta. Muestra la vista previa (tipo, monto, si suma o resta, saldo de hoy y saldo después) y confirma solo con el "sí".

## Registrar un préstamo o descuento en cuotas

Para préstamo, adelanto, herramienta, daño, InDrive u otro descuento (registrar_descuento):
- Pregunta el monto y **en cuántas cuotas** (quincenas). Si no lo dicen, pregunta; no supongas que es una sola, salvo adelanto e InDrive, que siempre son una.
- Por defecto el préstamo y los demás empiezan **la quincena siguiente** a la fecha; el adelanto y el InDrive caen en la quincena de la fecha. Se puede elegir otra primera quincena.
- Interés solo si la persona lo dice (mensual %, % total o monto fijo).
- La vista previa muestra cada cuota con su fecha: las que ya llegaron restan hoy, las futuras restan en su fecha.
`;
