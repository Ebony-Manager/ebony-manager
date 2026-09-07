# Fase 2 — Planilla: qué se reusa de Atlas y qué cambia para Ebony

Doc corto para arrancar la Fase 2. Referencia: **solo** el módulo Payroll de
Atlas (Life OS), en `src/app/household/payroll/`, `src/services/payroll.ts` y
`src/lib/home/payroll-*.ts`.

Idea de fondo: Atlas guarda en **SQLite local**, Ebony guarda en **Supabase
(Postgres) con RLS**. Cambia la **capa de datos**. Las **fórmulas de cálculo**
(décimo, vacación proporcional, prima de antigüedad, tarifas por hora/día,
cuotas de préstamo) se reusan **casi tal cual**, porque el modelo de columnas
es el mismo.

---

## Alcance de esta rama (`feat/fase2-planilla`)

**Incluye:** planilla de empleados **fijos asalariados por quincena**.

- Empleados: registro, salario mensual en papel, base separada para
  prestaciones, datos de contacto, liquidación.
- Quincenas (Registro): quincena base, horas/días extra, horas/días
  descontados, viáticos, bonos, días libres, décimo/vacación/prima pagados,
  método de pago, marcar como pagada.
- Préstamos / adelantos / herramientas / daños: ledger con saldo, y
  préstamos con calendario de cuotas que se auto-aplican a quincenas
  futuras.
- Pantallas: **Registro**, **Resumen Anual**, **Auditoría**, **Dashboard**,
  **Directorio (Empleados) + Detalle**.

**NO incluye** (otra rama, después): ebanistas por proyecto, pintores con
cuenta de materiales. Solo se deja el nombrado limpio (`payroll_*`,
`payroll_employees` = trabajador de planilla) para que un módulo
`contractors` / `contractor_*` viva al lado sin rehacer esto.

**Seguridad:** la planilla es **solo admin**. Un trabajador que algún día use
la app **nunca** ve este módulo. RLS de las 4 tablas cerrada a
`private.is_admin()`. Los empleados de planilla son **trabajadores**, van en
su propia tabla `payroll_employees`, **no** colgados de `profiles`.

---

## 1. Se reusa TAL CUAL (copiar y solo cambiar imports)

### Fórmulas puras — `src/lib/home/payroll-*.ts` → `src/lib/planilla/`

| Archivo Atlas | Qué hace | Cambio |
|---|---|---|
| `payroll-period.ts` | `MONTHS_ES`, `periodKey`, `currentPeriod`, `periodOrdinal`, `nextPeriod`, `previousPeriod`, `formatCents` | **Ninguno.** Es matemática de quincenas, sin DB. |
| `payroll-rates.ts` | `hourlyRateCents` (÷240), `dailyRateCents` (÷30), `quantityToCents` (redondeo) | **Ninguno**, salvo el tipo `PayrollEmployee` importado. Constantes de la hoja "Ebony - Planilla 2026" — ya son de Ebony. |
| `payroll-loans.ts` | `computeLoanSchedule` (reparte principal en cuotas iguales, el sobrante va a la última), `defaultLoanStartPeriod`, `loanPayoffPeriod` | **Ninguno.** Lógica pura. |
| `payroll-colors.ts` | Colores por categoría de concepto para las tablas | Revisar contra los tokens de Ebony (madera/dorado) en vez de la paleta de Atlas. Cosmético. |

### Fórmulas de acumulado — el corazón de `services/payroll.ts`

Estas funciones **no tocan tipos de SQLite**, solo reciben un
`lookup: (period) => PayrollPeriodTotal`. Se reusan enteras; lo único que
cambia es de dónde sale ese `lookup` (ver sección 2):

- `computeDecimoAccrualCore` — décimo = pago del segmento a la fecha ÷ 12.
  Segmentos fijos de Panamá: 16-dic, 16-abr, 16-ago (8 quincenas c/u).
  `decimoSegmentStart` incluido.
- `computeVacationAccrualCore` — vacación proporcional = 9.09% (1/11) de todo
  lo pagado desde el último pago real de vacación. Reinicia la quincena
  siguiente a un pago. `lastVacationPayoutPeriod` (búsqueda estricta `<`).
- `computePrimaAntiguedadAccrualCore` — prima de antigüedad = 1.92% del
  salario mensual por mes trabajado (Art. 196 CT / Ley 44/1995). Cuenta
  meses desde `start_date`, o desde una liquidación registrada (`end_date`)
  si el `asOf` es posterior.
- `salaryCompensationCents`, `accrualAmountForPeriod` — helpers de las 3 de
  arriba. Sin cambios.
- `computePeriodTotalFromEntry` — la fórmula del total de una quincena:
  `base + extras + viáticos + bonos + días libres + décimo/vac/prima
  pagados − horas/días descontados − otros descuentos − abonos del ledger`.
  **Regla de oro reusada:** ningún total se guarda; todo se computa al leer.

### Reglas de negocio reusadas (no son código, son decisiones)

- **Dinero en centavos enteros** (`integer`). Nada de floats para plata.
- **Congelar la tarifa al momento de entrar:** al guardar horas/días extra o
  descontados, se guarda la cantidad *y* los centavos a la tarifa de ese
  momento; un cambio de salario futuro no reflota quincenas viejas.
- **Nunca reescribir historia:** liquidación, reset de décimo/vacación y
  cancelación de préstamo solo tocan quincenas futuras no pagadas.
- **Préstamo = materializar todas las cuotas ya:** al crear el préstamo se
  crean todas las filas `payment` del ledger, cada una enganchada a su
  quincena futura, para que el descuento no dependa de que alguien se
  acuerde cada quincena.
- **`benefits_base_salary_cents`:** base alterna opcional para calcular
  prestaciones sobre un salario distinto (caso "Acumulado a 500").
- **Caja de Seguro Social:** categoría del ledger pero **informativa** —
  nunca baja lo que se le paga a la persona.

---

## 2. Qué CAMBIA para Ebony (capa de datos)

### 2.1 SQLite `better-sqlite3` síncrono → Supabase `@supabase/ssr` async

Es el cambio más grande y el más mecánico.

| Atlas | Ebony |
|---|---|
| `import { getDb } from "@/lib/db/client"` | `import { createClient } from "@/lib/supabase/server"` |
| `db.prepare("SELECT ...").get(id)` **síncrono** | `await supabase.from("...").select().eq().maybeSingle()` **async** |
| `db.prepare("INSERT ... ON CONFLICT ... DO UPDATE")` | `await supabase.from("...").upsert(row, { onConflict: "employee_id,period_year,period_month,period_half" })` |
| Todo el servicio es síncrono | Todo el servicio pasa a `async` / `await`; los server actions ya eran `async`. |

Implicación: `services/payroll.ts` se vuelve async de punta a punta. Las
funciones de acumulado que hoy reciben un `lookup` síncrono pasan a recibir
el resultado ya cargado (patrón `loadEmployeeContext` de Atlas, que ya
batchea todo el historial del empleado en 2 queries y arma un `Map` en
memoria — **portar esa versión, no la de "una query por período"**).

### 2.2 Esquema: tipos Postgres en vez de SQLite

| Atlas (SQLite) | Ebony (Postgres) | Por qué |
|---|---|---|
| `id TEXT PRIMARY KEY` + `nanoid()` en la app | `id uuid primary key default gen_random_uuid()` | Que lo genere la DB; menos código, IDs opacos. |
| `datetime('now')`, columnas TEXT de fecha-hora | `timestamptz default now()` | Tipo real de fecha. |
| Fechas de calendario en TEXT (`start_date`, `entry_date`, `request_date`) | `date` | Comparaciones y casts correctos. El código pasa strings `YYYY-MM-DD`, castean solas. |
| `paid INTEGER` (0/1) | `boolean` | — |
| `extra_hours REAL` (y demás cantidades) | `numeric(10,2)` | Cantidades a centésimas sin drift de float. |
| `*_cents INTEGER` | `*_cents integer` | **Igual: centavos enteros.** Un renglón = una quincena de una persona, no se acerca al techo de `integer` ($21.4M). Si algún día hiciera falta → `alter type bigint`, sin tocar fórmulas. |
| `UNIQUE (employee_id, period_year, period_month, period_half)` | igual | Clave natural de la quincena. |

### 2.3 Columnas que se ELIMINAN

- **`property_id`** (en `payroll_employees`, y el filtro `propertyId` en todo
  el servicio y los server actions). Atlas es multi-propiedad ("la casa", "la
  finca"); Ebony es **una sola empresa**. Se borra la columna, el índice, y
  el parámetro `propertyId` de `getPayrollEmployees`, `getRegistroForPeriod`,
  `getAnnualSummary`, `getUpcomingObligations`, `getAuditoriaData`,
  `duplicatePreviousPeriod`.
- **`finance_transaction_id`** (en `payroll_entries`, FK a `transactions` de
  Atlas). Ebony no tiene módulo de Finanzas/Gastos todavía. Se puede
  re-agregar como referencia blanda cuando exista el módulo de Gastos.
- **Tabla `documents`** (Atlas la usa para adjuntar el contrato firmado o el
  scan de cédula con `entity_type = 'employee'`). Ebony no la tiene. Fuera
  de alcance: `contract_info` queda como texto libre; los adjuntos vienen
  después con una tabla de documentos genérica.

### 2.4 Seguridad: SQLite no tiene → RLS en Postgres

Atlas no tiene control de acceso a nivel de DB (app local de una persona).
Ebony sí. Se replica el patrón de la Fase 1
(`20260906170000_fase1_auth_rls.sql`):

- RLS `enable` en las 4 tablas.
- Una policy por tabla: `for all to authenticated using (private.is_admin())
  with check (private.is_admin())`. **Solo admin.** Vendedor no ve nada.
- `revoke all ... from anon`.
- Reusa los helpers del esquema `private` de la Fase 1: `private.is_admin()`
  y `private.touch_updated_at()` (para `updated_at`). **No se redefinen.**
- `service_role` no se usa nunca desde la app (regla de FOUNDATION.md §4).

### 2.5 UI: piezas compartidas ya presentes

Atlas usa shadcn/ui sobre Radix; Ebony ya trajo esas piezas
(`src/components/ui/`). Las vistas de Atlas usan `Tabs`, `Select`,
`Dialog`/`Sheet`, `DropdownMenu`, `Popover`, `Badge`, `Button`, `Input`,
`Form` — todas existen. Cambios:

- Imports `@/components/ui/*` (igual) y helpers propios de Atlas
  (`@/components/shared/form-dialog`, `@/components/finance/multi-select-filter`,
  `@/lib/finance/format-date`) → portar o sustituir por equivalentes de
  Ebony.
- `EmpleadoAvatar`, `payroll-kpi-card`, `monthly-evolution-chart`,
  `proximas-obligaciones-card` → portar tal cual, revisando colores contra
  tokens de Ebony.
- **Bilingüe ES/EN:** Atlas es solo ES. Ebony exige ES+EN en todo texto
  visible (CLAUDE.md). Hay que pasar cada label por el `i18n` de Ebony
  (`src/lib/i18n.ts` / `language-context`). Es trabajo nuevo, no port.
- Ruta: Atlas vive en `/household/payroll`. En Ebony va como módulo propio,
  p. ej. `/(app)/planilla/`, con su item en el sidebar **visible solo para
  admin**. `revalidatePath` de los server actions apunta a la ruta nueva.

### 2.6 `getPayrollEmployee` / `getPayrollEmployees` (`services/payroll-employees.ts`)

El servicio de empleados de Atlas (`services/employees.ts`) se porta a
`src/services/payroll-employees.ts` — nombre alineado con la tabla, para no
chocar con un futuro servicio de contratistas. Se pasa a Supabase igual que
`payroll.ts` (async, `.from("payroll_employees")`), se le quita `propertyId`,
y el orden ("activos primero, luego por `sort_order`, luego por nombre") se
mantiene con `.order()`.

---

## 3. Mapa de archivos Atlas → Ebony

| Atlas | Ebony | Acción |
|---|---|---|
| `src/lib/home/payroll-period.ts` | `src/lib/planilla/payroll-period.ts` | copiar, sin cambios |
| `src/lib/home/payroll-rates.ts` | `src/lib/planilla/payroll-rates.ts` | copiar, ajustar import de tipo |
| `src/lib/home/payroll-loans.ts` | `src/lib/planilla/payroll-loans.ts` | copiar, sin cambios |
| `src/lib/home/payroll-colors.ts` | `src/lib/planilla/payroll-colors.ts` | copiar, revisar paleta |
| `src/services/employees.ts` (parte planilla) | `src/services/payroll-employees.ts` | reescribir capa DB → Supabase async, quitar `propertyId`, renombrar funciones a `getPayrollEmployee(s)` |
| `src/services/payroll.ts` | `src/services/payroll.ts` | **fórmulas igual**, capa DB → Supabase async, quitar `propertyId`, quitar `finance_transaction_id` |
| `src/app/household/payroll/actions.ts` | `src/app/(app)/planilla/actions.ts` | portar, `requireAdmin()` al inicio de cada action, `revalidatePath("/planilla")` |
| `src/app/household/payroll/*.tsx` (12 vistas) | `src/app/(app)/planilla/*.tsx` | portar, i18n ES/EN, tokens Ebony |
| `src/types/home.ts` (bloque payroll) | `src/types/planilla.ts` | copiar tipos: `Employee`→`PayrollEmployee`, `PayrollEntry`, `PayrollLedgerEntry`, `PayrollLoan*`, `PayrollPeriodTotal`, `EmployeeAnnualSummary`→`PayrollEmployeeAnnualSummary`, enums. Quitar `propertyId`, `financeTransactionId`. |
| `src/lib/db/schema.ts` (bloque payroll) | `supabase/migrations/20260906180000_fase2_planilla.sql` | **ya hecho** — ver ese archivo |

---

## 4. Decisiones aplicadas

1. **Tabla `payroll_employees`** (renombrada desde `employees` a pedido
   tuyo). Semántica = "trabajador asalariado de planilla". Contratistas
   futuros irán en `contractors` / `contractor_*`. Las otras 3 tablas
   (`payroll_entries`, `payroll_ledger_entries`, `payroll_loans`) quedaron
   igual; la columna FK sigue llamándose `employee_id`.
2. **`integer` para centavos**, calcando a Atlas. Techo por columna:
   ~$21.4M — un renglón es una quincena de una persona, imposible acercarse.
   Si algún día hiciera falta, `alter type bigint` no cambia ninguna fórmula.
3. **`property_id` fuera.** Ebony es una sola empresa; si algún día hay
   sucursales, se agrega una tabla y una columna, no se rehace.
4. **`finance_transaction_id` fuera** hasta que exista el módulo de Gastos.
