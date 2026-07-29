import { describe, expect, it } from "vitest";
import { parseJsonc } from "../../src/utils/jsonc.js";

describe("parseJsonc", () => {
  it("parses plain JSON unchanged", () => {
    expect(parseJsonc('{"a": 1, "b": [1, 2, 3]}')).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("strips trailing commas in objects and arrays", () => {
    const content = `{
      "a": 1,
      "b": [1, 2, 3,],
    }`;
    expect(parseJsonc(content)).toEqual({ a: 1, b: [1, 2, 3] });
  });

  it("strips // line comments", () => {
    const content = `{
      // leading comment
      "a": 1, // trailing comment
      "b": 2
    }`;
    expect(parseJsonc(content)).toEqual({ a: 1, b: 2 });
  });

  it("strips /* */ block comments", () => {
    const content = `{
      /* block comment */
      "a": 1 /* inline */, "b": 2
    }`;
    expect(parseJsonc(content)).toEqual({ a: 1, b: 2 });
  });

  it("does not touch comment-like or comma-like sequences inside strings", () => {
    const content = `{"url": "https://example.com", "note": "a, b, /* not a comment */ c,"}`;
    expect(parseJsonc(content)).toEqual({
      url: "https://example.com",
      note: "a, b, /* not a comment */ c,",
    });
  });

  it("handles escaped quotes inside strings", () => {
    const content = `{"msg": "she said \\"hi\\", then left,"}`;
    expect(parseJsonc(content)).toEqual({ msg: 'she said "hi", then left,' });
  });

  it("throws on genuinely invalid JSON", () => {
    expect(() => parseJsonc("not valid json {{{")).toThrow();
  });
});
