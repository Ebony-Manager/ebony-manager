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
