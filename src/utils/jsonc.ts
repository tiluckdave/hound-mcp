/**
 * Minimal JSONC (JSON with Comments) support: strips `//` and `/* *\/`
 * comments and trailing commas before parsing as standard JSON.
 *
 * Bun's `bun.lock` is written as JSONC — real files commonly contain
 * trailing commas, which `JSON.parse` rejects outright. Both stripping
 * passes are string-literal aware so they never touch comment-like or
 * comma-like characters that appear inside quoted strings.
 */

/** Strip `//` line comments and `/* *\/` block comments outside of strings. */
function stripJsonComments(input: string): string {
  let result = "";
  let inString = false;
  let stringChar = "";
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i);
    const next = input.charAt(i + 1);

    if (inLineComment) {
      if (c === "\n") {
        inLineComment = false;
        result += c;
      }
      continue;
    }

    if (inBlockComment) {
      if (c === "*" && next === "/") {
        inBlockComment = false;
        i++;
      }
      continue;
    }

    if (inString) {
      result += c;
      if (c === "\\") {
        // Copy the escaped character verbatim so an escaped quote
        // doesn't prematurely end the string.
        i++;
        result += input.charAt(i);
        continue;
      }
      if (c === stringChar) inString = false;
      continue;
    }

    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      result += c;
      continue;
    }

    if (c === "/" && next === "/") {
      inLineComment = true;
      i++;
      continue;
    }

    if (c === "/" && next === "*") {
      inBlockComment = true;
      i++;
      continue;
    }

    result += c;
  }

  return result;
}

/** Remove commas that precede a closing `]` or `}` (ignoring whitespace), outside of strings. */
function stripTrailingCommas(input: string): string {
  let result = "";
  let inString = false;
  let stringChar = "";

  for (let i = 0; i < input.length; i++) {
    const c = input.charAt(i);

    if (inString) {
      result += c;
      if (c === "\\") {
        i++;
        result += input.charAt(i);
        continue;
      }
      if (c === stringChar) inString = false;
      continue;
    }

    if (c === '"' || c === "'") {
      inString = true;
      stringChar = c;
      result += c;
      continue;
    }

    if (c === ",") {
      let j = i + 1;
      while (j < input.length && /\s/.test(input.charAt(j))) j++;
      const nextNonSpace = input.charAt(j);
      if (nextNonSpace === "]" || nextNonSpace === "}") {
        continue; // drop this trailing comma
      }
    }

    result += c;
  }

  return result;
}

/** Parse a JSONC string (comments + trailing commas tolerated) as JSON. */
export function parseJsonc(content: string): unknown {
  return JSON.parse(stripTrailingCommas(stripJsonComments(content)));
}
