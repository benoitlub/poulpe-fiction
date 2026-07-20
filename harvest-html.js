(function harvestHtmlModule(global) {
  "use strict";

  const text = (value) => typeof value === "string" ? value.trim() : "";
  const escapeHtml = (value) => String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

  function inline(value) {
    return escapeHtml(value)
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>");
  }

  function markdown(value) {
    const lines = String(value || "").replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let listOpen = false;
    const closeList = () => {
      if (listOpen) html.push("</ul>");
      listOpen = false;
    };
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (!line.trim()) {
        closeList();
        continue;
      }
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

  function filename(title, operationId) {
    const base = text(title) || text(operationId) || "recolte";
    return `${base.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "recolte"}.html`;
  }

  function document(input = {}) {
    const title = text(input.title) || "Récolte Poulpe Fiction";
    const content = text(input.content);
    const createdAt = text(input.createdAt);
    const body = /<\s*(?:article|section|main|h1|p|div)[\s>]/i.test(content) ? content : markdown(content);
    return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root{color-scheme:light dark;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}body{margin:0;background:#0b1024;color:#f6f0dc}main{max-width:780px;margin:auto;padding:48px 24px 72px}article{background:#11182d;border:1px solid #2b3552;border-radius:24px;padding:32px;box-shadow:0 24px 80px rgba(0,0,0,.28)}h1,h2,h3{font-family:Georgia,serif;color:#f5ddb0;line-height:1.15}h1{font-size:clamp(2rem,7vw,3.6rem)}p,li{font-size:1.08rem;line-height:1.7}code{background:#202944;padding:.12em .35em;border-radius:.35em}footer{margin-top:28px;color:#aab4cc;font-size:.86rem}@media(max-width:540px){main{padding:20px 12px 48px}article{padding:24px 20px;border-radius:20px}}
</style>
</head>
<body><main><article><h1>${escapeHtml(title)}</h1>${body}<footer>Récolte produite par Poulpe Fiction${createdAt ? ` · ${escapeHtml(createdAt)}` : ""}</footer></article></main></body>
</html>`;
  }

  function artifact(input = {}) {
    const html = document(input);
    const url = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    return {
      html,
      url,
      downloadUrl: url,
      filename: filename(input.title, input.operationId),
      artifactType: "text/html",
      mimeType: "text/html; charset=utf-8"
    };
  }

  global.PoulpeHarvestHtml = { artifact, document, markdown, filename };
})(globalThis);
