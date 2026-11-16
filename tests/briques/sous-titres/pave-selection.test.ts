/** C2-U7a : mot-clé en pavé (sélection, dessin CSS, mesure). Phrases écrites ici, aucune voix. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { empreinteTexte } from "../../../studio-rendu/src/composition/texte-instants";
import { donneesCalque } from "@/briques/sous-titres";
import { PAVE, motsAPlaque } from "@/briques/sous-titres/pave";
import { cssElement, elementDe, largeurElement, sceneAuTemps } from "@/briques/sous-titres/scene";
import type { MotRendu, SegmentRendu } from "@/briques/sous-titres/types-rendu";
import { STYLE_SOUS_TITRES_AVOCAT } from "@/donnees/elements-avocat";
import type { ValeurStyleSousTitres } from "@/domaine/types";

const mots = (texte: string): MotRendu[] => texte.split(" ").map((mot, i) => ({ mot, debutSec: +(1 + i * 0.4).toFixed(3), finSec: +(1.3 + i * 0.4).toFixed(3) }));
const groupe = (texte: string, souligne: number | null = null, id = "g1"): SegmentRendu => {
  const ms = mots(texte);
  return { id, debutSec: ms[0].debutSec, finSec: ms.at(-1)!.finSec + 0.1, mots: ms, souligne, style: "base", position: "auto", importance: 1 };
};
const style = (pave?: "forts" | "chiffres" | "forts-et-chiffres"): ValeurStyleSousTitres => ({ ...STYLE_SOUS_TITRES_AVOCAT, ...(pave ? { texteEcran: { pave: { mots: pave } } } : {}) });
const calque = (segments: SegmentRendu[], pave?: "forts" | "chiffres" | "forts-et-chiffres") => donneesCalque({ segments, base: "karaoke", style: style(pave) });

describe("C2-U7a : sélection des mots à plaque", () => {
  it("au plus un mot par groupe, jamais le mot souligné", () => {
    const g = groupe("jamais 3 mails jamais toujours 12");
    const r = motsAPlaque(g, "chiffres");
    expect(r).toHaveLength(1);
    expect(g.mots[r[0]].mot).toBe("3");
    const g2 = groupe("jamais 3 mails 12", 1);
    expect(g2.mots[motsAPlaque(g2, "chiffres")[0]].mot).toBe("12");
    expect(motsAPlaque(groupe("des mails ici"), "chiffres")).toEqual([]);
    expect(motsAPlaque(groupe("3", 0), "chiffres")).toEqual([]);
  });
  it("forts et chiffres", () => {
    expect(motsAPlaque(groupe("des 3 mails jamais"), "forts")).toEqual([3]);
    expect(motsAPlaque(groupe("des 3 mails jamais"), "forts-et-chiffres")).toHaveLength(1);
  });
});

describe("C2-U7a : éteint = identique", () => {
  it("sans pave : aucune clé, empreinte et scène sans plaque", () => {
    const d = calque([groupe("jamais 3 mails")]);
    expect("plaques" in d).toBe(false);
    expect(JSON.stringify(d)).not.toContain("plaques");
    const el = sceneAuTemps(d, 1.9)!;
    expect(el.mots.some((m) => m.plaque)).toBe(false);
    expect(empreinteTexte({ sousTitres: d, encadre: null, incrustations: [] } as never, 1.9)).not.toContain("true");
  });
  it("pave sur un style sans mot candidat : aucun mot à plaque", () => {
    const d = calque([groupe("des mails ici")], "chiffres");
    expect(sceneAuTemps(d, 1.9)!.mots.some((m) => m.plaque)).toBe(false);
  });
});

describe("C2-U7a : avec pavé", () => {
  const d = calque([groupe("jamais 3 mails 12", null, "a")], "chiffres");
  it("plaques : id du segment → indice du mot", () => {
    expect(d.plaques).toEqual({ a: 1 });
  });
  it("le mot à plaque est marqué, CSS fond et marge, largeur mesurée plus grande", () => {
    const sans = calque([groupe("jamais 3 mails 12", null, "a")]);
    const el = sceneAuTemps(d, 2.5)!;
    expect(el.mots.filter((m) => m.plaque)).toHaveLength(1);
    expect(el.mots[1].plaque).toBe(true);
    const css = cssElement(el, d, "X").mot(1);
    expect(css.background).toBeTruthy();
    expect(css.padding).toBeTruthy();
    expect(cssElement(el, d, "X").mot(0).background).toBeUndefined();
    const elSans = sceneAuTemps(sans, 2.5)!;
    expect(largeurElement(el) - largeurElement({ ...elSans, taillePx: el.taillePx })).toBeCloseTo(2 * PAVE.margeXEm * el.taillePx, 5);
  });
  it("empreinte change avec la plaque", () => {
    const sans = calque([groupe("jamais 3 mails 12", null, "a")]);
    const e = (x: typeof d) => empreinteTexte({ sousTitres: x, encadre: null, incrustations: [] } as never, 2.5);
    expect(e(d)).not.toBe(e(sans));
  });
  it("jamais sur le mot surligné", () => {
    const x = calque([groupe("jamais 3 mails", 1, "b")], "chiffres");
    expect(x.plaques).toEqual({});
  });
});

describe("C2-U7a : pas d'import @/ ; le tableau blocs/2 n'importe pas le pavé", () => {
  it("pave.ts, scene.ts, mesure.ts sans @/", () => {
    for (const f of ["pave", "scene", "mesure"]) expect(readFileSync(`src/briques/sous-titres/${f}.ts`, "utf8")).not.toMatch(/from "@\//);
  });
  it("tableau-scene/v2/sous-titres.ts ne touche pas au pavé", () => {
    expect(readFileSync("src/briques/tableau-scene/v2/sous-titres.ts", "utf8")).not.toMatch(/pave|plaque/i);
  });
});
