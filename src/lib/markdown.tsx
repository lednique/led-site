function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(s: string): string {
  return escapeHtml(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    )
    // mailto открывается в почтовой программе — новая вкладка не нужна.
    .replace(/\[([^\]]+)\]\((mailto:[^\s)]+)\)/g, '<a href="$2">$1</a>');
}

export function renderMarkdown(source: string): string {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let list: string[] = [];

  const flushList = () => {
    if (!list.length) return;
    out.push(`<ul>${list.map((i) => `<li>${inline(i)}</li>`).join("")}</ul>`);
    list = [];
  };

  for (const line of lines) {
    const item = line.match(/^\s*[-*]\s+(.+)$/);
    if (item) {
      list.push(item[1]);
      continue;
    }
    flushList();
    if (!line.trim()) {
      out.push("");
      continue;
    }
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      const n = h[1].length;
      out.push(`<h${n}>${inline(h[2])}</h${n}>`);
      continue;
    }
    out.push(`<p>${inline(line)}</p>`);
  }
  flushList();
  return out.join("");
}

export function MarkdownView({ source }: { source: string }) {
  return <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
