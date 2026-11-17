/**
 * BOÎTE ARRONDIE MAISON autour des lignes de sous-titres (X1-02a). Géométrie pure : un seul chemin SVG fermé
 * qui épouse chaque ligne (largeurs différentes), coins arrondis. Écrit en maison (aucun paquet tiers).
 * AJOUT PUR, ÉTEINT : rien n'appelle ce module. Aucun import, aucun hasard, aucune date.
 */
export interface LigneBoite {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}
export interface OptionsBoite {
  rayon: number;
  marge: number;
}

type Pt = { x: number; y: number };

const r2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
const fmt = (n: number): string => String(r2(Object.is(r2(n), -0) ? 0 : n));
const ok = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);

/** Retire les points confondus puis les points alignés (sommets inutiles). */
function nettoyer(pts: Pt[]): Pt[] {
  let p = pts.filter((q, i) => {
    const s = pts[(i + 1) % pts.length];
    return !(Math.abs(q.x - s.x) < 1e-9 && Math.abs(q.y - s.y) < 1e-9);
  });
  p = p.filter((q, i) => {
    const a = p[(i + p.length - 1) % p.length];
    const b = p[(i + 1) % p.length];
    return Math.abs((q.x - a.x) * (b.y - q.y) - (q.y - a.y) * (b.x - q.x)) > 1e-9;
  });
  return p;
}

export function cheminBoiteArrondie(lignes: readonly LigneBoite[], options: OptionsBoite): string {
  if (!Array.isArray(lignes) || lignes.length === 0 || !options) return "";
  const { rayon, marge } = options;
  if (!ok(rayon) || !ok(marge) || rayon < 0 || marge < 0) return "";
  for (const l of lignes) {
    if (!l || !ok(l.x) || !ok(l.y) || !ok(l.largeur) || !ok(l.hauteur) || l.largeur <= 0 || l.hauteur <= 0) return "";
  }
  const n = lignes.length;
  // Frontières verticales : haut de la 1re, milieu des espaces entre lignes, bas de la dernière.
  const bords: number[] = [lignes[0].y - marge];
  for (let i = 0; i < n - 1; i++) {
    bords.push((lignes[i].y + lignes[i].hauteur + lignes[i + 1].y) / 2);
  }
  bords.push(lignes[n - 1].y + lignes[n - 1].hauteur + marge);
  if (bords.some((b, i) => i > 0 && b <= bords[i - 1])) return "";

  const pts: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const xd = lignes[i].x + lignes[i].largeur + marge;
    pts.push({ x: xd, y: bords[i] }, { x: xd, y: bords[i + 1] });
  }
  for (let i = n - 1; i >= 0; i--) {
    const xg = lignes[i].x - marge;
    pts.push({ x: xg, y: bords[i + 1] }, { x: xg, y: bords[i] });
  }
  const p = nettoyer(pts);
  if (p.length < 4) return "";

  const demiMin = Math.min(...lignes.map((l) => l.hauteur / 2));
  const m = p.length;
  const longueur = (a: Pt, b: Pt) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  const coins = p.map((v, i) => {
    const a = p[(i + m - 1) % m];
    const b = p[(i + 1) % m];
    const r = Math.min(rayon, demiMin, longueur(a, v) / 2, longueur(v, b) / 2);
    const ui = { x: Math.sign(v.x - a.x), y: Math.sign(v.y - a.y) };
    const uo = { x: Math.sign(b.x - v.x), y: Math.sign(b.y - v.y) };
    const sweep = ui.x * uo.y - ui.y * uo.x > 0 ? 1 : 0;
    return {
      v,
      r,
      sweep,
      debut: { x: v.x - ui.x * r, y: v.y - ui.y * r },
      fin: { x: v.x + uo.x * r, y: v.y + uo.y * r },
    };
  });
  const arc = (c: (typeof coins)[number]) =>
    c.r > 0 ? `A${fmt(c.r)} ${fmt(c.r)} 0 0 ${c.sweep} ${fmt(c.fin.x)} ${fmt(c.fin.y)}` : "";
  const parts = [`M${fmt(coins[0].fin.x)} ${fmt(coins[0].fin.y)}`];
  for (let i = 1; i < m; i++) {
    parts.push(`L${fmt(coins[i].debut.x)} ${fmt(coins[i].debut.y)}`);
    if (coins[i].r > 0) parts.push(arc(coins[i]));
  }
  parts.push(`L${fmt(coins[0].debut.x)} ${fmt(coins[0].debut.y)}`);
  if (coins[0].r > 0) parts.push(arc(coins[0]));
  parts.push("Z");
  return parts.join(" ");
}
