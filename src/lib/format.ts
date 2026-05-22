export function formatDate(iso: string): string {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function nextApplicationNumber(existing: string[]): string {
  const year = new Date().getFullYear();
  const yearPrefix = `${year}-`;
  const used = existing
    .filter((n) => n.startsWith(yearPrefix))
    .map((n) => parseInt(n.slice(yearPrefix.length), 10))
    .filter((n) => !isNaN(n));
  const next = (used.length ? Math.max(...used) : 0) + 1;
  return `${year}-${String(next).padStart(4, "0")}`;
}
