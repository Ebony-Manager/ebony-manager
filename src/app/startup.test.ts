import * as React from "react";
import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), getProfile: vi.fn() }));
vi.mock("@/lib/auth/dal", () => auth);
vi.mock("next/font/google", () => ({ Inter: () => ({ variable: "" }), Merriweather: () => ({ variable: "" }), JetBrains_Mono: () => ({ variable: "" }) }));
vi.mock("@/components/providers", () => ({ Providers: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("./globals.css", () => ({}));
import RootLayout from "./layout";

it("streams the brand before the session resolves, then replaces it with the app without a timer", async () => {
  vi.stubGlobal("React", React);
  let resolveUser!: (value: null) => void;
  auth.getUser.mockReturnValue(new Promise<null>((resolve) => { resolveUser = resolve; }));
  auth.getProfile.mockResolvedValue(null);
  const output = new PassThrough();
  let html = "";
  output.on("data", (chunk) => { html += chunk.toString(); });
  let stream!: ReturnType<typeof renderToPipeableStream>;
  const shell = new Promise<void>((resolve, reject) => {
    stream = renderToPipeableStream(React.createElement(RootLayout, null, React.createElement("main", null, "APP_READY")), {
      onShellReady() { stream.pipe(output); resolve(); },
      onError: reject,
    });
  });
  const finished = new Promise<void>((resolve) => output.on("end", resolve));
  try {
    await shell;
    expect(html).toContain('class="startup-splash"');
    expect(html).toContain('aria-label="Ebony"');
    expect(html).not.toContain("APP_READY");
    expect(html.slice(0, html.indexOf("</head>"))).toContain("440x956@3-portrait-light.png");
    resolveUser(null);
    await finished;
    expect(html).toContain("APP_READY");
    // React's streamed Suspense instruction replaces the temporary fallback.
    expect(html).toContain('$RC(');
  } finally {
    stream.abort();
    vi.unstubAllGlobals();
  }
});
