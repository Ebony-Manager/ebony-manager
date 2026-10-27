import { EbonyLogo } from "./ebony-logo";

/** Server-rendered fallback: no JavaScript, font download or minimum duration.
 * Only standalone installations show the full-screen brand. The browser keeps
 * its usual loading behavior. iOS's native launch screen remains OS-controlled.
 */
export function StartupSplash() {
  return (
    <div className="startup-splash" role="status" aria-label="Cargando Ebony">
      <EbonyLogo variant="wordmark" tone="black" height={53} className="startup-splash-logo" />
    </div>
  );
}
