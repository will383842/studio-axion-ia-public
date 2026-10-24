// Copie de `canonique` (src/visuels/services/rendu) : le domaine ne dépend pas des services.
export function canonique(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonique).join(",")}]`;
  if (v && typeof v === "object") return `{${Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${JSON.stringify(k)}:${canonique(x)}`).join(",")}}`;
  return JSON.stringify(v);
}
