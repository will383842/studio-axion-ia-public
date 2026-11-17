import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PlageExtrait } from "@/domaine/archive-extraits";
import { contexteDeNote, momentsParles, motsDuTexte } from "@/briques/archive-extraits/moments-parles";
import { noter } from "@/briques/note-extraits/noter";
import type { Moment } from "@/briques/note-extraits/types";

const plage = (p: Partial<PlageExtrait> & { id: string }): PlageExtrait => ({
  debutSec: 0, finSec: 10, texte: "texte", motsCles: [], avecVisage: false, texteIncruste: false, etat: "utilisable", ...p,
});
const fiche = {
  ratio: "9:16" as const,
  plages: [
    plage({ id: "a", debutSec: 1, finSec: 9, texte: "premier", avecVisage: true }),
    plage({ id: "b", etat: "exclue" }),
    plage({ id: "c", etat: "a_verifier", texte: "troisième", texteIncruste: true }),
    plage({ id: "d", origine: "scene" }),
  ],
};
const video = { titre: "Une vidéo", typeAutomatisation: undefined, couvertureVignette: undefined };

describe("X4-10c moments parlés", () => {
  it("convertit les plages utilisables en moments parole", () => {
    const m = momentsParles(fiche);
    expect(m.map((x) => x.id)).toEqual(["a", "c"]);
    expect(m[0]).toMatchObject({ origine: "parole", montre: "visage", ratio: "9:16", debutSec: 1, finSec: 9, texte: "premier", avecVisage: true });
    expect(m[1]).toMatchObject({ montre: "texte", texteIncruste: true });
  });

  it("sujet : vidéo, déduit, appels d'offres, rien", () => {
    const m = (texte: string): Moment => ({ id: "x", origine: "parole", debutSec: 0, finSec: 5, montre: "texte", texte, avecVisage: false, texteIncruste: false });
    expect(contexteDeNote({ video: { ...video, typeAutomatisation: "recrutement" } })(m("bla")).sujet).toBe("recrutement");
    expect(contexteDeNote({ video: { ...video, titre: "Relancer les impayés" } })(m("on relance")).sujet).toBe("relances-impayes");
    expect(contexteDeNote({ video })(m("réponse à l'appel d'offres")).sujet).toBe("appels-offres");
    expect(contexteDeNote({ video: { ...video, titre: "" } })(m("")).sujet).toBeNull();
  });

  it("motCle absent ou vide : pas de champ ; présent : passé", () => {
    const m = momentsParles(fiche)[0];
    expect("motCle" in contexteDeNote({ video })(m)).toBe(false);
    expect("motCle" in contexteDeNote({ video: { ...video, couvertureVignette: { texte: "t", motCle: "", fixee: false } } })(m)).toBe(false);
    expect(contexteDeNote({ video: { ...video, couvertureVignette: { texte: "t", motCle: "devis", fixee: false } } })(m).motCle).toBe("devis");
    const c = contexteDeNote({ video })(m);
    expect("etat" in c || "sourcePropre" in c).toBe(false);
  });

  it("motsDuTexte : autant de mots, temps croissants et bornés", () => {
    const mots = motsDuTexte("un deux  trois quatre", 2, 6);
    expect(mots.map((x) => x.texte)).toEqual(["un", "deux", "trois", "quatre"]);
    expect(mots[0].debutMs).toBe(2000);
    expect(mots[3].finMs).toBe(6000);
    mots.forEach((x, i) => {
      expect(Number.isInteger(x.debutMs) && Number.isInteger(x.finMs)).toBe(true);
      expect(x.finMs).toBeGreaterThanOrEqual(x.debutMs);
      if (i) expect(x.debutMs).toBeGreaterThanOrEqual(mots[i - 1].finMs);
    });
    expect(motsDuTexte("", 0, 5)).toEqual([]);
    expect(motsDuTexte("   ", 0, 5)).toEqual([]);
  });

  it("avec noter : phrase d'introduction avec visage et texte incrusté → note < 40", () => {
    const [m] = momentsParles({ ratio: "9:16", plages: [plage({ id: "i", texte: "Bonjour, aujourd'hui je vais vous parler de", avecVisage: true, texteIncruste: true })] });
    const ctx = contexteDeNote({ video })(m);
    expect(ctx.mots?.length).toBe(7);
    expect(noter(m, ctx).note).toBeLessThan(40);
  });

  it("déterministe et sans modifier l'entrée gelée", () => {
    const f = Object.freeze({ ratio: fiche.ratio, plages: Object.freeze(fiche.plages.map((p) => Object.freeze({ ...p }))) as PlageExtrait[] });
    expect(momentsParles(f)).toEqual(momentsParles(f));
    expect(() => contexteDeNote({ video: Object.freeze({ ...video }) })(momentsParles(f)[0])).not.toThrow();
  });

  it("garde statique : aucun import interdit", () => {
    const src = readFileSync("src/briques/archive-extraits/moments-parles.ts", "utf8");
    for (const interdit of ["@/services", "depots", "reglages", "server-only"]) expect(src).not.toContain(interdit);
  });
});
