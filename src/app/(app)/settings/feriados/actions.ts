"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth/dal";
import { addManualHoliday, deleteManualHoliday, setHolidayStatus, syncHolidaysAsAdmin } from "@/services/holidays";
import type { HolidayStatus } from "@/types/holidays";

type Result = { ok: true; pending?: number } | { ok: false; error: string };
const ISO = /^\d{4}-\d{2}-\d{2}$/;

async function run(fn: (userId: string) => Promise<number | void>): Promise<Result> {
  const me = await requireAdmin();
  try {
    const n = await fn(me.id);
    revalidatePath("/settings/feriados");
    return { ok: true, pending: typeof n === "number" ? n : undefined };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error" };
  }
}

export async function setHolidayStatusAction(date: string, status: HolidayStatus): Promise<Result> {
  if (!ISO.test(date) || !["confirmado", "pendiente", "descartado"].includes(status)) return { ok: false, error: "Datos inválidos" };
  return run((uid) => setHolidayStatus(date, status, uid));
}

export async function addHolidayAction(date: string, name: string): Promise<Result> {
  if (!ISO.test(date) || !name.trim()) return { ok: false, error: "Falta la fecha o el nombre." };
  return run((uid) => addManualHoliday(date, name.trim(), uid));
}

export async function deleteHolidayAction(date: string): Promise<Result> {
  if (!ISO.test(date)) return { ok: false, error: "Datos inválidos" };
  return run(() => deleteManualHoliday(date));
}

export async function syncHolidaysAction(year: number): Promise<Result> {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: "Año inválido" };
  return run(() => syncHolidaysAsAdmin(year));
}
