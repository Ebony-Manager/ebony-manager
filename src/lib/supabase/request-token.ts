import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Token de acceso de una petición que no viene del navegador (el MCP: la IA
 * entra con un token OAuth de Supabase, sin cookies). Mientras corre
 * `withAccessToken`, `createClient()` de `./server` usa ese token en vez de
 * las cookies, así los servicios de siempre funcionan igual y la RLS aplica
 * con el usuario del token.
 */
const store = new AsyncLocalStorage<string>();

export function withAccessToken<T>(token: string, fn: () => Promise<T>): Promise<T> {
  return store.run(token, fn);
}

export function currentAccessToken(): string | undefined {
  return store.getStore();
}
