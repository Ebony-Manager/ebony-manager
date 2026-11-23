import { describe, expect, it } from "vitest";
import { projectAddress } from "./address";

describe("projectAddress", () => {
  it("arma barrio · edificio apartamento con lo que haya", () => {
    expect(projectAddress({ location: "Santa María", building: "PH Serena", unit: "7A" })).toBe("Santa María · PH Serena 7A");
    expect(projectAddress({ location: null, building: "PH Vitri", unit: "Apt 44A" })).toBe("PH Vitri 44A");
    expect(projectAddress({ location: "Buenaventura", building: null, unit: null })).toBe("Buenaventura");
    expect(projectAddress({ location: " ", building: "", unit: null })).toBe("");
  });
});
