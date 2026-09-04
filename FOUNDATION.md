# FOUNDATION.md

Borrador vivo de las decisiones de fundación de esta reconstrucción —
Ebony sobre Next.js App Router + TypeScript + Tailwind v4 + Supabase. Es
la base de la que más adelante se va a sacar un skill de "fundación" para
arrancar otras apps con los mismos parámetros. Cada sección separa qué es
**reutilizable tal cual** en cualquier app nueva de qué es **específico de
Ebony** — esa es la línea que el futuro skill va a necesitar trazar.

Última actualización: reconstrucción de base (Vite → Next), antes de traer
piezas de interfaz compartidas o reconstruir Cotización.

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
    (app)/
      layout.tsx                # gate de auth + Sidebar/Navbar — protege todo lo de adentro
      <modulo>/page.tsx          # una ruta real por módulo de negocio
  components/
    providers.tsx               # envuelve los Context providers + Toaster global
    layout/                     # sidebar.tsx, navbar.tsx — chrome de la app
    shared/                     # piezas chicas reusadas entre módulos (hoy: coming-soon.tsx)
    ui/                         # NO EXISTE TODAVÍA — acá van las piezas compartidas (shadcn/Atlas) cuando se traigan
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
   (`--background`, `--primary`, `--card`, `--border`...) mapeados a los 7
   hex de Ebony. Ninguna pieza de interfaz existe todavía que los use —
   se dejaron listos anticipadamente para cuando se traigan las piezas de
   Atlas, así ese paso futuro no necesita volver a tocar `globals.css`.
   Ver la nota sobre `--radius` en el propio archivo: es un valor inferido
   de lo que ya existía (`rounded-xl`), no confirmado contra una pieza
   real todavía.

Regla que se mantiene desde el plan de piezas compartidas (conversación
previa): **ninguna pieza de interfaz nombra un color/radio/sombra
literal** — todo se resuelve a través de estos tokens. Las clases
`.btn-primary`/`.card`/`.input`/etc. heredadas de la versión Vite ya
siguen esa regla (usan `bg-ebony-gold`, no `#C9A84C`), así que se copiaron
sin tocar.

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

- **Piezas de interfaz compartidas (shadcn/Atlas):** no se trajeron. El
  contrato de tokens (sección 3) está listo para recibirlas, pero
  `components/ui/` no existe todavía.
- **Cotización:** el módulo completo (tabla de líneas, export PDF,
  extracción de plano con IA, lectura/escritura de Sheets) se archivó sin
  tocar en `_legacy/` — no se portó a TS ni se conectó a la estructura
  nueva. Se va a reconstruir desde cero sobre esta base. `_legacy/`
  conserva su propio `package.json`/`.env.example` para poder correrse de
  forma independiente como referencia si hace falta.
- **Auth real de Supabase:** ver sección 5.

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
