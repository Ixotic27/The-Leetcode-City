export function getBaseUrl(): string {
  const configuredUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL;

  if (configuredUrl) return configuredUrl.replace(/\/+$/, "");

  if (process.env.VERCEL_URL) {
    const vercelUrl = process.env.VERCEL_URL.replace(/^https?:\/\//, "");
    return `https://${vercelUrl}`;
  }

  return "http://localhost:3001";
}
