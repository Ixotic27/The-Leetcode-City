/**
 * Lightweight client-side evaluation for Arcade Battle challenges.
 * Supports a small Python-like subset used by the built-in templates.
 */

export type BattleTest = { input: string; output: string };

function transpilePythonish(code: string): string {
  let js = code
    .replace(/\r\n/g, "\n")
    .replace(/#.*/g, "")
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null")
    .replace(/\band\b/g, "&&")
    .replace(/\bor\b/g, "||")
    .replace(/\bnot\b/g, "!")
    .replace(/\bpass\b/g, "/* pass */")
    .replace(/\bprint\s*\(/g, "console.log(");

  // def name(args): -> function name(args) {
  js = js.replace(/\bdef\s+([A-Za-z_]\w*)\s*\(([^)]*)\)\s*:/g, "function $1($2) {");
  // for i, x in enumerate(y):
  js = js.replace(
    /\bfor\s+([A-Za-z_]\w*)\s*,\s*([A-Za-z_]\w*)\s+in\s+enumerate\(([^)]+)\)\s*:/g,
    "for (let $2 = 0; $2 < ($3).length; $2++) { const $1 = ($3)[$2];"
  );
  // for x in y:
  js = js.replace(
    /\bfor\s+([A-Za-z_]\w*)\s+in\s+([^:]+):/g,
    "for (const $1 of ($2)) {"
  );
  // while cond:
  js = js.replace(/\bwhile\s+(.+):/g, "while ($1) {");
  // if / elif / else
  js = js.replace(/\belif\s+(.+):/g, "} else if ($1) {");
  js = js.replace(/\belse\s*:/g, "} else {");
  js = js.replace(/\bif\s+(.+):/g, "if ($1) {");
  // close blocks roughly by line indent is hard; templates use simple structure.
  // Append closing braces to balance opens after transpile.
  const opens = (js.match(/{/g) || []).length;
  const closes = (js.match(/}/g) || []).length;
  if (opens > closes) js += "\n" + "}".repeat(opens - closes);
  return js;
}

function parseNumsTarget(input: string): { nums: number[]; target: number } | null {
  const m = input.match(/nums\s*=\s*\[([^\]]*)\]\s*,\s*target\s*=\s*(-?\d+)/);
  if (!m) return null;
  const nums = m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
  return { nums, target: Number(m[2]) };
}

function parseHeight(input: string): number[] | null {
  const m = input.match(/height\s*=\s*\[([^\]]*)\]/);
  if (!m) return null;
  return m[1]
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number);
}

function normalizeOutput(value: unknown): string {
  return JSON.stringify(value).replace(/\s+/g, "");
}

function expectedNormalized(output: string): string {
  // outputs are like "[0, 1]" or "49"
  try {
    return normalizeOutput(JSON.parse(output.replace(/'/g, '"')));
  } catch {
    return output.replace(/\s+/g, "");
  }
}

export function runBattleTests(
  code: string,
  problemKey: string,
  tests: BattleTest[]
): boolean[] {
  const trimmed = code.trim();
  if (!trimmed || trimmed.includes("pass") && trimmed.length < 80 && !trimmed.includes("return")) {
    // still try evaluate — empty/default stubs fail
  }

  try {
    const js = transpilePythonish(code);
    // eslint-disable-next-line no-new-func
    const factory = new Function(
      `${js}\n; return { twoSum: typeof twoSum !== "undefined" ? twoSum : null, maxArea: typeof maxArea !== "undefined" ? maxArea : null };`
    );
    const fns = factory() as {
      twoSum: ((nums: number[], target: number) => number[]) | null;
      maxArea: ((height: number[]) => number) | null;
    };

    return tests.map((t) => {
      try {
        if (problemKey === "twosum" || code.includes("twoSum")) {
          const parsed = parseNumsTarget(t.input);
          if (!parsed || !fns.twoSum) return false;
          const result = fns.twoSum(parsed.nums, parsed.target);
          return normalizeOutput(result) === expectedNormalized(t.output);
        }
        if (problemKey === "container" || code.includes("maxArea")) {
          const height = parseHeight(t.input);
          if (!height || !fns.maxArea) return false;
          const result = fns.maxArea(height);
          return normalizeOutput(result) === expectedNormalized(t.output);
        }
        return false;
      } catch {
        return false;
      }
    });
  } catch {
    return tests.map(() => false);
  }
}
