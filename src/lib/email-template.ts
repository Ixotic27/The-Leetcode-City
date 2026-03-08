const BASE_URL = "https://thegitcity.com";

const FONT = `'Silkscreen', monospace`;
const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Silkscreen:wght@400;700&display=swap');`;

export function wrapInBaseTemplate(bodyHtml: string, unsubscribeUrl?: string): string {
  const footer = unsubscribeUrl
    ? `<a href="${escapeHtml(unsubscribeUrl)}" style="color: #3a3a44; text-decoration: underline; font-family: ${FONT}; font-size: 11px;">unsubscribe</a>&nbsp;&middot;&nbsp;`
    : "";

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light dark" />
  <meta name="supported-color-schemes" content="light dark" />
  <style>${FONT_IMPORT}</style>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0e; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #0a0a0e;">
  <tr>
    <td align="center" style="padding: 48px 20px;">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; width: 100%;">

        <!-- Logo -->
        <tr>
          <td align="center" style="padding-bottom: 44px;">
            <span style="font-family: ${FONT}; font-size: 16px; font-weight: 400; letter-spacing: 6px;"><span style="color: #f0f0f0;">GIT</span> <span style="color: #ffa116;">CITY</span></span>
          </td>
        </tr>

        <!-- Body -->
        <tr><td>${bodyHtml}</td></tr>

        <!-- Footer divider -->
        <tr>
          <td style="padding: 24px 0;">
            <div style="height: 1px; background-color: #1c1c20;"></div>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center">
            <span style="font-family: ${FONT}; font-size: 11px; color: #3a3a44;">
              ${footer}<a href="${BASE_URL}" style="color: #3a3a44; text-decoration: none; font-family: ${FONT}; font-size: 11px;">thegitcity.com</a>
            </span>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildButton(text: string, url: string): string {
  return `<div style="text-align: center; margin: 24px 0;">
  <a href="${escapeHtml(url)}" style="display: inline-block; padding: 16px 36px; background-color: #ffa116; color: #0a0a0e; font-family: ${FONT}; font-weight: 700; font-size: 14px; text-decoration: none; letter-spacing: 1px;">
    ${escapeHtml(text)}
  </a>
</div>`;
}

export function buildStatRow(label: string, value: string | number): string {
  return `<tr>
  <td style="padding: 10px 14px; border: 1px solid #1c1c20; color: #ffa116; font-size: 20px; font-weight: bold; font-family: ${FONT};">${value}</td>
  <td style="padding: 10px 14px; border: 1px solid #1c1c20; color: #f0f0f0; font-family: ${FONT}; font-size: 14px;">${escapeHtml(String(label))}</td>
</tr>`;
}

export function buildStatsTable(rows: { label: string; value: string | number }[]): string {
  return `<table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
  ${rows.map((r) => buildStatRow(r.label, r.value)).join("\n")}
</table>`;
}
