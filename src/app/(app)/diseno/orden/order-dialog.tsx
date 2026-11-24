"use client";

import * as React from "react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LoadingBlock } from "@/components/shared/loading-block";
import { getOrderBundleAction, type OrderBundle } from "./actions";
import { OrderRefresh, OrderView } from "./[id]/order-view";

/**
 * La orden de producción en una ventana flotante, encima del tablero o de la ficha del proyecto: se abre, se arma
 * y se cierra sin cambiar de pantalla. Cada cambio se guarda al momento; al cerrar, la pantalla de atrás se pone al día.
 */
export function OrderDialog({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const router = useRouter();
  const [bundle, setBundle] = React.useState<OrderBundle | null>(null);
  const changed = React.useRef(false);

  const load = React.useCallback(async (id: string) => {
    const res = await getOrderBundleAction(id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setBundle(res.data);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- carga al abrir. */
  React.useEffect(() => {
    setBundle(null);
    changed.current = false;
    if (orderId) void load(orderId);
  }, [orderId, load]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const refresh = React.useCallback(() => {
    changed.current = true;
    if (orderId) void load(orderId);
  }, [orderId, load]);

  const close = () => {
    if (changed.current) router.refresh();
    onClose();
  };

  if (!orderId) return null;
  return (
    // ui-allow: sin-campos (la ventana muestra la orden; cada parte abre su propio formulario)
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] max-w-[min(96vw,56rem)] overflow-y-auto">
        {bundle ? (
          <OrderRefresh.Provider value={refresh}>
            <OrderView
              {...bundle}
              variant="dialog"
              onDeleted={() => {
                changed.current = true;
                close();
              }}
            />
          </OrderRefresh.Provider>
        ) : (
          <>
            <DialogTitle className="sr-only">…</DialogTitle>
            <LoadingBlock rows={6} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
