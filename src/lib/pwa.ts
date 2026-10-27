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
