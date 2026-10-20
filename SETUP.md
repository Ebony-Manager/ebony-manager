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
   - **Authorized redirect URIs**: `https://jdfkfbopecqvvyxherku.supabase.co/auth/v1/callback`.
2. Copia el **Client ID** y el **Client Secret**.
3. En el dashboard de Supabase → **Auth → Providers → Google**: habilítalo
   y pega Client ID + Secret. (El secret vive en Supabase, no en el repo.)
4. En **Auth → URL Configuration**:
   - Site URL: `https://admin.ebonypanama.com`
   - Redirect URLs: `https://admin.ebonypanama.com/**`, `https://ebony-manager.vercel.app/**`, `http://localhost:4001/**`

---

### 3. Configurar Supabase (base de datos)

Proyecto conectado: **Ebony**, ref `jdfkfbopecqvvyxherku`.

1. **Project Settings → API**: la **Project URL** y la **anon public key**
   son las que van en las variables de entorno (paso 4). La `service_role`
   **no se usa** — no la pongas en ningún lado.
2. Esquema: está versionado en `supabase/migrations/`. Se aplica al
   proyecto remoto vía el MCP de Supabase o pegándolo en el SQL editor
   (no hay CLI local enlazada — ver `supabase/README.md`).
3. Acceso: `public.allowed_emails` es la lista de usuarios. Ya está
   sembrado un admin (`teofilohafeitz@gmail.com`); agrega al resto del
   equipo desde **Administración → Usuarios** (ver 3b).

---

### 3b. Usuarios e invitaciones por correo

Los usuarios se agregan desde **Administración → Usuarios** (solo admin):
correo, rol y módulos. Al guardar, Supabase Auth le manda a esa persona un
enlace de acceso que la lleva a `/auth/confirm` y la deja dentro. No usa la
`service_role`. Para que los correos lleguen hace falta, en el dashboard de
Supabase:

1. **Auth → SMTP Settings → Enable custom SMTP**. Sin esto, el servicio de
   correo incluido en Supabase solo entrega a los miembros del equipo del
   proyecto y con un límite muy bajo por hora — las invitaciones a cualquier
   otra persona no llegan. Opción recomendada, **Resend** (gratis hasta
   3.000 correos/mes):
   1. Crear cuenta en resend.com → **Domains → Add domain** →
      `ebonypanama.com`. Resend muestra 3–4 registros DNS (DKIM en
      `resend._domainkey`, y MX + SPF en `send`): agregarlos donde se
      administra el DNS de `ebonypanama.com`. No tocan el correo actual
      (`ventas@…` sigue igual: no cambian el MX principal).
   2. Cuando Resend marque el dominio como *Verified*: **API Keys → Create**
      (permiso "Sending access").
   3. En Supabase → SMTP Settings: Sender email `no-reply@ebonypanama.com`,
      Sender name `Ebony Manager`, Host `smtp.resend.com`, Port `465`,
      Username `resend`, Password = la API key. Guardar.
   4. **Auth → Rate Limits → Emails sent**: subirlo (ej. 30 por hora); con
      SMTP propio ya no está atado al límite del correo de Supabase.

   Alternativa si `ebonypanama.com` usa Google Workspace: Host
   `smtp.gmail.com`, Port `465`, Username = un buzón del dominio, Password =
   una *contraseña de aplicación* de ese buzón (requiere verificación en 2
   pasos).
2. **Auth → Providers → Email**: habilitado (viene así por defecto).
3. **Auth → URL Configuration → Redirect URLs**: que incluya el dominio de
   la app (`https://admin.ebonypanama.com/**`, ver §6) y la URL local que
   se use (`http://localhost:4001/**` con `npm run dev`).
4. (Opcional) **Auth → Email Templates**: traducir al español "Confirm
   signup" (la recibe quien todavía no tiene cuenta) y "Magic Link" (la
   recibe quien ya tenía). Ej. asunto *"Te invitaron a Ebony Manager"* y
   cuerpo con `<a href="{{ .ConfirmationURL }}">Entrar a Ebony Manager</a>`.

Si el correo falla, el usuario igual queda agregado: puede entrar con Google
(si su correo es de Google) o se le reenvía la invitación desde su menú en
la lista.

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
automáticos en cada push.

---

### 6. Dominio propio: `admin.ebonypanama.com`

El código no tiene el dominio escrito en ningún lado (los enlaces de
invitación usan la dirección desde la que se invita), así que solo es
configuración:

1. **Vercel** → proyecto `ebony-manager` → **Settings → Domains → Add** →
   `admin.ebonypanama.com` (Production).
2. **DNS de `ebonypanama.com`** (donde esté administrado): registro
   **CNAME**, nombre `admin`, valor = el que muestra Vercel en ese paso
   (algo como `cname.vercel-dns.com` o `xxxx.vercel-dns-0xx.com`). Vercel
   emite el certificado HTTPS solo al ver el registro.
3. **Supabase → Auth → URL Configuration**: Site URL
   `https://admin.ebonypanama.com`; en Redirect URLs agregar
   `https://admin.ebonypanama.com/**` (dejar la de `vercel.app` mientras
   se hace el cambio).

En Google Cloud Console no hay que cambiar nada: el login con Google va
app → Supabase → Google → Supabase → app, y Google solo valida el redirect
URI de Supabase (`…supabase.co/auth/v1/callback`), que no depende del
dominio de la app. Next no necesita el `vercel.json` de rewrites
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
