import * as cp from "child_process";
import * as path from "path";
import * as fs from "fs";
import { LanguageConfig } from "./languageDetector";

export interface TestCase {
  input: string;
  output: string;
}

export interface RunResult {
  passed: boolean;
  status: "accepted" | "wrong_answer" | "tle" | "rte";
  testsPassed: number;
  testsTotal: number;
  executionTimeMs: number;
  details?: string;
  testCaseResults: TestCaseResult[];
}

export interface TestCaseResult {
  index: number;
  passed: boolean;
  status: "accepted" | "wrong_answer" | "tle" | "rte";
  actualOutput?: string;
  expectedOutput: string;
  input: string;
  errorMessage?: string;
  timeMs: number;
}

function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map(line => line.trimEnd())
    .join("\n")
    .trim();
}

export async function runTests(
  filePath: string,
  langConfig: LanguageConfig,
  testCases: TestCase[],
  timeLimitMs: number
): Promise<RunResult> {
  const dirName = path.dirname(filePath);
  const tempDir = path.join(dirName, ".arena_temp");

  // Ensure temp dir exists
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  // 1. Compile if needed
  if (langConfig.compileCmd) {
    const compileCommand = langConfig.compileCmd(filePath, tempDir);
    try {
      await new Promise<void>((resolve, reject) => {
        cp.exec(compileCommand, { cwd: dirName }, (err, stdout, stderr) => {
          if (err) {
            reject(new Error(`Compilation error:\n${stderr || stdout || err.message}`));
          } else {
            resolve();
          }
        });
      });
    } catch (compileErr: any) {
      // Clean up
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
      return {
        passed: false,
        status: "rte",
        testsPassed: 0,
        testsTotal: testCases.length,
        executionTimeMs: 0,
        details: compileErr.message,
        testCaseResults: []
      };
    }
  }

  // 2. Run test cases
  const results: TestCaseResult[] = [];
  let totalTimeMs = 0;
  let overallStatus: "accepted" | "wrong_answer" | "tle" | "rte" = "accepted";

  const runCommand = langConfig.runCmd(filePath, tempDir);

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    const startTime = process.hrtime();

    try {
      const result = await new Promise<TestCaseResult>((resolve) => {
        const child = cp.exec(runCommand, { cwd: dirName });
        
        let stdoutData = "";
        let stderrData = "";
        let isTimedOut = false;

        // Feed input to stdin
        if (child.stdin) {
          child.stdin.write(tc.input);
          child.stdin.end();
        }

        child.stdout?.on("data", (data) => {
          stdoutData += data.toString();
        });

        child.stderr?.on("data", (data) => {
          stderrData += data.toString();
        });

        // Set timeout
        const timeoutId = setTimeout(() => {
          isTimedOut = true;
          child.kill("SIGKILL");
        }, timeLimitMs);

        child.on("close", (code) => {
          clearTimeout(timeoutId);
          const endTime = process.hrtime(startTime);
          const timeMs = Math.round(endTime[0] * 1000 + endTime[1] / 1000000);

          if (isTimedOut) {
            resolve({
              index: i + 1,
              passed: false,
              status: "tle",
              input: tc.input,
              expectedOutput: tc.output,
              timeMs: timeLimitMs,
              errorMessage: `Time Limit Exceeded (> ${timeLimitMs}ms)`
            });
          } else if (code !== 0) {
            resolve({
              index: i + 1,
              passed: false,
              status: "rte",
              input: tc.input,
              expectedOutput: tc.output,
              actualOutput: stdoutData,
              timeMs,
              errorMessage: `Runtime Error: Exit code ${code}\n${stderrData}`
            });
          } else {
            const actualNorm = normalizeOutput(stdoutData);
            const expectedNorm = normalizeOutput(tc.output);
            const passed = actualNorm === expectedNorm;

            resolve({
              index: i + 1,
              passed,
              status: passed ? "accepted" : "wrong_answer",
              input: tc.input,
              expectedOutput: tc.output,
              actualOutput: stdoutData,
              timeMs
            });
          }
        });
      });

      results.push(result);
      totalTimeMs += result.timeMs;

      if (!result.passed) {
        if (overallStatus === "accepted") {
          overallStatus = result.status;
        } else if (overallStatus === "wrong_answer" && result.status !== "wrong_answer") {
          // Upgrade status priority: tle / rte > wrong_answer
          overallStatus = result.status;
        }
      }
    } catch (err: any) {
      const endTime = process.hrtime(startTime);
      const timeMs = Math.round(endTime[0] * 1000 + endTime[1] / 1000000);
      results.push({
        index: i + 1,
        passed: false,
        status: "rte",
        input: tc.input,
        expectedOutput: tc.output,
        timeMs,
        errorMessage: `Process spawn error: ${err.message}`
      });
      overallStatus = "rte";
    }
  }

  // Clean up compile directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}

  const testsPassed = results.filter((r) => r.passed).length;
  const passed = testsPassed === testCases.length;

  return {
    passed,
    status: overallStatus,
    testsPassed,
    testsTotal: testCases.length,
    executionTimeMs: totalTimeMs,
    testCaseResults: results
  };
}
