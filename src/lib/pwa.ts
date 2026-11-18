import screens from "./pwa-screens.json";

// iOS selects only the image matching the device, orientation and system theme.
// Android generates its own native splash from manifest icons/background_color.
export const appleStartupImages = screens.flatMap(([width, height, scale]) =>
  ["portrait", "landscape"].flatMap((orientation) =>
    ["light", "dark"].map((theme) => ({
      url: `/splash/${width}x${height}@${scale}-${orientation}-${theme}.png`,
      media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${scale}) and (orientation: ${orientation}) and (prefers-color-scheme: ${theme})`,
    })),
  ),
);

/**
 * Script en línea para <head> (antes del primer pintado): con la app instalada en el iPhone, la página
 * empieza DEBAJO de la barra de la hora/batería, pero las imágenes de inicio cubren toda la pantalla. Se
 * guarda el alto de esa barra en `--chrome-top` para que la pantalla de carga y el login suban el logo
 * la mitad y quede en el mismo lugar que en la imagen (si no, «salta» ~30 pt hacia abajo). En el
 * navegador o de lado: 0.
 */
export const CHROME_TOP_SCRIPT = `(function(){try{var s=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone;var h=window.innerHeight,w=window.innerWidth;var d=s&&h>w?Math.round(screen.height-h):0;if(d<0||d>80)d=0;document.documentElement.style.setProperty("--chrome-top",d+"px");}catch(e){}})();`;
