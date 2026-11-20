import { describe, expect, it } from "vitest";
import { colorFamilyOf, compareSizes } from "./shopFilters";

describe("colorFamilyOf", () => {
  it("maps the free-form colour names used in the catalogue", () => {
    expect(colorFamilyOf("Cherry Red Shade")).toBe("red");
    expect(colorFamilyOf("Black Colour")).toBe("black");
    expect(colorFamilyOf("Rose Pink")).toBe("pink");
    expect(colorFamilyOf("Ocean Blue Shade")).toBe("blue");
    expect(colorFamilyOf("Mustard Yellow")).toBe("yellow");
    expect(colorFamilyOf("Burnt Orange")).toBe("orange");
    expect(colorFamilyOf("Olive Green")).toBe("green");
    expect(colorFamilyOf("Dark Purple")).toBe("purple");
    expect(colorFamilyOf("dual colour tone (gold)")).toBe("metallic");
  });

  it("uses the colour named first", () => {
    expect(colorFamilyOf("Ivory with Lime Green Dupatta")).toBe("white");
  });

  it("does not match keywords inside other words", () => {
    // "tan" must not match inside "Mustard"-like words; "red" not inside "Shredded".
    expect(colorFamilyOf("Shredded Teal")).toBe("blue");
  });

  it("falls back to other / null", () => {
    expect(colorFamilyOf("Rainbow")).toBe("other");
    expect(colorFamilyOf("")).toBeNull();
    expect(colorFamilyOf(null)).toBeNull();
  });
});

describe("compareSizes", () => {
  it("orders standard sizes and puts unknown ones last", () => {
    expect(["XL", "S", "Custom", "XS", "M"].sort(compareSizes)).toEqual(["XS", "S", "M", "XL", "Custom"]);
  });
});
