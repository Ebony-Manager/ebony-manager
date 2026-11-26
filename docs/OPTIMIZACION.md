# Optimización de Ebony Manager — historial y reglas

> Lo lee y lo actualiza la sesión dedicada «Optimización» (revisión programada lunes y jueves 17:37, hora de Panamá).
> Cada revisión agrega su resultado al final de «Historial». Creado el 17 nov 2026.

## Alcance
Todo lo que haga la app más barata, más rápida o más estable:
- **Supabase** (proyecto `jdfkfbopecqvvyxherku`): consultas por ruta y por usuario/minuto (bucles, precargas, fichas armadas
  dos veces), fotos de Storage por bucket y `cf_cache_status`, `/auth/v1/user` vs `jwks`, `rpc/save_quote`, movimientos de
  contratistas y planilla, errores en postgres/auth, fallos de push («Push falló»), asesores de seguridad y rendimiento.
- **Vercel** (equipo `ebony-manager`, proyecto `ebony-manager`): errores en producción, funciones lentas o que fallan,
  invocaciones, uso de ancho de banda y de minutos de compilación, despliegues fallidos.
- **Velocidad**: páginas lentas, consultas en serie que podrían ir en paralelo, datos que se piden de más, tamaño de lo que
  se manda al navegador, imágenes sin miniatura.
- **Google Drive / Jotform / Alegra**: llamadas de más o que fallan.

## Reglas
- Responder y reportar **en español**, en palabras simples (Carlos no es programador). Dar una estimación del efecto.
- **Al terminar cada revisión, mandar notificación al teléfono** (`PushNotification`, una línea < 200 caracteres con lo
  principal: tráfico vs. la vez anterior y si hay algo que Carlos deba aprobar). Lo pidió Carlos el 17 nov 2026.
- **Cambios de datos o del cotizador: avisar antes** y esperar el sí. Mejoras de código claras y seguras (bucles, precargas,
  consultas duplicadas): se pueden proponer o hacer; si hay duda, proponer.
- Antes de subir: `npx tsc --noEmit`, `npx eslint`, `npx vitest run` y `npx next build`. Seguir `CLAUDE.md` y `UI-RULES.md`.
- Commits con la línea de coautoría que indique la sesión. Se sube a `main` y se despliega a producción con Vercel
  (`create_deployment`, `gitSource` github `Ebony-Manager/ebony-manager`, `ref: main`, con el `sha` exacto). La compilación tarda ~5 min.
- Logs de Supabase: `query_logs` en ventanas de ≤ 24 h (la ruta está en `log_attributes['request.path']`; no hay usuario,
  usar `request.headers.cf_connecting_ip` — las IP de Vercel/AWS son el servidor de la app).

## Referencias y arreglos hechos
- **6 nov 2026:** ~31,000 consultas en un día laboral · 0 `/auth/v1/user` · ~690 fotos · 1,282 `save_quote`.
- **Commit `eda0b6f`:** se quitó la precarga de listas.
- **Commit `24bd09e` (16 nov):** la ficha de proyecto se armaba **dos veces** tras cada cambio (la acción ya revalidaba y la
  pantalla hacía además `router.refresh()`): se quitó el refresco extra en diseñadoras, actas, edición de proyecto y contratos;
  la carpeta de Drive sale del mismo proyecto (una consulta menos por ficha). Estimado: −10 % en días de mucho uso de Proyectos.
  **Verificar en la próxima revisión** que bajó.
- **Patrón a buscar en otras fichas:** acción con `revalidatePath` + `router.refresh()` en la pantalla = doble armado.

## Historial

### 16 nov 2026 (revisión del lunes; cubre vie 13 → lun 16 22:38 UTC)
| Día | Consultas |
|---|---|
| Vie 13 | 13,561 (día laboral; −55 % vs 6 nov) |
| Sáb 14 | 3,402 |
| Dom 15 | 1,873 |
| Lun 16 (hasta 22:38 UTC) | 5,693 |
- `/auth/v1/user`: 2 · 0 · 0 · 0. `jwks`: 130–600/día (normal).
- Fotos: 792 (vie) y 711 (lun); sobre todo `inventory-photos` (~460–490); caché 71 % HIT (502/711 el lunes).
- `save_quote`: 487 (vie), 245 (dom), 1,021 (lun) — ráfagas de 10–20/min al editar (autoguardado), sin bucles.
- `contractor_ledger_entries` 787 y `payroll_entries` 492 el viernes; < 120 el fin de semana.
- Sin errores en postgres el lunes; sin 4xx/5xx en edge.
- Pico: vie 13 22:40 UTC, 357 consultas/min = fichas de proyecto armadas dos veces (arreglado en `24bd09e`).

### 23 nov 2026 (revisión del lunes; cubre lun 16 22:38 → lun 23 22:37 UTC — la del jueves 19 no corrió: se reinició la sesión)
| Día (UTC) | Consultas | Fotos | `save_quote` | `contractor_ledger` / `payroll` |
|---|---|---|---|---|
| Mar 17 | 13,681 | 4,194 | 158 | 125 / 122 |
| Mié 18 | 10,566 | 1,284 | 1,178 | 232 / 75 |
| Jue 19 | 5,781 | 504 | 449 | 290 / 67 |
| Vie 20 | 6,367 | 1,017 | 596 | 237 / 20 |
| Sáb 21 | 1,752 | 290 | 0 | 10 / 8 |
| Dom 22 | 403 | 59 | 20 | 0 / 0 |
| Lun 23 | 8,693 | 543 | 108 | 93 / 29 |
- **Arreglo `24bd09e` confirmado:** consultas a `projects` en un día laboral 639 (vie 13) → 198 (vie 20) y 396 (lun 23), ≈ −40 %.
  Las tablas hijas (`project_*`) no bajaron (860 → 991 el lunes; más uso de las fichas). Sin picos de doble armado.
- **Mar 17:** 4,529 de las 13,681 consultas (y casi todo el salto de fotos, `inventory-photos`, 17:30–18:35 UTC) vinieron de
  servidores `node` en Google Cloud (35.184.*, 136.113.*, 34.1xx.*) que **no son Vercel** (Vercel sale por AWS 44.*/3.*):
  probablemente las sesiones de trabajo del barrido de diseño abriendo la app con datos reales. El lunes 23 fueron solo 619.
  No es tráfico de usuarios; la caché sirvió ~93 % de esas fotos.
- Pico sin fotos: mié 18 04:54 UTC, 253/min (de noche: contratos, proyectos, entregas, pintores) — también sesión de trabajo.
- `/auth/v1/user`: 0 todos los días. `jwks`: ~430–460 en días laborales (normal). Sin 5xx en edge; sin errores en postgres el lunes.
- Asesores de seguridad: sin novedades (las funciones con token para formularios/cron por diseño; protección de contraseñas filtradas apagada — solo aplica si se activa login con contraseña).
- Vercel: sin despliegues fallidos en la semana. Errores: aviso `url.parse()` (de una librería, inofensivo); 1 «Push falló» 410
  (suscripción vencida, se limpia sola); **`record_integration_run drive TOKEN_INVALIDO` 3 veces (10–23 nov) desde
  `/api/jotform/webhook`**: el webhook no logra anotar el estado de Drive en Settings → Conexiones (Drive en sí no se reportó caído). Revisar.

### 26 nov 2026 (revisión del jueves; cubre lun 23 22:37 → jue 26 22:38 UTC)
| Día (UTC) | Consultas | Fotos (HIT) | `save_quote` | `projects` | ledger / payroll | node GCP |
|---|---|---|---|---|---|---|
| Mar 24 | 8,293 | 862 (85 %) | 672 | 254 | 19 / 14 | 227 |
| Mié 25 | 5,804 | 628 (66 %) | 686 | 159 | 37 / 28 | 16 |
| Jue 26 (hasta 22:38) | 7,952 | 864 (82 %) | 379 | 283 | 25 / 21 | 429 |
- Estable y en línea con la semana anterior (5.8–8.3 mil en días laborales; muy lejos de los ~31,000 del 6 nov). `projects` sigue
  bajo (159–283/día vs 639 el 13 nov). `/auth/v1/user` 0; `jwks` 330–565; sin 5xx. Picos: 191/min (mar 24 18:35) y 255/min
  (jue 26 18:27), sin bucles. Sesiones de trabajo desde Google Cloud: poco (16–429/día).
- Vercel: `url.parse()` (aviso de librería, inofensivo); 1 «Push falló» 410 de Apple (suscripción vencida, se limpia sola).
- **`record_integration_run drive TOKEN_INVALIDO` subió a 8 (5 nuevos en 3 días).** Causa encontrada: `src/lib/google/drive.ts:134`
  anota el resultado de Drive con la sesión del usuario (`token null`), pero cuando Drive se usa desde `/api/jotform/webhook`
  no hay usuario → la base rechaza la nota. Drive hace su trabajo; solo no queda anotado en Settings → Conexiones.
  Arreglo propuesto (pendiente del sí de Carlos): pasar el cliente y token del webhook a esa nota, o no anotar cuando no hay sesión.
- Código nuevo que toca Drive: subidas de hasta 200 MB directo del navegador a Drive (`5f53040`) y elegir archivos del Drive del
  proyecto sin copiarlos (`e88c746`) — no pasan por el servidor, así que no suman tráfico a Vercel.
