import type { ReactNode } from "react";

export function plainHarvestText(markdown: string): string {
  return markdown.replace(/\r\n/g, "\n")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/(^|\n)\s{0,3}#{1,6}\s+/g, "$1")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, "$1")
    .replace(/(^|\n)\s*>\s?/g, "$1")
    .replace(/(^|\n)\s*[-*]\s+/g, "$1• ")
    .replace(/\n{3,}/g, "\n\n").trim();
}

function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*\n]+\*\*|\*[^*\n]+\*|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g);
  return parts.map((part, index) => {
    const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
    if (link) return <a key={index} href={link[2]} target="_blank" rel="noopener noreferrer">{link[1]}</a>;
    if (part.startsWith("**") && part.endsWith("**")) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.endsWith("*")) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}

export function ReadableHarvest({ content }: { content: string }) {
  const blocks = content.replace(/\r\n/g, "\n").split(/\n\s*\n/g).filter(Boolean);
  return <div className="pf-readable-harvest">{blocks.map((block, index) => {
    const lines = block.split("\n");
    const heading = lines.length === 1 && lines[0].match(/^\s{0,3}(#{1,4})\s+(.+)$/);
    if (heading) return <h3 key={index}>{inline(heading[2])}</h3>;
    if (lines.every(line => /^\s*[-*]\s+/.test(line))) return <ul key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*[-*]\s+/, ""))}</li>)}</ul>;
    if (lines.every(line => /^\s*\d+\.\s+/.test(line))) return <ol key={index}>{lines.map((line, i) => <li key={i}>{inline(line.replace(/^\s*\d+\.\s+/, ""))}</li>)}</ol>;
    if (lines.every(line => /^\s*>/.test(line))) return <blockquote key={index}>{lines.map((line, i) => <p key={i}>{inline(line.replace(/^\s*>\s?/, ""))}</p>)}</blockquote>;
    return <p key={index}>{lines.map((line, i) => <span key={i}>{i > 0 ? <br /> : null}{inline(line.replace(/^\s*>\s?/, ""))}</span>)}</p>;
  })}</div>;
}
