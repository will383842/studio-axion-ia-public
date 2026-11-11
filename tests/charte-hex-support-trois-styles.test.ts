import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// V7-06 : support.ts (textures canvas des trois styles du tableau) ne contient que les hex de la palette de marque,
// plus deux exceptions NOMMÉES : le gris technique du bruit et les teintes de bois laissées à la décision D1 (ouverte).
const PALETTE = new Set(["#FAF9F5", "#E8E6DC", "#141413", "#B23F16", "#D97757", "#B0AEA5"]);
const GRIS_TECHNIQUE = "#808080";
const BOIS_D1 = ["#2A1A10", "#5A3A24", "#6B4A30", "#24160D", "#3A2414", "#7A5436", "#8E6644"];
const FICHIER = "studio-rendu/compositions/tableau/trois-styles/support.ts";

function source(): string {
  return readFileSync(FICHIER, "utf8");
}

function hexTrouves(texte: string): string[] {
  const sansCommentaires = texte.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return (sansCommentaires.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []).map((h) => h.toUpperCase());
}

describe("V7-06 support.ts : palette de marque", () => {
  it("n'utilise que la palette, le gris technique du bruit et les bois de D1", () => {
    const permis = new Set([...PALETTE, GRIS_TECHNIQUE, ...BOIS_D1]);
    const hors = [...new Set(hexTrouves(source()).filter((h) => !permis.has(h)))];
    expect(hors).toEqual([]);
  });

  it("bruit() garde #808080 (texture technique)", () => {
    expect(source()).toMatch(/function bruit[\s\S]*?g\.fillStyle = "#808080"/);
  });

  it("le cadre bois et le rebord sont distincts de l'ardoise #141413", () => {
    const code = source();
    const bois = code.match(/function bois[\s\S]*?g\.fillStyle = gr;/)![0];
    expect(hexTrouves(bois)).not.toContain("#141413");
    const rebord = code.match(/const d = g\.createLinearGradient\(0, y, 0, y \+ 24 \* k\);[\s\S]*?g\.fillStyle = d;/)![0];
    expect(hexTrouves(rebord)).not.toContain("#141413");
  });

  it("le mur du paperboard n'est pas #B0AEA5 (réservé au noir)", () => {
    const code = source();
    const i = code.indexOf("Mur enduit sable");
    expect(code.slice(i, i + 200)).toMatch(/fillStyle = "#(E8E6DC|FAF9F5)"/i);
  });
});
