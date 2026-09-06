# Plan de trabajo — Ecosistema de apps (Ebony y futuras)

Documento ancla. Sirve para retomar en sesiones nuevas sin re-explicar todo.

## Contexto

Objetivo de fondo: poder construir un módulo bien hecho **una vez** y
replicarlo fielmente entre apps. Para eso, las apps comparten una misma
**fundación** (stack Next + TS + Tailwind v4 + shadcn/Radix + Supabase +
GitHub + Vercel) y cada una conserva su **identidad visual propia**. Ebony es
la primera app sobre esta fundación y sirve de referencia.

---

## Fase 0 — Fundación de Ebony ✅ COMPLETADA

Stack reconstruido (Vite → Next), piezas de Atlas traídas y probadas contra
los tokens de Ebony, repo en GitHub (SSH, sin secretos), publicada en Vercel
(`ebony-manager.vercel.app`). Documentado en [`FOUNDATION.md`](./FOUNDATION.md).

---

## Fase 1 — Activar Ebony (Supabase + login + seguridad)

**Objetivo:** Ebony funcional, no solo visual.

Decisión tomada: se migró a **Supabase Auth con Google** (server-side, sesión
en cookies). Login solo con Google en Fase 1; email/contraseña queda para
después. Roles: `admin` y `vendedor`. Acceso por allow-list de correos.

- [x] Proyecto Supabase creado (ref `jdfkfbopecqvvyxherku`)
- [x] Migración de esquema + RLS versionada y aplicada (`supabase/migrations/20260906170000_fase1_auth_rls.sql`)
- [x] Row-Level Security activado en todas las tablas (`profiles`, `allowed_emails`); `anon` sin acceso; `get_advisors` limpio
- [x] Código de login/sesión: `signInWithOAuth` de Google, `/auth/callback`, `proxy.ts` de refresco de sesión, gate server-side en `(app)/layout.tsx`, `signOut` real
- [ ] **(tuyo)** Google habilitado en Supabase (Auth → Providers → Google) con Client ID + Secret, y URLs de redirect (`localhost:3001`, `ebony-manager.vercel.app`)
- [ ] **(tuyo)** `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` en Vercel (Production/Preview/Development) + redeploy
- [ ] Confirmado: se entra a la app publicada

**Nota de seguridad:** RLS obligatorio, auth forzada en servidor, solo clave
pública / anon en el cliente, nunca la service key.

---

## Fase 2 — Planilla en Ebony (PRIORIDAD)

**Objetivo:** módulo de planilla bien hecho, con datos reales en Supabase.

- [ ] Modelo de datos en Supabase (empleados, salarios, quincenas)
- [ ] Módulo construido con las piezas compartidas
- [ ] Fórmulas de Panamá (décimo, vacación, prima de antigüedad)
- [ ] Publicado y funcionando en el link

**Prueba de éxito:** se usa la planilla en internet, con datos reales, de
punta a punta.

---

## Fase 3 — Skill de fundación (con seguridad horneada)

**Objetivo:** molde reutilizable para arrancar apps futuras, seguras de
fábrica. Se hace **después** de la planilla para que el molde capture más y
esté probado.

- [ ] Índice del skill aprobado
- [ ] Skill redactado (separación clara "reutilizable vs. reemplazar por app")
- [ ] Seguridad integrada en cada paso (secretos, HTTPS, RLS, validación de entradas, auth, etc.)
- [ ] Guardado en un lugar fijo del repo

**Base:** destilar `FOUNDATION.md` de bitácora a instrucciones reutilizables.

---

## Fase 4 — Skill de reproducción de planilla (meta original)

**Objetivo:** el skill de "hazme la planilla" que reproduce fiel a otras apps.
Requiere que exista la planilla buena de la Fase 2.

- [ ] Skill en modo reproducción (código real, no prosa)
- [ ] Probado en otra app mía
- [ ] Sale idéntico salvo datos

---

## Fase 5 — Escalar y otros módulos

- [ ] Migrar Atlas y Hensons a GitHub + Vercel
- [ ] Construir demás módulos (incl. cotización nueva) sobre la base compartida
- [ ] Módulos reproducibles entre todas las apps
