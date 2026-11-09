import { describe, expect, it } from "vitest";

import { isDifferentAccount } from "./session-events";

describe("SIGNED_IN del navegador", () => {
  it("la misma cuenta (otra pestaña, volver a la pestaña) no recarga", () => {
    expect(isDifferentAccount("karina@ebony.com", "karina@ebony.com")).toBe(false);
    expect(isDifferentAccount("Karina@Ebony.com ", "karina@ebony.com")).toBe(false);
  });
  it("otra cuenta, o entrar desde sin sesión, sí recarga", () => {
    expect(isDifferentAccount("karina@ebony.com", "carlos@ebony.com")).toBe(true);
    expect(isDifferentAccount(null, "carlos@ebony.com")).toBe(true);
  });
});
