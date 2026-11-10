import { describe, expect, it } from "vitest";

import { shouldMove, stageForProject } from "./stage-rules";

describe("Drive · carpetas por etapa", () => {
  it("terminado va a TERMINADOS; activo (o sin estado) a ACTIVOS", () => {
    expect(stageForProject("COMPLETED")).toBe("TERMINADOS");
    expect(stageForProject("ACTIVE")).toBe("ACTIVOS");
    expect(stageForProject(null)).toBe("ACTIVOS");
  });

  it("mueve solo desde la raíz o las otras etapas", () => {
    const managed = ["root", "opp", "act", "term"];
    expect(shouldMove(["opp"], "act", managed)).toEqual(["opp"]);
    expect(shouldMove(["root"], "act", managed)).toEqual(["root"]);
    expect(shouldMove(["act"], "act", managed)).toBeNull();
    expect(shouldMove(["otra-carpeta"], "term", managed)).toBeNull();
    expect(shouldMove([], "act", managed)).toBeNull();
  });
});
