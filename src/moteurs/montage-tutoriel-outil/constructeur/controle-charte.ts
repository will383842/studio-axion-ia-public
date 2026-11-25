/**
 * T-EXT-04 · Contrôle de conformité d'une maquette de tableau de bord (PUR : aucun import, aucun accès disque).
 * Règles : bleu, jaune, dégradé, police, argent, marque, flou, réseau, porte de pilotage.
 * PHRASE-3 : ce code vit sous `src/` (le Studio contrôle ainsi la maquette qu'il construit) ; `outils/maquettes-tableaux-de-bord/charte/controle.ts` le ré-exporte.
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

/** Couleurs nommées CSS (nom → hex) : chacune passe par `famille()`, comme une couleur écrite en hexadécimal. */
const COULEURS_NOMMEES: Record<string, string> = {
  aliceblue: "#f0f8ff",
  antiquewhite: "#faebd7",
  aqua: "#00ffff",
  aquamarine: "#7fffd4",
  azure: "#f0ffff",
  beige: "#f5f5dc",
  bisque: "#ffe4c4",
  black: "#000000",
  blanchedalmond: "#ffebcd",
  blue: "#0000ff",
  blueviolet: "#8a2be2",
  brown: "#a52a2a",
  burlywood: "#deb887",
  cadetblue: "#5f9ea0",
  chartreuse: "#7fff00",
  chocolate: "#d2691e",
  coral: "#ff7f50",
  cornflowerblue: "#6495ed",
  cornsilk: "#fff8dc",
  crimson: "#dc143c",
  cyan: "#00ffff",
  darkblue: "#00008b",
  darkcyan: "#008b8b",
  darkgoldenrod: "#b8860b",
  darkgray: "#a9a9a9",
  darkgreen: "#006400",
  darkgrey: "#a9a9a9",
  darkkhaki: "#bdb76b",
  darkmagenta: "#8b008b",
  darkolivegreen: "#556b2f",
  darkorange: "#ff8c00",
  darkorchid: "#9932cc",
  darkred: "#8b0000",
  darksalmon: "#e9967a",
  darkseagreen: "#8fbc8f",
  darkslateblue: "#483d8b",
  darkslategray: "#2f4f4f",
  darkslategrey: "#2f4f4f",
  darkturquoise: "#00ced1",
  darkviolet: "#9400d3",
  deeppink: "#ff1493",
  deepskyblue: "#00bfff",
  dimgray: "#696969",
  dimgrey: "#696969",
  dodgerblue: "#1e90ff",
  firebrick: "#b22222",
  floralwhite: "#fffaf0",
  forestgreen: "#228b22",
  fuchsia: "#ff00ff",
  gainsboro: "#dcdcdc",
  ghostwhite: "#f8f8ff",
  gold: "#ffd700",
  goldenrod: "#daa520",
  gray: "#808080",
  grey: "#808080",
  green: "#008000",
  greenyellow: "#adff2f",
  honeydew: "#f0fff0",
  hotpink: "#ff69b4",
  indianred: "#cd5c5c",
  indigo: "#4b0082",
  ivory: "#fffff0",
  khaki: "#f0e68c",
  lavender: "#e6e6fa",
  lavenderblush: "#fff0f5",
  lawngreen: "#7cfc00",
  lemonchiffon: "#fffacd",
  lightblue: "#add8e6",
  lightcoral: "#f08080",
  lightcyan: "#e0ffff",
  lightgoldenrodyellow: "#fafad2",
  lightgray: "#d3d3d3",
  lightgreen: "#90ee90",
  lightgrey: "#d3d3d3",
  lightpink: "#ffb6c1",
  lightsalmon: "#ffa07a",
  lightseagreen: "#20b2aa",
  lightskyblue: "#87cefa",
  lightslategray: "#778899",
  lightslategrey: "#778899",
  lightsteelblue: "#b0c4de",
  lightyellow: "#ffffe0",
  lime: "#00ff00",
  limegreen: "#32cd32",
  linen: "#faf0e6",
  magenta: "#ff00ff",
  maroon: "#800000",
  mediumaquamarine: "#66cdaa",
  mediumblue: "#0000cd",
  mediumorchid: "#ba55d3",
  mediumpurple: "#9370db",
  mediumseagreen: "#3cb371",
  mediumslateblue: "#7b68ee",
  mediumspringgreen: "#00fa9a",
  mediumturquoise: "#48d1cc",
  mediumvioletred: "#c71585",
  midnightblue: "#191970",
  mintcream: "#f5fffa",
  mistyrose: "#ffe4e1",
  moccasin: "#ffe4b5",
  navajowhite: "#ffdead",
  navy: "#000080",
  oldlace: "#fdf5e6",
  olive: "#808000",
  olivedrab: "#6b8e23",
  orange: "#ffa500",
  orangered: "#ff4500",
  orchid: "#da70d6",
  palegoldenrod: "#eee8aa",
  palegreen: "#98fb98",
  paleturquoise: "#afeeee",
  palevioletred: "#db7093",
  papayawhip: "#ffefd5",
  peachpuff: "#ffdab9",
  peru: "#cd853f",
  pink: "#ffc0cb",
  plum: "#dda0dd",
  powderblue: "#b0e0e6",
  purple: "#800080",
  rebeccapurple: "#663399",
  red: "#ff0000",
  rosybrown: "#bc8f8f",
  royalblue: "#4169e1",
  saddlebrown: "#8b4513",
  salmon: "#fa8072",
  sandybrown: "#f4a460",
  seagreen: "#2e8b57",
  seashell: "#fff5ee",
  sienna: "#a0522d",
  silver: "#c0c0c0",
  skyblue: "#87ceeb",
  slateblue: "#6a5acd",
  slategray: "#708090",
  slategrey: "#708090",
  snow: "#fffafa",
  springgreen: "#00ff7f",
  steelblue: "#4682b4",
  tan: "#d2b48c",
  teal: "#008080",
  thistle: "#d8bfd8",
  tomato: "#ff6347",
  turquoise: "#40e0d0",
  violet: "#ee82ee",
  wheat: "#f5deb3",
  white: "#ffffff",
  whitesmoke: "#f5f5f5",
  yellow: "#ffff00",
  yellowgreen: "#9acd32",
};
/** Jaunes ocre à teinte légèrement sous 45° : refusés par nom comme avant. */
const NOMS_JAUNES_FORCES = new Set(["goldenrod", "darkgoldenrod"]);
const NOMS_COULEURS = new RegExp(`(?<![\w-])(?:${Object.keys(COULEURS_NOMMEES).join("|")})(?![\w-])`, "gi");

const NOM_POLICES_PERMISES = new Set(["manrope", "sans-serif", "monospace", "ui-monospace", "inherit"]);

function famillesOk(familles: string[]): boolean {
  return familles.length > 0 && familles.every((x) => NOM_POLICES_PERMISES.has(x)) && (familles[0] === "manrope" || familles[0] === "inherit");
}

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
    for (const m of contenu.matchAll(NOMS_COULEURS)) {
      const nom = m[0].toLowerCase();
      const rvb = hexVersRvb(COULEURS_NOMMEES[nom]);
      if (!rvb) continue;
      const { h, s } = teinteSaturation(...rvb);
      const f = NOMS_JAUNES_FORCES.has(nom) ? "jaune" : famille(h, s);
      if (f) ajouter(chemin, contenu, m.index ?? 0, f);
    }

    // Dégradés.
    for (const m of contenu.matchAll(/\b(?:linear|radial|conic)-gradient\b/gi)) ajouter(chemin, contenu, m.index ?? 0, "degrade");

    // Police : `font-family`, raccourci `font`, JS `fontFamily`, `font.family`, `family:`.
    const policeRefusee = (valeur: string, JS: boolean): boolean => {
      let v = valeur.trim();
      if (!v || v.startsWith("{")) return false;
      if (JS && /^['"`]/.test(v)) v = v.slice(1).split(v[0])[0];
      return !famillesOk(v.split(",").map((x) => x.trim().replace(/^['"`]|['"`]$/g, "").toLowerCase()).filter(Boolean));
    };
    const motifsPolice: { re: RegExp; js: boolean; raccourci?: boolean }[] = [
      { re: /font-family\s*:\s*([^;}\n]*)/gi, js: false },
      { re: /\bfontFamily\s*[:=]\s*([^;}\n]*)/g, js: true },
      { re: /\bfont\s*\.\s*family\s*=\s*([^;\n]*)/g, js: true },
      { re: /(?<![-\w.])family\s*:\s*([^;}\n]*)/g, js: true },
      { re: /(?<![-\w])font\s*[:=]\s*([^;}\n]*)/gi, js: false, raccourci: true },
    ];
    for (const { re, js, raccourci } of motifsPolice) {
      for (const m of contenu.matchAll(re)) {
        let valeur = m[1];
        if (raccourci) {
          // Raccourci `font` : les familles suivent la taille ; sans taille (`inherit`, `var(...)`), rien à contrôler.
          const t = valeur.replace(/^\s*['"`]/, "").match(/\d*\.?\d+(?:px|pt|em|rem|ex|ch|vw|vh|vmin|vmax|%)(?:\/\S+)?\s+(.+)$/i);
          if (!t) continue;
          valeur = t[1];
        }
        if (policeRefusee(valeur, js)) ajouter(chemin, contenu, m.index ?? 0, "police");
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
      // Mot entier (limites de mot après normalisation) : « arrivage » ne contient pas « rivage ».
      // Un nom qui finit par un signe (« feuille. ») garde la recherche par sous-chaîne : « feuille » seul reste permis.
      const re = /[\p{L}\p{N}]$/u.test(mot)
        ? new RegExp(`(?<![\\p{L}\\p{N}])${mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}])`, "gu")
        : new RegExp(mot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
      for (const m of norm.matchAll(re)) ajouter(chemin, contenu, m.index ?? 0, "marque");
    }

    // Flou.
    for (const m of contenu.matchAll(/filter\s*[:=][^;}\n]*blur\s*\(|feGaussianBlur/gi)) ajouter(chemin, contenu, m.index ?? 0, "flou");

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
