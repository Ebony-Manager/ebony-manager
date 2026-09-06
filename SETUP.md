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

El login es **Supabase Auth con Google** (sesión en cookies, verificada en
el servidor — ver FOUNDATION.md §5).

1. En [Google Cloud Console](https://console.cloud.google.com/) → **APIs &
   Services → Credentials**, en el OAuth client de Ebony:
   - **Authorized JavaScript origins**: `http://localhost:3001` y
     `https://ebony-manager.vercel.app`.
   - **Authorized redirect URIs**: `https://jdfkfbopecqvvyxherku.supabase.co/auth/v1/callback`.
2. Copia el **Client ID** y el **Client Secret**.
3. En el dashboard de Supabase → **Auth → Providers → Google**: habilítalo
   y pega Client ID + Secret. (El secret vive en Supabase, no en el repo.)
4. En **Auth → URL Configuration**:
   - Site URL: `https://ebony-manager.vercel.app`
   - Redirect URLs: `https://ebony-manager.vercel.app/**`, `http://localhost:3001/**`

---

### 3. Configurar Supabase (base de datos)

Proyecto conectado: **Ebony**, ref `jdfkfbopecqvvyxherku`.

1. **Project Settings → API**: la **Project URL** y la **anon public key**
   son las que van en las variables de entorno (paso 4). La `service_role`
   **no se usa** — no la pongas en ningún lado.
2. Esquema: está versionado en `supabase/migrations/`. Se aplica al
   proyecto remoto vía el MCP de Supabase o pegándolo en el SQL editor
   (no hay CLI local enlazada — ver `supabase/README.md`).
3. Acceso: `public.allowed_emails` es la allow-list de correos. Ya está
   sembrado un admin (`teofilohafeitz@gmail.com`); agrega al resto del
   equipo insertando ahí una vez dentro de la app.

---

### 4. Variables de entorno

Crea `.env.local` en la raíz (o configúralas en Vercel) — ver
`.env.example`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://jdfkfbopecqvvyxherku.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
```

En Vercel: Project Settings → Environment Variables, en Production, Preview
y Development. Ambas son públicas (la anon key solo puede lo que RLS
permite). Ya no hace falta ninguna variable de Google en el cliente: el
login se configura entero en el dashboard de Supabase.

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
