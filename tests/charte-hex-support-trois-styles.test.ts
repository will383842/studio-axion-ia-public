import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V7-06 : support.ts (textures canvas des trois styles du tableau). Le test lit les hex (#RRGGBB) SEULEMENT ;
// les rgba(...) ne sont pas vérifiés ici (26 hors palette restent, comptés au cliquet de tests/charte).
// Exceptions NOMMÉES : gris technique du bruit, bois (D1 ouverte) et matières aluminium / pince / feutres-marqueurs (D1 ouverte).
const PALETTE = new Set(["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5"]);
const GRIS_TECHNIQUE = "#808080";
// Bois du cadre (bois()), du rebord ardoise, du chevalet et du rebord du paperboard : teintes d'origine.
const BOIS_CADRE = ["#2A1A10", "#5A3A24", "#6B4A30", "#24160D"];
const BOIS_REBORD_ARDOISE = ["#3A2414", "#7A5436", "#8E6644"];
const BOIS_CHEVALET = ["#4A3020", "#8A6040", "#3A2414"];
const BOIS_REBORD_PAPERBOARD = ["#6A4A30", "#A07850"];
const BOIS_D1 = [...BOIS_CADRE, ...BOIS_REBORD_ARDOISE, ...BOIS_CHEVALET, ...BOIS_REBORD_PAPERBOARD];
const MATIERES_D1 = [
  // aluminium
  "#77716B", "#D8D4CF", "#F2F0ED", "#BBB6B0", "#8F8983", "#5E5852", "#6A645E", "#CFCAC4", "#EEEBE7", "#A9A39D", "#3A322C",
  // pince
  "#4A3A2E", "#2A1F17", "#1A120C", "#0E0905", "#D8CBB8", "#8C7C6A", "#3A2E24",
  // feutres et marqueurs
  "#B44F29", "#ECE8E3", "#110A05", "#4A3C31", "#140D08", "#BFA88B", "#1E1610", "#D9C6A6",
  // auget aluminium du tableau blanc
  "#9E9891", "#D9D5D0", "#EFECE8", "#D2CDC7", "#A19A93", "#5E5852",
];
const FICHIER = "studio-rendu/compositions/tableau/trois-styles/support.ts";

function source(): string {
  return readFileSync(FICHIER, "utf8");
}

function hexTrouves(texte: string): string[] {
  const sansCommentaires = texte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return (sansCommentaires.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).map((h) => h.toUpperCase());
}

function arrets(bloc: string): string[] {
  return [...bloc.matchAll(/addColorStop\([^,]+,\s*"(#[0-9A-Fa-f]{6})"\)/g)].map((m) => m[1].toUpperCase());
}

describe("V7-06 support.ts : palette de marque (hex seulement, rgba au cliquet)", () => {
  it("n'utilise que la palette, le gris technique du bruit, les bois et les matières de D1", () => {
    const permis = new Set([...PALETTE, GRIS_TECHNIQUE, ...BOIS_D1, ...MATIERES_D1]);
    const hors = [...new Set(hexTrouves(source()).filter((h) => !permis.has(h)))];
    expect(hors).toEqual([]);
  });

  it("bruit() garde #808080 (texture technique) et n'utilise pas #B0AEA5", () => {
    const corps = source().match(/function bruit[\s\S]*?\n}\n/)![0];
    expect(hexTrouves(corps)).toContain("#808080");
    expect(hexTrouves(corps)).not.toContain("#B0AEA5");
  });

  it("le cadre bois et les rebords gardent EXACTEMENT les arrêts d'origine (D1 ouverte)", () => {
    const code = source();
    const bois = code.match(/function bois[\s\S]*?g\.fillStyle = gr;/)![0];
    expect(arrets(bois)).toEqual(BOIS_CADRE);
    const rebord = code.match(/const d = g\.createLinearGradient\(0, y, 0, y \+ 24 \* k\);[\s\S]*?g\.fillStyle = d;/)![0];
    expect(arrets(rebord)).toEqual(BOIS_REBORD_ARDOISE);
    const chevalet = code.match(/Math\.max\(x0, x1\) \+ 22 \* k, 0\);[\s\S]*?g\.fillStyle = gr;/)![0];
    expect(arrets(chevalet)).toEqual(BOIS_CHEVALET);
    const paper = code.match(/const d = g\.createLinearGradient\(0, y, 0, y \+ 22 \* k\);[\s\S]*?g\.fillStyle = d;/)![0];
    expect(arrets(paper)).toEqual(BOIS_REBORD_PAPERBOARD);
  });

  it("le mur du paperboard n'est pas #B0AEA5 (réservé au noir)", () => {
    const code = source();
    const i = code.indexOf("Mur enduit sable");
    expect(code.slice(i, i + 200)).toMatch(/fillStyle = "#(E8E6DC|FAF9F5)"/i);
  });

  it("le mur sous le tableau blanc est un aplat #E8E6DC, sans #B0AEA5", () => {
    const code = source();
    const i = code.indexOf("Le mur sous le tableau");
    const bloc = code.slice(i, i + 250);
    expect(bloc).toMatch(/fillStyle = "#E8E6DC"/i);
    expect(hexTrouves(bloc)).not.toContain("#B0AEA5");
  });

  it("l'auget aluminium du tableau blanc garde EXACTEMENT les six arrêts de master (D1 ouverte)", () => {
    const code = source();
    const dd = code.match(/const dd = g\.createLinearGradient[\s\S]*?g\.fillStyle = dd;/)![0];
    expect(arrets(dd)).toEqual(["#9E9891", "#D9D5D0", "#EFECE8"]);
    const f = code.match(/const f = g\.createLinearGradient[\s\S]*?g\.fillStyle = f;/)![0];
    expect(arrets(f)).toEqual(["#D2CDC7", "#A19A93", "#5E5852"]);
  });

  it("aucun #B0AEA5 dans la branche tableau-blanc ni dans la branche paperboard", () => {
    const code = source();
    const a = code.indexOf('if (style === "tableau-blanc")');
    const b = code.indexOf('} else if (style === "ardoise")');
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(hexTrouves(code.slice(a, b))).not.toContain("#B0AEA5");
    const c = code.indexOf("} else {", b);
    expect(c).toBeGreaterThan(b);
    expect(hexTrouves(code.slice(c))).not.toContain("#B0AEA5");
  });
});
