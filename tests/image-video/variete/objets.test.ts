/**
 * Variété « Image → vidéo » · lot 4, axe OBJETS (OBJ-A..OBJ-D) : l'habillage de la carte e-mail et de l'alerte change,
 * jamais la géométrie (`planEmail`) ni le texte du tampon. OBJ-A = rendu d'avant le lot.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { codeDe, VARIANTES_GARDEES, type CodeVariante, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import { RECETTE_REFERENCE_IV } from "@/moteurs/montage-image-video/variete/tirage";
import { habillageObjet } from "../../../studio-rendu/compositions/image-video/variete/objets/habillage";
import { ContexteVariete } from "../../../studio-rendu/compositions/image-video/variete/ContexteVariete";
import { EmailStructure } from "../../../studio-rendu/compositions/image-video/EmailStructure";
import { planEmail } from "../../../studio-rendu/compositions/image-video/plan-objets";

const exiger = createRequire(join(process.cwd(), "studio-rendu/package.json"));
const { createElement } = exiger("react") as typeof import("react");
const { renderToStaticMarkup } = exiger("react-dom/server") as typeof import("react-dom/server");

const CODES = ["OBJ-A", "OBJ-B", "OBJ-C", "OBJ-D"] as const;

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const CHAMPS = [
  { nom: "Objet", valeur: "Commande en retard", t: 1 },
  { nom: "Contexte", t: 1.6 },
  { nom: "Demande", valeur: "Rappeler le client", t: 2.2 },
];
const TAMPON = [{ texte: "PRÊT", t: 3.4 }];

function html(code: CodeVariante<"objets"> | null, t: number): string {
  const email = createElement(EmailStructure, { champs: CHAMPS, debut: 0.5, t, fond: "ivoire", tampon: TAMPON });
  if (!code) return renderToStaticMarkup(email);
  const recette = { ...RECETTE_REFERENCE_IV, objets: code } as RecetteVarieteIV;
  return renderToStaticMarkup(createElement(ContexteVariete, { variete: { recette, format: "9:16" }, children: email }));
}

describe("variété · axe objets", () => {
  it("variantes gardées : OBJ-B, OBJ-C, OBJ-D ; sans recette, la référence est OBJ-A", () => {
    expect(VARIANTES_GARDEES.objets).toEqual(["OBJ-B", "OBJ-C", "OBJ-D"]);
    expect(codeDe(undefined, "objets")).toBe("OBJ-A");
  });

  it("planEmail identique pour les 4 codes (la géométrie ne dépend pas de l'habillage)", () => {
    const plans = CODES.map((c) => {
      habillageObjet(c, "ivoire");
      return JSON.stringify([0.4, 1.5, 2.5, 3.6, 5].map((t) => planEmail({ champs: CHAMPS, debut: 0.5, tampon: TAMPON }, t)));
    });
    expect(new Set(plans).size).toBe(1);
  });

  it("contraste texte sur fond ≥ 4,5:1 (en-tête et tampon pleins, 4 codes)", () => {
    for (const c of CODES) {
      const h = habillageObjet(c, "ivoire");
      expect(contraste(h.enTete.texte, h.enTete.fond), `${c} en-tête`).toBeGreaterThanOrEqual(4.5);
      if (c !== "OBJ-A") expect(contraste(h.tampon.texte, h.tampon.fond ?? "#FBF8F3"), `${c} tampon`).toBeGreaterThanOrEqual(4.5);
      expect(contraste(h.alerte.tamponTexte, h.alerte.fond), `${c} alerte`).toBeGreaterThanOrEqual(c === "OBJ-A" ? 2.5 : 4.5);
    }
  });

  it("le padding du tampon n'excède jamais celui d'aujourd'hui (10 × 22)", () => {
    for (const c of CODES) {
      const { tampon } = habillageObjet(c, "ivoire");
      expect(tampon.paddingV).toBeLessThanOrEqual(10);
      expect(tampon.paddingH).toBeLessThanOrEqual(22);
    }
  });

  it("rendu : OBJ-A = sans variété ; chaque autre code change l'habillage mais garde le texte du tampon", () => {
    const t = 4.2;
    const ref = html(null, t);
    expect(html("OBJ-A", t)).toBe(ref);
    expect(ref).toContain("PRÊT");
    for (const c of ["OBJ-B", "OBJ-C", "OBJ-D"] as const) {
      const h = html(c, t);
      expect(h, c).not.toBe(ref);
      expect(h, c).toContain("PRÊT");
    }
    expect(html("OBJ-C", t)).toContain("rotate(-8deg)");
    expect(html("OBJ-D", t)).toContain("border-radius:16px");
  });

  it("aucun mot interdit dans les nouveaux fichiers", () => {
    const interdits = [["mach", "ine"], ["Aucun gain ", "garanti"], ["Greno", "ble"]].map((p) => new RegExp(p.join(""), "i"));
    for (const f of ["studio-rendu/compositions/image-video/variete/objets/habillage.ts", "tests/image-video/variete/objets.test.ts"]) {
      const s = readFileSync(join(process.cwd(), f), "utf8");
      for (const re of interdits) expect(re.test(s), `${f} ${re}`).toBe(false);
    }
  });
});
