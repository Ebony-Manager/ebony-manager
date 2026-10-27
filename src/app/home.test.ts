import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireProfile, getProfile, redirect } = vi.hoisted(() => ({
  requireProfile: vi.fn(), getProfile: vi.fn(),
  redirect: vi.fn((path: string) => { throw new Error(`redirect:${path}`); }),
}));
vi.mock("@/lib/auth/dal", () => ({ requireProfile, getProfile }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("./login/login-form", () => ({ LoginForm: () => null }));
import RootPage from "./page";
import LoginPage from "./login/page";

beforeEach(() => vi.clearAllMocks());

describe("app entry", () => {
  it.each([
    { role: "admin", modules: [] },
    { role: "vendedor", modules: ["cotizacion"] },
    { role: "vendedor", modules: ["almacen"] },
    { role: "vendedor", modules: ["inspecciones"] },
    { role: "vendedor", modules: [] },
  ])("opens Dashboard for $role with $modules on launch and existing login session", async (profile) => {
    requireProfile.mockResolvedValue(profile);
    getProfile.mockResolvedValue(profile);
    await expect(RootPage()).rejects.toThrow("redirect:/dashboard");
    expect(requireProfile).toHaveBeenCalledOnce();
    await expect(LoginPage()).rejects.toThrow("redirect:/dashboard");
  });
  it("still requires authentication before opening Dashboard", async () => {
    requireProfile.mockImplementation(() => redirect("/login"));
    await expect(RootPage()).rejects.toThrow("redirect:/login");
    expect(redirect).not.toHaveBeenCalledWith("/dashboard");
  });
});
