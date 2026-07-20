import type { PoulpeRuntimeAdapter } from "./PoulpeRuntimeAdapter";
import { browserPoulpeRuntimeAdapter } from "./browserPoulpeRuntimeAdapter";

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

function inline(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

function renderBody(content: string) {
  const rows = content.replace(/\r\n/g, "\n").split("\n");
  const html: string[] = [];
  let listOpen = false;
  const closeList = () => { if (listOpen) html.push("</ul>"); listOpen = false; };
  for (const raw of rows) {
    const line = raw.trimEnd();
    if (!line.trim()) { closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }
    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      if (!listOpen) html.push("<ul>");
      listOpen = true;
      html.push(`<li>${inline(bullet[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<p>${inline(line)}</p>`);
  }
  closeList();
  return html.join("\n");
}

function htmlDocument(title: string, content: string) {
  const body = /<\s*(?:article|section|main|h1|p|div)[\s>]/i.test(content) ? content : renderBody(content);
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;background:#0b1024;color:#f6f0dc}main{max-width:780px;margin:auto;padding:42px 22px 70px}article{background:#11182d;border:1px solid #2b3552;border-radius:24px;padding:32px;box-shadow:0 24px 80px rgba(0,0,0,.28)}h1,h2,h3{font-family:Georgia,serif;color:#f5ddb0;line-height:1.15}h1{font-size:clamp(2rem,7vw,3.6rem)}p,li{font-size:1.05rem;line-height:1.7}code{background:#202944;padding:.12em .35em;border-radius:.35em}@media(max-width:540px){main{padding:18px 10px 44px}article{padding:24px 19px;border-radius:20px}}
</style>
</head>
<body><main><article><h1>${escapeHtml(title)}</h1>${body}</article></main></body>
</html>`;
}

export const htmlHarvestRuntimeAdapter: PoulpeRuntimeAdapter = {
  ...browserPoulpeRuntimeAdapter,
  async getLatestHarvest(missionId) {
    const bundle = await browserPoulpeRuntimeAdapter.getLatestHarvest(missionId);
    if (!bundle || bundle.harvest.kind !== "text") return bundle;
    const { title, body, status } = bundle.harvest;
    return {
      ...bundle,
      harvest: {
        kind: "landing",
        status,
        title,
        previewUrl: "",
        copy: body,
        html: htmlDocument(title, body),
      },
    };
  },
};
