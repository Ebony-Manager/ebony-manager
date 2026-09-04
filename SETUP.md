# Ebony Manager — Guía de Configuración

Fundación actual: Next.js 16 (App Router) + React 19 + TypeScript +
Tailwind v4 + Supabase. Ver [FOUNDATION.md](./FOUNDATION.md) para el porqué
de estas decisiones. La guía de la versión anterior (Vite + Google Sheets)
quedó en [`_legacy/SETUP.md`](./_legacy/SETUP.md) como referencia.

---

### 1. Desarrollo local

```bash
npm install
npm run dev
# App en http://localhost:3000
```

O doble clic en `Abrir Ebony Manager.command`.

---

### 2. Configurar Google OAuth (login)

El login sigue siendo Google Identity Services del lado del cliente — sin
sesión de servidor todavía (ver FOUNDATION.md §5).

1. Ve a [Google Cloud Console](https://console.cloud.google.com/).
2. Usa el proyecto existente de Ebony (o crea uno).
3. En **APIs & Services → Credentials**, el OAuth client ID ya configurado
   sigue sirviendo — solo confirma que **Authorized JavaScript origins**
   incluye `http://localhost:3000` y la URL de producción.
4. Copia el **Client ID**.

---

### 3. Configurar Supabase (base de datos)

No hay proyecto conectado todavía — esto es lo que falta para que
`src/lib/supabase/` deje de estar vacío de credenciales:

1. Crea un proyecto en [supabase.com](https://supabase.com) (o usa uno
   existente).
2. En **Project Settings → API**, copia la **Project URL** y la
   **anon public key**.
3. El esquema de tablas todavía no existe — la sección "Google Sheets
   Structure" de `CLAUDE.md` es la referencia de negocio (columnas,
   catálogo de precios) para diseñarlo cuando se reconstruya cada módulo.

---

### 4. Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto (o configúralas en
Vercel) — ver `.env.example`:

```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=tu_client_id.apps.googleusercontent.com
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

En Vercel: Project Settings → Environment Variables. Los nombres cambiaron
de prefijo (`VITE_*` → `NEXT_PUBLIC_*`) al migrar de Vite a Next — hay que
agregarlos con el nombre nuevo, no reusar los viejos.

---

### 5. Deploy en Vercel

```bash
vercel --prod
```

O conecta el repositorio en [vercel.com](https://vercel.com) para deploys
automáticos en cada push. Next no necesita el `vercel.json` de rewrites
que tenía la versión Vite (SPA) — se eliminó.

---

## Estructura del proyecto

```
ebony-manager/
├── src/
│   ├── app/
│   │   ├── layout.tsx, globals.css, page.tsx
│   │   ├── login/page.tsx
│   │   └── (app)/                 # rutas protegidas
│   │       ├── layout.tsx          # gate de auth + Sidebar/Navbar
│   │       └── {cotizacion,proyectos,cronograma,gastos,dashboard}/page.tsx
│   ├── components/
│   │   ├── providers.tsx
│   │   ├── layout/                 # sidebar.tsx, navbar.tsx
│   │   └── shared/                 # coming-soon.tsx
│   ├── context/                    # auth-context.tsx, language-context.tsx
│   └── lib/
│       ├── utils.ts, i18n.ts
│       └── supabase/               # client.ts, server.ts
├── _legacy/                        # versión Vite anterior, archivada como referencia
├── FOUNDATION.md
├── .env.example
├── package.json
└── tsconfig.json
```

---

## Notas

- Cotización (y el resto de los módulos) son placeholders hoy — se
  reconstruyen desde cero sobre esta base, no se portó el código de
  `_legacy/`.
- Sin `NEXT_PUBLIC_GOOGLE_CLIENT_ID` configurado, el botón de login no
  puede iniciar el flujo de Google (falla con un aviso, no rompe la app).
- Sin credenciales de Supabase, nada se rompe todavía porque ningún
  componente llama al cliente — es seguro dejarlas vacías mientras se
  arranca un módulo nuevo.
