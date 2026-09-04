# FOUNDATION.md

Borrador vivo de las decisiones de fundación de esta reconstrucción —
Ebony sobre Next.js App Router + TypeScript + Tailwind v4 + Supabase. Es
la base de la que más adelante se va a sacar un skill de "fundación" para
arrancar otras apps con los mismos parámetros. Cada sección separa qué es
**reutilizable tal cual** en cualquier app nueva de qué es **específico de
Ebony** — esa es la línea que el futuro skill va a necesitar trazar.

Última actualización: se trajeron las 21 piezas de interfaz de Atlas
(`src/components/ui/`) y se probó el contrato de tokens contra ellas — ver
secciones 3 y 8. Cotización sigue sin reconstruir.

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

`src/app/globals.css` tiene tres bloques, deliberadamente separados con
comentarios `FUNDACIÓN` / `EBONY` / `CONTRATO DE PIEZAS COMPARTIDAS`:

1. **Fundación** — `@import "tailwindcss"`, `@layer base` (borde/focus-ring
   globales), nada de color. Se copia tal cual a cualquier app nueva.
2. **Ebony** — los 7 hex de marca (`--ebony-dark/medium/light/warm/gray/
   gold/gold-light`) + `--radius`. Esto es lo único que cambia entre apps:
   una app nueva reemplaza este bloque por su propia paleta, sin tocar
   nada más del archivo.
3. **Contrato de piezas compartidas** — nombres de token estilo shadcn
   (`--background`, `--primary`, `--card`, `--border`...) mapeados a los
   hex de Ebony. **Probado contra las 21 piezas reales de Atlas — ver
   sección 8 para el detalle de qué se confirmó y qué se agregó.**

Regla que se mantiene desde el plan de piezas compartidas (conversación
previa): **ninguna pieza de interfaz nombra un color/radio/sombra
literal** — todo se resuelve a través de estos tokens. Las clases
`.btn-primary`/`.card`/`.input`/etc. heredadas de la versión Vite ya
seguían esa regla (usan `bg-ebony-gold`, no `#C9A84C`); las 21 piezas de
Atlas también la siguen — se copiaron sin editar un solo color/radio, y
donde faltaba un token para que resolvieran contra Ebony (no contra
Atlas), se agregó al contrato en vez de tocar la pieza. Ver sección 8.

**Fuente:** Inter, vía `next/font/google` (self-hosted) en vez del
`<link>` a Google Fonts que usaba la versión Vite — mismo font, mecanismo
de carga distinto. `--font-sans` en `@theme inline` apunta a la variable
que genera `next/font`.

## 4. Supabase (mecanismo reutilizable, sin credenciales todavía)

Dos clientes, patrón estándar de `@supabase/ssr` para App Router:
- `src/lib/supabase/client.ts` — `createBrowserClient()`, para Client Components.
- `src/lib/supabase/server.ts` — `createServerClient()` async con manejo de cookies, para Server Components/Route Handlers/Server Actions.

Ambos leen `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` de
variables de entorno — **sin valores todavía** (decisión explícita: no se
creó proyecto de Supabase en este paso). Nada en la app los invoca hoy.
Cuando haya proyecto real:
1. Completar `.env.local` con las credenciales.
2. El primer consumidor real va a necesitar decidir el modelo de auth —
   hoy Ebony loguea con un token de Google Identity Services scopeado
   solo a Sheets (ver sección 5), no con sesión de Supabase. Pasar a Auth
   real de Supabase (Google como proveedor, como en Coronado) es una
   decisión aparte, todavía no tomada.
3. Generar tipos (`supabase gen types typescript`) hacia `src/types/`.

## 5. Auth (específico de Ebony, con una nota reutilizable)

Se preservó el mecanismo actual: Google Identity Services (token client)
+ el token guardado en `sessionStorage`, sin sesión de servidor. Es
puramente client-side, por eso la protección de rutas también lo es (el
`layout.tsx` de `(app)/` redirige a `/login` en un efecto, no hay
middleware de servidor protegiendo nada). Esto es una limitación conocida,
no un descuido: no hay cookie de sesión que un middleware pueda leer hasta
que exista una capa de auth real (Supabase Auth u otra).

**Nota reutilizable:** el patrón de "route group `(app)` + gate client-side
en su layout" sirve igual el día que la auth pase a ser server-side —
solo cambia CÓMO se decide `!user` (de `useAuth()` a una sesión leída en
el servidor), no la forma de la protección.

## 6. Qué quedó fuera de este paso (a propósito)

- **Cotización:** el módulo completo (tabla de líneas, export PDF,
  extracción de plano con IA, lectura/escritura de Sheets) se archivó sin
  tocar en `_legacy/` — no se portó a TS ni se conectó a la estructura
  nueva. Se va a reconstruir desde cero sobre esta base, ahora sí con las
  piezas de `ui/` disponibles. `_legacy/` conserva su propio
  `package.json`/`.env.example` para poder correrse de forma
  independiente como referencia si hace falta.
- **Auth real de Supabase:** ver sección 5.
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

### Modo oscuro — hallazgo, no ajuste

`/style-check` se verificó en claro y con `prefers-color-scheme: dark`
emulado en el navegador. **Salieron idénticos** — no porque el contrato
esté mal, sino porque Ebony nunca definió una paleta oscura (ni la
versión Vite la tenía; no hay bloque `@media (prefers-color-scheme: dark)`
en `globals.css`). No es un bug de esta reconstrucción, es un hueco de
diseño preexistente que recién se hace visible ahora que hay piezas reales
para probarlo contra los dos temas. **Pendiente de decisión del usuario**,
no de esta sesión — no se inventó una paleta oscura sin que la definiera
la persona dueña de la marca, mismo criterio que se usó con la paleta
clara original.
