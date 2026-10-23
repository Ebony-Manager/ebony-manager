import { redirect } from "next/navigation";

import { STAFF_PATH } from "@/lib/personal/paths";

// Los documentos del personal se descargan desde Personal → Staff. Esta
// dirección queda para que no se rompan enlaces guardados.
export default function DocumentosRedirect() {
  redirect(STAFF_PATH);
}
