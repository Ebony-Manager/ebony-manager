"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { Check, Combine, Pencil, Plus, X } from "lucide-react";

import type { InspectionArea } from "@/types/inspections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmButton } from "@/components/shared/confirm-button";
import { cleanAreaName, sameArea, similarAreas } from "@/lib/inspections/areas";
import {
  createAreaAction,
  deleteAreaAction,
  mergeAreasAction,
  renameAreaAction,
} from "./actions";
import { useTi } from "./shared";

/**
 * Áreas de la obra: la lista fija de donde se eligen. Renombrar o juntar
 * actualiza los detalles; borrar solo si nadie la usa. Al lado de cada una,
 * las parecidas (para juntarlas si son la misma).
 */
export function AreasDialog({
  open,
  projectId,
  areas,
  onClose,
  onChanged,
}: {
  open: boolean;
  projectId: string;
  areas: InspectionArea[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const { ti } = useTi();
  const [editing, setEditing] = React.useState<{
    id: string;
    name: string;
  } | null>(null);
  const [merging, setMerging] = React.useState<{
    id: string;
    into: string;
  } | null>(null);
  const [adding, setAdding] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const names = areas.map((a) => a.name);

  async function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    done: string,
  ) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok)
      return void toast.error(
        res.error?.includes("AREA_YA_EXISTE")
          ? ti("areas_exists")
          : (res.error ?? ti("error")),
      );
    toast.success(done);
    setEditing(null);
    setMerging(null);
    onChanged();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-h-[92dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ti("areas_title")}</DialogTitle>
          <DialogDescription>{ti("areas_hint")}</DialogDescription>
        </DialogHeader>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const n = cleanAreaName(adding);
            if (!n) return;
            void run(async () => {
              const r = await createAreaAction(projectId, n);
              if (r.ok) setAdding("");
              return r;
            }, ti("saved"));
          }}
        >
          <Input
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            placeholder={ti("areas_new")}
          />
          <Button
            type="submit"
            variant="outline"
            disabled={
              busy || !cleanAreaName(adding) || !!sameArea(adding, names)
            }
          >
            <Plus className="size-4" />
            {ti("areas_add")}
          </Button>
        </form>

        {areas.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            {ti("areas_empty")}
          </p>
        ) : (
          <ul className="flex flex-col rounded-lg border border-border">
            {areas.map((a) => {
              const similar = similarAreas(
                a.name,
                names.filter((n) => n !== a.name),
              );
              return (
                <li
                  key={a.id}
                  className="flex flex-col gap-2 border-b border-border px-3 py-2.5 last:border-0"
                >
                  {editing?.id === a.id ? (
                    <form
                      className="flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(
                          () => renameAreaAction(a.id, editing.name),
                          ti("areas_renamed"),
                        );
                      }}
                    >
                      <Input
                        autoFocus
                        value={editing.name}
                        onChange={(e) =>
                          setEditing({ id: a.id, name: e.target.value })
                        }
                      />
                      <Button
                        type="submit"
                        size="icon"
                        disabled={busy || !cleanAreaName(editing.name)}
                        aria-label={ti("save")}
                        title={ti("save")}
                      >
                        <Check className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                        aria-label={ti("cancel")}
                        title={ti("cancel")}
                      >
                        <X className="size-4" />
                      </Button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium break-words text-foreground">
                          {a.name}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {ti("sch_n_items", { n: a.items })}
                        </span>
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground"
                        onClick={() => setEditing({ id: a.id, name: a.name })}
                        aria-label={ti("areas_rename")}
                        title={ti("areas_rename")}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {areas.length > 1 && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground"
                          onClick={() => setMerging({ id: a.id, into: "" })}
                          aria-label={ti("areas_merge")}
                          title={ti("areas_merge")}
                        >
                          <Combine className="size-4" />
                        </Button>
                      )}
                      {a.items === 0 && (
                        <ConfirmButton
                          iconOnly
                          label={ti("areas_delete")}
                          confirmLabel={ti("areas_delete_q")}
                          onConfirm={() =>
                            void run(
                              () => deleteAreaAction(a.id),
                              ti("areas_deleted"),
                            )
                          }
                          disabled={busy}
                        />
                      )}
                    </div>
                  )}
                  {similar.length > 0 &&
                    editing?.id !== a.id &&
                    merging?.id !== a.id && (
                      <p className="text-xs text-warning">
                        {ti("area_similar")} {similar.join(" · ")}
                      </p>
                    )}
                  {merging?.id === a.id && (
                    <div className="flex flex-col gap-2 rounded-md bg-muted/40 p-2">
                      <span className="text-xs text-muted-foreground">
                        {ti("areas_merge_into", { from: a.name })}
                      </span>
                      <div className="flex gap-2">
                        <Select
                          value={merging.into}
                          onValueChange={(into) =>
                            setMerging({ id: a.id, into })
                          }
                        >
                          <SelectTrigger className="min-w-0 flex-1 [&>span]:min-w-0 [&>span]:overflow-hidden">
                            <SelectValue placeholder={ti("areas_merge")} />
                          </SelectTrigger>
                          <SelectContent>
                            {[
                              ...areas.filter(
                                (x) =>
                                  x.id !== a.id && similar.includes(x.name),
                              ),
                              ...areas.filter(
                                (x) =>
                                  x.id !== a.id && !similar.includes(x.name),
                              ),
                            ].map((x) => (
                              <SelectItem key={x.id} value={x.id}>
                                {x.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          size="sm"
                          disabled={busy || !merging.into}
                          onClick={() =>
                            void run(
                              () => mergeAreasAction(a.id, merging.into),
                              ti("areas_merged"),
                            )
                          }
                        >
                          {ti("areas_merge_do")}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-9"
                          onClick={() => setMerging(null)}
                          aria-label={ti("cancel")}
                          title={ti("cancel")}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
