import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import {
  FLOU_MAX_PX,
  DESCRIPTION_VERRE,
  CarteVerre,
  styleVerre,
  MESURE_VERRE,
  CARTES_VERRE_MAX,
  PART_VISIBLE_VERRE_MAX,
} from "../../../src/briques/motion/habillage-commun/verre";
import { IDS_FONDS_VIVANTS } from "../../../src/briques/motion/habillage-commun/fonds";
import { CHARTE_AXION, TEINTES_INTERDITES, couleursSur, type FondAxion } from "../../../src/briques/jetons-motion";
import { rapportContraste } from "../../../src/briques/habillage/contraste";

const FONDS: FondAxion[] = ["ivoire", "noir"];
const SRC = join(__dirname, "../../../src/briques/motion/habillage-commun/verre.tsx");
const source = () => readFileSync(SRC, "utf8");
const rvb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const melange = (base: string, c: string, a: number) =>
  "#" + rvb(base).map((v, i) => Math.round(v * (1 - a) + rvb(c)[i] * a).toString(16).padStart(2, "0")).join("");

describe("carte en verre dépoli (X1-04)", () => {
  it("flou ≤ 16 px sur les deux fonds", () => {
    expect(FLOU_MAX_PX).toBeLessThanOrEqual(16);
    for (const f of FONDS) {
      expect(DESCRIPTION_VERRE[f].flouPx).toBeGreaterThan(0);
      expect(DESCRIPTION_VERRE[f].flouPx).toBeLessThanOrEqual(16);
      expect(String(styleVerre(f).backdropFilter)).toMatch(/blur\((\d+(\.\d+)?)px\)/);
    }
    // un flou demandé trop grand est ramené à 16 px
    expect(String(styleVerre("ivoire", 40).backdropFilter)).toBe("blur(16px)");
  });

  it("contraste texte/voile ≥ 4,5 (voile pur et pire cas sur le fond opposé)", () => {
    for (const f of FONDS) {
      const { texte } = couleursSur(f);
      const d = DESCRIPTION_VERRE[f];
      expect(rapportContraste(texte, d.voileHex)).toBeGreaterThanOrEqual(4.5);
      const oppose = f === "ivoire" ? CHARTE_AXION.noir : CHARTE_AXION.ivoire;
      expect(rapportContraste(texte, melange(oppose, d.voileHex, d.opacite))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("voile ivoire sur fond ivoire, noir sur fond noir ; rendu pur et déterministe", () => {
    expect(DESCRIPTION_VERRE.ivoire.voileHex).toBe(CHARTE_AXION.ivoire);
    expect(DESCRIPTION_VERRE.noir.voileHex).toBe(CHARTE_AXION.noir);
    const a = renderToStaticMarkup(<CarteVerre fond="noir">Bonjour</CarteVerre>);
    expect(a).toBe(renderToStaticMarkup(<CarteVerre fond="noir">Bonjour</CarteVerre>));
    expect(a).toContain("backdrop-filter:blur(");
    expect(a).toContain("Bonjour");
  });

  it("aucune couleur hors charte, aucune teinte interdite", () => {
    const autorisees = new Set(Object.values(CHARTE_AXION).map((h) => h.toLowerCase()));
    const s = source();
    for (const h of s.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []) expect(autorisees.has(h.toLowerCase())).toBe(true);
    for (const t of TEINTES_INTERDITES) expect(s.toLowerCase()).not.toContain(t);
    expect(s).not.toMatch(/\b(?:rgb|hsl)a?\(/i);
    expect(s).not.toMatch(/gradient/i);
    const html = renderToStaticMarkup(<CarteVerre fond="ivoire">x</CarteVerre>);
    expect(html).not.toMatch(/gradient/i);
  });

  it("jamais pour la v4 : aucun import depuis motion-v4, ni alias @/, ni hasard ni horloge", () => {
    const s = source();
    expect(s).not.toMatch(/motion-v4/);
    expect(s).not.toMatch(/from\s+["']@\//);
    expect(s).not.toMatch(/Math\.random|Date\.now|new Date|performance\.now/);
    expect(s).not.toMatch(/cubic-bezier/);
  });

  it("éteint : drapeau attendMesure, absent de IDS_FONDS_VIVANTS et de choix.ts, importé par personne", () => {
    for (const f of FONDS) expect(DESCRIPTION_VERRE[f].attendMesure).toBe(true);
    expect((IDS_FONDS_VIVANTS as readonly string[]).join()).not.toMatch(/verre/);
    const dir = join(__dirname, "../../../src/briques/motion/habillage-commun");
    expect(readFileSync(join(dir, "choix.ts"), "utf8")).not.toMatch(/verre/);
    expect(readFileSync(join(dir, "index.ts"), "utf8")).not.toMatch(/verre/);
    expect(readFileSync(join(dir, "fonds.tsx"), "utf8")).not.toMatch(/verre/);
    expect(readdirSync(dir)).toContain("verre.tsx");
  });
});

describe("carte en verre dépoli : réglage mesuré (CHIFFRAGE-VERRE-MESURE-2)", () => {
  it("flou 6 px sur les deux fonds, 1 carte au plus, visible 30 % de la durée au plus, mesure écrite", () => {
    for (const f of FONDS) expect(DESCRIPTION_VERRE[f].flouPx).toBe(6);
    expect(String(styleVerre("noir").backdropFilter)).toBe("blur(6px)");
    expect(CARTES_VERRE_MAX).toBe(1);
    expect(PART_VISIBLE_VERRE_MAX).toBe(0.3);
    expect(MESURE_VERRE).toContain("+78 %");
    expect(MESURE_VERRE).toContain("+6 %");
    expect(MESURE_VERRE).toContain("3 s sur 10");
  });
});
