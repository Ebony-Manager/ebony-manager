# FOUNDATION.md

Borrador vivo de las decisiones de fundación de esta reconstrucción —
Ebony sobre Next.js App Router + TypeScript + Tailwind v4 + Supabase. Es
la base de la que más adelante se va a sacar un skill de "fundación" para
arrancar otras apps con los mismos parámetros. Cada sección separa qué es
**reutilizable tal cual** en cualquier app nueva de qué es **específico de
Ebony** — esa es la línea que el futuro skill va a necesitar trazar.

Última actualización: Fase 1 — Supabase Auth con Google (server-side),
`proxy.ts` de sesión, DAL, y esquema + RLS versionado en
`supabase/migrations/`. Ver secciones 4 y 5. Cotización sigue sin
reconstruir.

---

## 1. Stack (reutilizable)

- **Framework:** Next.js 16, App Router. Sin Pages Router, sin `getStaticProps`/`getServerSideProps` de la generación anterior.
- **React:** 19.
- **Lenguaje:** TypeScript estricto (`strict: true`), sin `allowJs`.
- **Tailwind:** v4, CSS-first. Sin `tailwind.config.js` — los tokens viven en `src/app/globals.css` dentro de `@theme inline`. `postcss.config.mjs` solo trae `@tailwindcss/postcss` (sin `autoprefixer`; v4 lo resuelve internamente).
- **Alias de import:** `@/*` → `./src/*` (en `tsconfig.json`).
- **Helper de clases:** `cn()` en `src/lib/utils.ts` (`clsx` + `tailwind-merge`) — se usa desde el primer componente, no solo cuando lleguen las piezas de shadcn.
- **Datos:** Supabase (`@supabase/supabase-js` + `@supabase/ssr`), no SQLite local ni Google Sheets. Cliente de browser y cliente de servidor separados (ver sección 4).
- **Íconos:** `lucide-react`.

Por qué este stack y no otro: ver el análisis comparativo de las 4 apps (Atlas/Hensons/Oasis/Ebony) hecho antes de esta reconstrucción — Next App Router + TS + Tailwind v4 + shadcn/Radix es el más robusto, el más completo en piezas de interfaz, y el más documentado/reproducible con fidelidad. Ebony parte de ese mismo stack aunque su piel (sección 3) sea propia.

## 2. Estructura de carpetas (reutilizable, salvo lo marcado)

```
src/
  app/
    layout.tsx                # raíz: fuente (next/font/google), <html>, Providers
    globals.css                # tokens Tailwind v4 — ver sección 3
    page.tsx                   # redirect a la ruta de entrada de la app [ESPECÍFICO: hoy → /cotizacion]
    login/page.tsx             # pantalla de login, fuera del layout con sidebar
    style-check/page.tsx       # DESECHABLE — vitrina de las 21 piezas, sin gate de auth. Borrar cuando ya no haga falta.
    (app)/
      layout.tsx                # gate de auth + Sidebar/Navbar — protege todo lo de adentro
      <modulo>/page.tsx          # una ruta real por módulo de negocio
  components/
    providers.tsx               # envuelve los Context providers + Toaster global
    layout/                     # sidebar.tsx, navbar.tsx — chrome de la app
    shared/                     # piezas chicas reusadas entre módulos (hoy: coming-soon.tsx)
    ui/                         # las 21 piezas de Atlas, copiadas verbatim — ver sección 8
  context/                      # providers de React Context (auth, idioma) — client components
  lib/
    utils.ts                    # cn()
    i18n.ts                     # diccionario bilingüe ES/EN — SOLO lo que la fundación usa (nav/common/auth)
    supabase/
      client.ts                  # createClient() para Client Components
      server.ts                  # createClient() async para Server Components/Route Handlers
  types/                        # tipos compartidos — vacío hasta que haya esquema de Supabase
```

Patrón de ruta protegida: un route group `(app)` con su propio `layout.tsx`
separa "adentro de la app" (con sidebar) de "afuera" (`/login`). El layout
de `(app)` es el único lugar que decide si redirige a `/login`.

**Específico de Ebony:** los cinco módulos concretos (`cotizacion`,
`proyectos`, `cronograma`, `gastos`, `dashboard`) y sus rutas. La forma —
un layout de grupo protegido + una carpeta por módulo — es la parte
reutilizable; los nombres de módulo no.

## 3. Tokens / tema (mecanismo reutilizable, valores específicos de Ebony)

`src/app/globals.css`, en este orden:

1. **Fundación** — `@import "tailwindcss"`, `@custom-variant dark`
   (modo oscuro por clase `.dark` en `<html>`) y `@layer base`
   (borde/focus-ring globales, `letter-spacing` del tema). Se copia tal
   cual a cualquier app nueva.
2. **Tema** — exportado de [tweakcn](https://tweakcn.com) en oklch: `:root`
   (claro) y `.dark` (oscuro) con los nombres estándar de shadcn
   (`--background`, `--primary`, `--card`, `--sidebar-*`, `--chart-*`…),
   `--radius`, la escala de sombras y `--tracking-normal`. **Cambiar de
   piel = reemplazar los valores de estos dos bloques** con los de otro
   tema de tweakcn (mismos nombres). Agregados de Ebony que el tema no trae:
   `--success`/`--warning` y `--row-hover`/`--row-focus`.
3. **Nombres de marca heredados → tema** — `--ink-900`, `--walnut`,
   `--cream-100`, `--stone-*`, `--ebony-*` siguen existiendo porque muchas
   pantallas usan esas clases, pero ahora apuntan al tema (tinta = texto,
   madera = principal, crema = fondo, piedras = grises). Así siguen al
   tema y al modo oscuro sin reescribir cada pantalla. Código nuevo: usar
   los nombres del tema directamente.
4. **Planilla / Contratistas** — colores por categoría (fijos, semánticos)
   y grises/velos de tabla derivados del tema (`color-mix` con
   `--foreground` sobre `--card`, válidos en claro y oscuro).
5. **`@theme inline`** — re-expone todo lo anterior como utilidades de
   Tailwind (`bg-primary`, `rounded-lg`, `shadow-md`, `font-sans`…).

Regla: **ninguna pieza de interfaz nombra un color/radio/sombra
literal** — todo se resuelve a través de estos tokens. Las piezas de `ui/`
usan los radios estándar de shadcn (`rounded-md` botones/campos,
`rounded-xl` tarjetas, `rounded-lg` diálogos, `rounded-sm` opciones de
menú), así el redondeo sale de `--radius`.

**Modo oscuro:** `src/lib/theme.ts` (script en línea que `layout.tsx` pone
en `<head>` para aplicar `.dark` antes del primer pintado, sin parpadeo) +
`src/context/theme-context.tsx` (`useTheme()`: Claro / Oscuro /
Automático, guardado por navegador en `localStorage`). El selector vive en
el menú de perfil (`user-menu.tsx`).

**Fuentes:** las del tema — Inter (interfaz), Merriweather (`font-serif`)
y JetBrains Mono (`font-mono`) — vía `next/font/google` en `layout.tsx`;
`@theme inline` lee sus variables (`--font-inter`, etc.).

## 4. Supabase (mecanismo reutilizable — conectado en Fase 1)

Dos clientes, patrón estándar de `@supabase/ssr` para App Router, ambos
tipados con `Database` de `src/types/database.ts`:
- `src/lib/supabase/client.ts` — `createBrowserClient()`, para Client Components.
- `src/lib/supabase/server.ts` — `createServerClient()` async con manejo de cookies, para Server Components/Route Handlers/Server Actions.
- `src/lib/supabase/proxy.ts` — `updateSession()`, refresca las cookies de sesión en cada request; lo llama `src/proxy.ts`.

Ambos leen `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
Proyecto real conectado en Fase 1 (ref `jdfkfbopecqvvyxherku`). La
`service_role` **no se usa nunca** desde la app: todo lo privilegiado pasa
por RLS + funciones `SECURITY DEFINER` en el esquema `private`.

Tipos: se generan con `supabase gen types typescript --project-id <ref>`
(o el MCP de Supabase) hacia `src/types/database.ts` — regenerar tras cada
migración.

**Reutilizable vs. Ebony:** los tres archivos de `src/lib/supabase/` y
`src/proxy.ts` son reutilizables tal cual. El `project ref`, la URL y el
esquema (`src/types/database.ts`, `supabase/migrations/`) son de Ebony.

**Next 16:** el convenio `middleware.ts` se renombró a `proxy.ts` (mismo
mecanismo, runtime Node.js). Con `app` en `src/`, el archivo va en
`src/proxy.ts`, no en la raíz del repo.

## 5. Auth (Supabase Auth con Google — server-side)

Decisión de Fase 1: se reemplazó el token client-side de Google Identity
Services por **Supabase Auth con Google como proveedor**, sesión en
cookies, verificada en el servidor. Login solo con Google en Fase 1
(email/contraseña más adelante).

Piezas:
- `src/proxy.ts` → `updateSession()`: refresca la sesión en cada request y
  hace un redirect **optimista** a `/login` si no hay usuario. No es la
  única defensa.
- `src/lib/auth/dal.ts`: Data Access Layer con `React.cache` —
  `getUser()`/`requireUser()`/`getProfile()`/`requireAdmin()`. Usa
  `getUser()` (verifica el token contra el servidor de Auth), no
  `getSession()`.
- `src/app/(app)/layout.tsx`: Server Component que llama `requireProfile()`
  — este es el gate autoritativo.
- `src/app/auth/callback/route.ts`: intercambia el `code` de OAuth por
  sesión. Falla → `/auth/auth-code-error`.
- `src/context/auth-context.tsx`: reescrito sobre Supabase. Se siembra
  desde el servidor (el root layout pasa `initialUser`/`initialRole`) y se
  mantiene con `onAuthStateChange` (sign-out en otra pestaña, refresh de
  token). El sign-in es un round trip completo por `/auth/callback`, no
  depende del listener.

Roles y acceso (ver `supabase/migrations/20260906170000_fase1_auth_rls.sql`):
- `public.profiles` — una fila por usuario, `role` ∈ {`admin`, `vendedor`}.
- `public.allowed_emails` — allow-list. El trigger `on_auth_user_created`
  rechaza en el signup a cualquier cuenta de Google que no esté en la
  lista (se hace rollback del insert en `auth.users`, no queda usuario
  huérfano).
- RLS en ambas tablas; `anon` sin acceso. `vendedor` ve solo su propio
  perfil; `admin` ve/edita todo y es el único que toca `allowed_emails` o
  cambia el rol de otro perfil. Un trigger impide que un no-admin se
  auto-escale el rol.
- Las funciones helper/trigger viven en el esquema `private` (no expuesto
  por PostgREST). `get_advisors` (security) queda limpio.

### Organización del menú

- **Rail:** módulos de trabajo (Cotización, Proyectos, Cronograma, Gastos,
  Dashboard ejecutivo) y el ícono **Personal**; al pie, **Settings** y el
  menú de perfil.
- **Personal** (`/personal`): Resumen (lo pagado por mes, Planilla +
  Contratistas), **Staff** (`/personal/staff`: empleados y contratistas
  en una sola lista, solo lectura, cada fila abre su ficha), Planilla y
  Contratistas. "Dashboard" queda reservado para el ejecutivo de la empresa.
- **Settings** (`/settings`): Usuarios.
- Paneles e ítems definidos en `src/components/layout/nav-items.ts`
  (`modules` = todos, `anyModules` = alguno, `adminOnly`).

### Usuarios y permisos por módulo

Ver `supabase/migrations/20261020120000_usuarios_permisos.sql` y la
pantalla **Settings → Usuarios** (`src/app/(app)/settings/usuarios/`, solo admin).

- `allowed_emails` es la lista de usuarios: `role` (`admin` = todo;
  `vendedor` = "Usuario", solo lo marcado) + `modules`. Un trigger copia
  ambos a `profiles`, que es lo que leen la RLS y el servidor; quitar un
  correo borra el perfil y sin perfil no se entra.
- La lista de módulos vive en un solo lugar: `src/lib/auth/modules.ts`
  (`APP_MODULES`, sub-permisos `asistencia` ⊂ `planilla` y `costos` ⊂
  `cotizacion`, `hasModule`, `homePathFor`). En el servidor:
  `requireModule(...)` en cada página/action (`src/lib/auth/dal.ts`); en
  Postgres: `private.has_module(m)` en cada policy; en el cliente:
  `useAuth().can(m)` y `canSeeNavItem` solo para mostrar/ocultar.
- **Invitación por correo sin service_role:** `sendInvitation`
  (`src/services/app-users.ts`) llama `signInWithOtp` con la clave pública
  desde un cliente aparte en flujo implícito; Supabase manda el enlace y,
  si la persona no tiene cuenta, la crea (el trigger de alta la deja pasar
  porque ya está en la lista). El enlace vuelve a `/auth/confirm`, que toma
  la sesión del `#hash` (o de `?token_hash=`) en el navegador. El invitado
  también puede entrar con Google si su correo es de Google.
- Agregar un módulo nuevo: sumarlo a `APP_MODULES` (+ etiqueta en
  `usuarios/module-labels.ts`), al `check` de `allowed_emails.modules` y a
  las policies de sus tablas con `private.has_module('<modulo>')`.

**Nota reutilizable:** el patrón "route group `(app)` + gate en su layout"
se mantuvo; lo que cambió es que el gate ahora es server-side
(`requireProfile()` en un Server Component) en vez de un efecto con
`useAuth()`. La forma de la protección es la misma; el skill de fundación
debe capturar esta versión, no la client-side.

## 6. Qué quedó fuera de este paso (a propósito)

- **Cotización:** el módulo completo (tabla de líneas, export PDF,
  extracción de plano con IA, lectura/escritura de Sheets) se archivó sin
  tocar en `_legacy/` — no se portó a TS ni se conectó a la estructura
  nueva. Se va a reconstruir desde cero sobre esta base, ahora sí con las
  piezas de `ui/` disponibles. `_legacy/` conserva su propio
  `package.json`/`.env.example` para poder correrse de forma
  independiente como referencia si hace falta.
- **Auth real de Supabase:** quedó fuera de Fase 0; se hizo en Fase 1 — ver sección 5.
- **Módulo de negocio alguno:** este paso trajo piezas, no construyó
  pantallas. `/style-check` es la única ruta nueva y es desechable.
- **Modo oscuro:** ver sección 8 — Ebony nunca tuvo paleta oscura, ni en
  la versión Vite ni acá. No es que quedó "fuera" de este paso a
  propósito; es que no existe como decisión todavía.

## 7. Convenciones observadas en esta reconstrucción

- Nombres de archivo/componente: kebab-case para archivos
  (`auth-context.tsx`, `coming-soon.tsx`), PascalCase para el componente
  exportado.
- Un Client Component (`"use client"`) explícito por cada pieza que toca
  Context, `window`, `localStorage`/`sessionStorage`, o un evento —
  todo lo demás (layout raíz, `page.tsx` de redirect) se queda como
  Server Component.
- `.gitignore` de Next estándar (`/.next/`, `next-env.d.ts`,
  `*.tsbuildinfo`) más entradas específicas para no trackear los
  artefactos de `_legacy/` (su propio `node_modules`/`dist`).

## 8. Piezas de interfaz (reutilizable el mecanismo; los 21 archivos son de Atlas, copiados verbatim)

`src/components/ui/` tiene las 21 piezas de Atlas — `avatar`, `badge`,
`button`, `card`, `command`, `dialog`, `dropdown-menu`, `form`, `input`,
`label`, `popover`, `progress`, `scroll-area`, `select`, `separator`,
`sheet`, `skeleton`, `table`, `tabs`, `textarea`, `tooltip` — copiadas
**byte a byte** (`cp`, no reescritas) desde Atlas. Ninguna se editó para
"verse como Ebony": todas ya resuelven color/radio vía clases semánticas
(`bg-primary`, `border-border`, `rounded-md`...), así que el look sale
de `globals.css`, no del componente. La única edición de contenido fue en
`command.tsx`: los defaults de `CommandDialog` decían `"Search Atlas"` /
`"Search across the family's records"` — texto de marca de Atlas filtrado
en un componente compartido, no un token de color pero sí "verse como
Atlas". Se genericizó a `"Search"` / `"Search across records"`.

**Dependencias agregadas:** `@radix-ui/react-{avatar,dialog,dropdown-menu,
label,popover,scroll-area,select,separator,slot,tabs,tooltip}`,
`class-variance-authority`, `cmdk` (para `command.tsx`), `react-hook-form`
(para `form.tsx`) — mismas versiones que Atlas.

### Qué se confirmó del contrato ya preparado

- **`--radius: 0.75rem`** — confirmado visualmente contra las 21 piezas
  reales (botones, card, dialog, inputs, tabs...). El valor inferido de
  `rounded-xl` resultó correcto; no hizo falta ajustarlo. Coincide, de
  hecho, con el propio `--radius` de Atlas (misma geometría, distinto
  color — es la piel la que cambia, no la forma).
- **Los 15 tokens de color ya mapeados** (`--background`, `--card`,
  `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`,
  `--border`, `--input`, `--ring`, `--sidebar*`) resolvieron correctamente
  sin ajuste. Verificado con estilos computados reales en el navegador, no
  solo a ojo: `getComputedStyle` sobre el botón "Default" de `/style-check`
  da `background-color: #c9a84c` (= `--ebony-gold` exacto), `body`
  `font-family: Inter`, `background-color: #faf7f2` (= `--ebony-warm`).

### Qué faltaba y se agregó al contrato (no a las piezas)

Auditando las 21 piezas por sus clases (`grep` de `bg-/text-/border-/
shadow-/rounded-` contra lo que ya estaba mapeado) aparecieron tres huecos
reales:

1. **`--success` / `--warning`** (+ `-foreground`) — `badge.tsx` trae
   variantes `success`/`warning` que Atlas sí tiene token para y Ebony no
   tenía. Agregados en la sección EBONY como `--ebony-success: #4f7942`
   (verde bosque, templado, no un verde saturado de Tailwind) y
   `--ebony-warning: #b0651d` (naranja quemado, deliberadamente distinto
   del dorado de marca para que "warning" nunca se confunda con
   "énfasis"). **Son mi propuesta, no una decisión de marca ya tomada** —
   son los dos únicos colores nuevos de esta reconstrucción; ajustar si
   no calzan.
2. **Escala `--shadow-2xs…2xl`** — `button`, `card`, `input`, `dialog`,
   `popover`, `dropdown-menu`, `select`, `tabs`, `tooltip` usan
   `shadow-sm/xs/md/lg`. Tailwind v4 ya las resuelve por defecto (mismo
   mecanismo que `--radius-*`), pero sin declararlas en `globals.css`
   quedaban resolviendo contra el valor de fábrica de Tailwind, no contra
   algo que Ebony sea dueña de reasignar. Declaradas ahora con los mismos
   valores que trae Tailwind por defecto (neutras, sin teñir de marca) —
   la versión Vite tampoco tenía un color de sombra propio, así que no se
   inventó ninguno; solo se nombró lo que ya se veía.
3. **`--animate-fade-in` / `--animate-slide-in`** + sus `@keyframes` —
   `dialog`/`sheet`/`popover`/`dropdown-menu` las usan para la transición
   de apertura. No dependen de color; se copiaron tal cual del `@theme
   inline` de Atlas.

**Deliberadamente sin tokenizar** (no son huecos, son universales): el
scrim `bg-black/30` detrás de dialog/sheet (convención estándar de
overlay, no forma parte de la identidad de ninguna de las dos apps) y
`rounded-full` (forma de píldora/círculo — avatar, badges — no una
decisión de radio temable).

### Modo oscuro

Resuelto con el tema de tweakcn (bloque `.dark` de `globals.css`) y el
selector Claro / Oscuro / Automático del menú de perfil — ver §3.
