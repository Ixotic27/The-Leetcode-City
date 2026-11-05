// Loads the city in headless Chromium and reports console errors and failed requests.
// Usage: node scripts/smoke.mjs [url] [screenshot.png]
import { chromium } from "@playwright/test";

const url = process.argv[2] ?? "http://localhost:3001/";
const shot = process.argv[3];
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const problems = [];
page.on("console", (m) => m.type() === "error" && problems.push(`console: ${m.text().split("\n")[0]}`));
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message.split("\n")[0]}`));
page.on("response", (r) => r.status() >= 400 && problems.push(`${r.status()} ${r.request().method()} ${r.url()}`));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120_000 });
await page.waitForTimeout(20_000);
console.log(problems.length ? problems.join("\n") : "no errors");
// Software WebGL can be too slow to finish a frame; a missing screenshot shouldn't hide the report.
if (shot) await page.screenshot({ path: shot, timeout: 60_000 }).catch((e) => console.log(`screenshot skipped: ${e.message.split("\n")[0]}`));
await browser.close();
process.exitCode = problems.length ? 1 : 0;
