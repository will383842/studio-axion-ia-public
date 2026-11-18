/**
 * T-EXT-04 · Contrôle de conformité d'une maquette de tableau de bord (PUR : aucun import, aucun accès disque).
 * Règles : bleu, jaune, dégradé, police, argent, marque, flou, réseau, porte de pilotage.
 */

export type NomsNeutres = {
  version: number;
  verifieLe: string;
  maquettes: Record<string, { produit: string; organisation: string }>;
  interdits: string[];
};

export type Defaut = { chemin: string; ligne: number; regle: string; extrait: string };
export type ResultatControle = { ok: boolean; defauts: Defaut[] };

/** Teinte (0-360) et saturation HSL (0-1) d'une couleur RVB (0-255). */
function teinteSaturation(r: number, g: number, b: number): { h: number; s: number } {
  const [R, G, B] = [r / 255, g / 255, b / 255];
  const max = Math.max(R, G, B);
  const min = Math.min(R, G, B);
  const d = max - min;
  if (d === 0) return { h: 0, s: 0 };
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s };
}

function hslVersRvb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] = hp < 1 ? [c, x, 0] : hp < 2 ? [x, c, 0] : hp < 3 ? [0, c, x] : hp < 4 ? [0, x, c] : hp < 5 ? [x, 0, c] : [c, 0, x];
  const m = l - c / 2;
  return [(r1 + m) * 255, (g1 + m) * 255, (b1 + m) * 255];
}

function famille(h: number, s: number): "bleu" | "jaune" | null {
  if (h >= 180 && h <= 260 && s > 0.12) return "bleu";
  if (h >= 45 && h <= 70 && s > 0.5) return "jaune";
  return null;
}

function hexVersRvb(hex: string): [number, number, number] | null {
  let v = hex.slice(1);
  if (v.length === 3 || v.length === 4) v = v.split("").map((c) => c + c).join("");
  if (v.length !== 6 && v.length !== 8) return null;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}

function nombres(args: string): { v: number; pct: boolean }[] {
  return (args.match(/-?\d*\.?\d+(?:e-?\d+)?%?/gi) ?? []).map((t) => ({ v: parseFloat(t), pct: t.endsWith("%") }));
}

const NOMS_BLEUS = /\b(?:blue|navy|skyblue|lightblue|darkblue|royalblue|midnightblue|steelblue|cornflowerblue|dodgerblue|deepskyblue|powderblue|cadetblue|aliceblue|mediumblue|slateblue|lightskyblue|lightsteelblue|cyan|aqua|azure|indigo)\b/i;
const NOMS_JAUNES = /\b(?:yellow|gold|lightyellow|lemonchiffon|khaki|goldenrod)\b/i;

const NOM_POLICES_PERMISES = new Set(["manrope", "sans-serif", "monospace", "ui-monospace", "inherit"]);

function normaliser(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function ligneDe(contenu: string, index: number): number {
  let n = 1;
  for (let i = 0; i < index && i < contenu.length; i++) if (contenu.charCodeAt(i) === 10) n++;
  return n;
}

function extraitDe(contenu: string, ligne: number): string {
  return (contenu.split("\n")[ligne - 1] ?? "").trim().slice(0, 120);
}

export function controlerMaquette(fichiers: { chemin: string; contenu: string }[], noms: NomsNeutres, maquette: string): ResultatControle {
  const defauts: Defaut[] = [];
  const ajouter = (chemin: string, contenu: string, index: number, regle: string) => {
    const ligne = ligneDe(contenu, index);
    defauts.push({ chemin, ligne, regle, extrait: extraitDe(contenu, ligne) });
  };

  for (const { chemin, contenu } of fichiers) {
    // Couleurs : bleu / jaune.
    for (const m of contenu.matchAll(/(?<![\w&])#[0-9a-fA-F]{3,8}(?![\w])/g)) {
      const rvb = hexVersRvb(m[0]);
      if (!rvb) continue;
      const f = famille(...(Object.values(teinteSaturation(...rvb)) as [number, number]));
      if (f) ajouter(chemin, contenu, m.index ?? 0, f);
    }
    for (const m of contenu.matchAll(/\b(rgba?|hsla?)\(([^)]*)\)/gi)) {
      const n = nombres(m[2]);
      if (n.length < 3) continue;
      let rvb: [number, number, number];
      if (m[1].toLowerCase().startsWith("rgb")) {
        rvb = [n[0], n[1], n[2]].map((x) => (x.pct ? (x.v / 100) * 255 : x.v)) as [number, number, number];
      } else {
        rvb = hslVersRvb(n[0].v, n[1].v / 100, n[2].v / 100);
      }
      const { h, s } = teinteSaturation(...rvb);
      const f = famille(h, s);
      if (f) ajouter(chemin, contenu, m.index ?? 0, f);
    }
    for (const m of contenu.matchAll(new RegExp(NOMS_BLEUS.source, "gi"))) ajouter(chemin, contenu, m.index ?? 0, "bleu");
    for (const m of contenu.matchAll(new RegExp(NOMS_JAUNES.source, "gi"))) ajouter(chemin, contenu, m.index ?? 0, "jaune");

    // Dégradés.
    for (const m of contenu.matchAll(/\b(?:linear|radial|conic)-gradient\b/gi)) ajouter(chemin, contenu, m.index ?? 0, "degrade");

    // Police.
    for (const m of contenu.matchAll(/font-family\s*:\s*([^;}\n]*)/gi)) {
      const familles = m[1].split(",").map((x) => x.trim().replace(/^['"]|['"]$/g, "").toLowerCase()).filter(Boolean);
      if (familles.length === 0 || !familles.every((x) => NOM_POLICES_PERMISES.has(x)) || (familles[0] !== "manrope" && familles[0] !== "inherit")) {
        ajouter(chemin, contenu, m.index ?? 0, "police");
      }
    }

    // Argent.
    for (const m of contenu.matchAll(/€|\bEUR\b|\beuros?\b|style\s*:\s*['"]currency['"]|['"]currency['"]|\d\s*(?:HT|TTC)\b/gi)) {
      ajouter(chemin, contenu, m.index ?? 0, "argent");
    }

    // Marque : on remplace les noms, on ne les floute pas.
    const norm = normaliser(contenu);
    for (const interdit of noms.interdits) {
      const mot = normaliser(interdit);
      if (!mot) continue;
      let depuis = 0;
      for (;;) {
        const i = norm.indexOf(mot, depuis);
        if (i < 0) break;
        ajouter(chemin, contenu, i, "marque");
        depuis = i + mot.length;
      }
    }

    // Flou.
    for (const m of contenu.matchAll(/filter\s*:[^;}"\n]*blur\s*\(/gi)) ajouter(chemin, contenu, m.index ?? 0, "flou");

    // Réseau.
    for (const m of contenu.matchAll(/(?:\b(?:src|href)\s*=\s*["']?|url\(\s*["']?|@import\s+(?:url\(\s*)?["']?)(?:https?:)?\/\//gi)) {
      ajouter(chemin, contenu, m.index ?? 0, "reseau");
    }
  }

  // Nom neutre de la maquette.
  const nom = noms.maquettes[maquette];
  if (!nom) {
    defauts.push({ chemin: "", ligne: 0, regle: "marque", extrait: `maquette inconnue : ${maquette}` });
  } else {
    const attendu = normaliser(nom.produit);
    if (!fichiers.some((f) => normaliser(f.contenu).includes(attendu))) {
      defauts.push({ chemin: "", ligne: 0, regle: "marque", extrait: `nom neutre absent : ${nom.produit}` });
    }
  }

  // Porte de pilotage et mention de démonstration.
  const index = fichiers.find((f) => /(^|[\\/])index\.html$/.test(f.chemin));
  if (!index) {
    defauts.push({ chemin: "index.html", ligne: 0, regle: "pilotage", extrait: "index.html absent" });
  } else if (!/\bmention-demo\b/.test(index.contenu)) {
    defauts.push({ chemin: index.chemin, ligne: 0, regle: "pilotage", extrait: "classe mention-demo absente" });
  }
  const porte = fichiers.some((f) => /\bwindow\.demoMaquette\b|\bdemoMaquette\s*=/.test(f.contenu) && /\baller\b/.test(f.contenu) && /\breinitialiser\b/.test(f.contenu));
  if (!porte) {
    defauts.push({ chemin: index?.chemin ?? "index.html", ligne: 0, regle: "pilotage", extrait: "window.demoMaquette (aller, reinitialiser) absent" });
  }

  return { ok: defauts.length === 0, defauts };
}
