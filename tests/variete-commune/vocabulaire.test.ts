import { describe, it, expect } from "vitest";
import { OUVERTURES, STRUCTURES, JEUX_ANIMATION, TRANSITIONS, STYLES_CAMERA } from "@/moteurs/montage-cas-concret/variete";
import { AXES_VARIETE, VARIANTES_GARDEES, REFERENCES, RETIREES } from "@/briques/schema-motion/variete";
import { STYLES_TABLEAU } from "@/briques/tableau-scene/trois-styles/styles";
import { versCommun, VOCABULAIRE, TABLES_CORRESPONDANCE, NEUTRES } from "@/briques/variete-commune/vocabulaire";
import { AXE_COMMUN_DE } from "@/briques/variete-commune/correspondances/image-video";
import { AXES_COMMUNS, type AxeCommun } from "@/briques/variete-commune/types";

const cc = (axe: AxeCommun, codes: readonly string[]) => codes.map((c) => ["cas-concret", axe, c] as const);
const tousIV = AXES_VARIETE.flatMap((a) => {
  const l = [...VARIANTES_GARDEES[a], ...RETIREES[a], ...(REFERENCES[a] ? [REFERENCES[a]!] : [])] as string[];
  return [...new Set(l)].map((c) => ["image-video", AXE_COMMUN_DE[a], c] as const);
});
const cas = [
  ...cc("ouverture", OUVERTURES), ...cc("recit", STRUCTURES), ...cc("dosage", JEUX_ANIMATION),
  ...cc("transitions", TRANSITIONS), ...cc("camera", STYLES_CAMERA),
  ...STYLES_TABLEAU.map((c) => ["tableau", "habillage", c] as const),
  ...tousIV,
];

describe("X2-02 vocabulaire commun", () => {
  it("exhaustivité : chaque code importé a une entrée explicite", () => {
    expect(cas.length).toBeGreaterThan(60);
    for (const [g, axe, code] of cas) {
      expect(TABLES_CORRESPONDANCE[g][axe]?.[code], `${g}/${axe}/${code}`).toBeTypeOf("string");
    }
  });
  it("toute valeur produite est dans le vocabulaire ou commence par autre:", () => {
    for (const [g, axe, code] of cas) {
      const v = versCommun(g, axe, code);
      expect(v.startsWith("autre:") || (VOCABULAIRE[axe] ?? []).includes(v), `${g}/${code} → ${v}`).toBe(true);
    }
  });
  it("code inconnu → autre:<generateur>:<code> ; tables vides facecam-animee et cartes", () => {
    expect(versCommun("cartes", "ouverture", "x")).toBe("autre:cartes:x");
    expect(versCommun("cas-concret", "ouverture", "nouveau")).toBe("autre:cas-concret:nouveau");
  });
  it("croisé : chiffre-choc (cas concret) = ouverture OUV-A de l'image→vidéo (verdict-critique.json)", () => {
    expect(versCommun("cas-concret", "ouverture", "chiffre-choc")).toBe(versCommun("image-video", "ouverture", "OUV-A"));
    expect(versCommun("cas-concret", "ouverture", "question-plein-cadre")).toBe(versCommun("image-video", "ouverture", "OUV-D"));
  });
  it("vocabulaire : axes communs connus, valeurs sans doublon, neutres dans le vocabulaire", () => {
    for (const [axe, l] of Object.entries(VOCABULAIRE) as [AxeCommun, readonly string[]][]) {
      expect(AXES_COMMUNS).toContain(axe);
      expect(new Set(l).size).toBe(l.length);
    }
    expect(VOCABULAIRE.ouverture).toContain("chiffre-geant");
    expect(VOCABULAIRE.palette).toEqual(["ivoire-dominant", "noir-dominant", "terracotta-fort", "alterne"]);
    expect(VOCABULAIRE.dosage).toEqual(["aucun", "sobre", "equilibre", "dynamique"]);
    const toutes = Object.values(VOCABULAIRE).flat();
    for (const n of NEUTRES) expect(toutes).toContain(n);
  });
  it("neutres : une valeur de récit, de sous-titres ou de dosage visible n'est jamais neutre", () => {
    expect([...NEUTRES].sort()).toEqual(["aucun", "aucune", "coupe"]);
    for (const v of ["ordre-chronologique", "equilibres", "equilibre", ...(VOCABULAIRE.recit ?? []), ...(VOCABULAIRE.sousTitres ?? [])]) {
      expect(NEUTRES, v).not.toContain(v);
    }
  });
});
