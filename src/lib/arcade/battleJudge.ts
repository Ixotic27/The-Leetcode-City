/** Local Arcade Battle judge: runs submitted Python-like code against structured tests. */

export type BattleTestCase = {
  /** Human-readable input shown in the console */
  input: string;
  /** Human-readable expected output shown in the console */
  output: string;
  /** Arguments passed to the solution function */
  args: unknown[];
  /** Expected return value (deep-compared) */
  expected: unknown;
};

export type BattleTestResult = {
  passed: boolean;
  error?: string;
};

function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== typeof b) return false;
  if (a === null || b === null) return a === b;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  if (typeof a === "object" && typeof b === "object") {
    const ao = a as Record<string, unknown>;
    const bo = b as Record<string, unknown>;
    const keys = Object.keys(ao);
    if (keys.length !== Object.keys(bo).length) return false;
    return keys.every((k) => deepEqual(ao[k], bo[k]));
  }
  return false;
}

/**
 * Transpile a small Python subset used by Arcade Battle templates into JS.
 * Supports: def/if/elif/else/while/for-enumerate/for-in, len, min/max, dict `in`,
 * tuple unpack assignment, True/False/None, pass, and # comments.
 */
export function transpilePythonSubset(source: string): string {
  const rawLines = source.replace(/\r\n/g, "\n").split("\n");
  const lines: string[] = [];

  for (const raw of rawLines) {
    const hash = raw.indexOf("#");
    const withoutComment = hash >= 0 ? raw.slice(0, hash) : raw;
    if (withoutComment.trim().length === 0) continue;
    lines.push(withoutComment.replace(/\t/g, "    "));
  }

  const indentOf = (line: string) => {
    const m = line.match(/^ */);
    return m ? Math.floor(m[0].length / 4) : 0;
  };

  const rewriteExpr = (expr: string): string => {
    let e = expr.trim();
    e = e.replace(/\bTrue\b/g, "true");
    e = e.replace(/\bFalse\b/g, "false");
    e = e.replace(/\bNone\b/g, "null");
    e = e.replace(/\band\b/g, "&&");
    e = e.replace(/\bor\b/g, "||");
    e = e.replace(/\bnot\b/g, "!");
    e = e.replace(/\blen\s*\(/g, "__len__(");
    e = e.replace(/\bmin\s*\(/g, "Math.min(");
    e = e.replace(/\bmax\s*\(/g, "Math.max(");
    // `x in mapping` → key check (Arcade Battle only uses dict membership)
    e = e.replace(
      /(\b[\w.]+)\s+in\s+(\b[\w.]+)/g,
      "Object.prototype.hasOwnProperty.call($2, $1)",
    );
    return e;
  };

  const out: string[] = [];
  const stack: number[] = [0];
  const declared = new Set<string>();

  const closeTo = (level: number) => {
    while (stack.length > 1 && stack[stack.length - 1] > level) {
      stack.pop();
      out.push("}");
    }
  };

  const declareOrAssign = (name: string, rhs: string) => {
    if (declared.has(name)) {
      out.push(`${name} = ${rhs};`);
    } else {
      declared.add(name);
      out.push(`let ${name} = ${rhs};`);
    }
  };

  for (const line of lines) {
    const indent = indentOf(line);
    const content = line.trim();

    closeTo(indent);

    if (content === "pass") {
      out.push(";");
      continue;
    }

    const defMatch = content.match(/^def\s+(\w+)\s*\((.*)\)\s*:$/);
    if (defMatch) {
      declared.clear();
      for (const param of defMatch[2].split(",").map((p) => p.trim()).filter(Boolean)) {
        declared.add(param);
      }
      out.push(`function ${defMatch[1]}(${defMatch[2]}) {`);
      stack.push(indent + 1);
      continue;
    }

    const elifMatch = content.match(/^elif\s+(.+):$/);
    if (elifMatch) {
      // closeTo() already closed the previous if/elif body
      out.push(`else if (${rewriteExpr(elifMatch[1])}) {`);
      stack.push(indent + 1);
      continue;
    }

    const elseMatch = content.match(/^else\s*:$/);
    if (elseMatch) {
      out.push("else {");
      stack.push(indent + 1);
      continue;
    }

    const ifMatch = content.match(/^if\s+(.+):$/);
    if (ifMatch) {
      out.push(`if (${rewriteExpr(ifMatch[1])}) {`);
      stack.push(indent + 1);
      continue;
    }

    const whileMatch = content.match(/^while\s+(.+):$/);
    if (whileMatch) {
      out.push(`while (${rewriteExpr(whileMatch[1])}) {`);
      stack.push(indent + 1);
      continue;
    }

    const enumMatch = content.match(
      /^for\s+(\w+)\s*,\s*(\w+)\s+in\s+enumerate\s*\(\s*([\w.]+)\s*\)\s*:$/,
    );
    if (enumMatch) {
      const [, i, val, arr] = enumMatch;
      declared.add(i);
      declared.add(val);
      out.push(
        `for (let ${i} = 0; ${i} < __len__(${arr}); ${i}++) { const ${val} = ${arr}[${i}];`,
      );
      stack.push(indent + 1);
      continue;
    }

    const forInMatch = content.match(/^for\s+(\w+)\s+in\s+(.+):$/);
    if (forInMatch) {
      declared.add(forInMatch[1]);
      out.push(`for (const ${forInMatch[1]} of ${rewriteExpr(forInMatch[2])}) {`);
      stack.push(indent + 1);
      continue;
    }

    const compoundMatch = content.match(/^([\w.\[\]]+)\s*(\+\=|\-\=|\*\=|\/\=)\s*(.+)$/);
    if (compoundMatch) {
      out.push(
        `${compoundMatch[1]} ${compoundMatch[2]} ${rewriteExpr(compoundMatch[3])};`,
      );
      continue;
    }

    const unpackMatch = content.match(/^([\w\s,]+)=(.+)$/);
    if (unpackMatch && unpackMatch[1].includes(",")) {
      const names = unpackMatch[1]
        .split(",")
        .map((n) => n.trim())
        .filter(Boolean);
      for (const n of names) declared.add(n);
      const rhs = rewriteExpr(unpackMatch[2]);
      out.push(`let [${names.join(", ")}] = [${rhs}];`);
      continue;
    }

    if (content.startsWith("return ")) {
      out.push(`return ${rewriteExpr(content.slice(7))};`);
      continue;
    }

    const assignMatch = content.match(/^([\w.\[\]]+)\s*=\s*(.+)$/);
    if (
      assignMatch &&
      !content.includes("==") &&
      !content.includes("!=") &&
      !content.includes("<=") &&
      !content.includes(">=")
    ) {
      const lhs = assignMatch[1];
      const rhs = rewriteExpr(assignMatch[2]);
      if (/^[A-Za-z_]\w*$/.test(lhs)) {
        declareOrAssign(lhs, rhs);
      } else {
        out.push(`${lhs} = ${rhs};`);
      }
      continue;
    }

    out.push(`${rewriteExpr(content)};`);
  }

  closeTo(0);
  return out.join("\n");
}

export function runBattleTests(
  source: string,
  fnName: string,
  tests: BattleTestCase[],
): BattleTestResult[] {
  let fn: ((...args: unknown[]) => unknown) | null = null;
  let compileError: string | null = null;

  try {
    const js = transpilePythonSubset(source);
    const factory = new Function(
      `"use strict";
      const __len__ = (x) => (x == null ? 0 : x.length);
      ${js}
      if (typeof ${fnName} !== "function") {
        throw new Error("Missing function ${fnName}");
      }
      return ${fnName};`,
    );
    fn = factory() as (...args: unknown[]) => unknown;
  } catch (e) {
    compileError = e instanceof Error ? e.message : String(e);
  }

  if (!fn) {
    return tests.map(() => ({
      passed: false,
      error: compileError ?? "Compile error",
    }));
  }

  return tests.map((t) => {
    try {
      const result = fn!(...t.args);
      return { passed: deepEqual(result, t.expected) };
    } catch (e) {
      return {
        passed: false,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  });
}
