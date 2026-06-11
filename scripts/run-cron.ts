import { NextRequest } from "next/server";
import path from "path";
import { pathToFileURL } from "url";

async function main() {
  const cronName = process.argv[2];
  if (!cronName) {
    console.error("Please provide a cron name (e.g., cleanup-sessions)");
    process.exit(1);
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set in env");
    process.exit(1);
  }

  console.log(`[run-cron] Starting job: ${cronName}`);
  
  // Resolve absolute path to the route handler and convert to file:// URL for Windows compatibility
  const routePath = path.resolve(process.cwd(), `src/app/api/cron/${cronName}/route.ts`);
  const routeUrl = pathToFileURL(routePath).href;
  console.log(`[run-cron] Loading route handler from: ${routeUrl}`);

  try {
    const route = await import(routeUrl);
    if (typeof route.GET !== "function") {
      throw new Error(`Route does not export a GET handler`);
    }

    const req = new NextRequest(`http://localhost/api/cron/${cronName}`, {
      headers: {
        Authorization: `Bearer ${secret}`
      }
    });

    const res = await route.GET(req);
    console.log(`[run-cron] Response Status: ${res.status}`);
    
    let body;
    try {
      body = await res.json();
    } catch {
      try {
        body = await res.text();
      } catch {
        body = "(no body)";
      }
    }
    
    console.log("[run-cron] Response Body:", body);
    
    if (res.status >= 400) {
      console.error(`[run-cron] Job failed with status ${res.status}`);
      process.exit(1);
    }
    
    console.log(`[run-cron] Job completed successfully: ${cronName}`);
  } catch (error) {
    console.error(`[run-cron] Failed to run cron job ${cronName}:`, error);
    process.exit(1);
  }
}

main();
