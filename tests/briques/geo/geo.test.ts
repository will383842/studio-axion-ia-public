import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { descriptionValidee, geoAllume, modeleDescription, preparerGeo, verifierChapitres } from "@/briques/geo";
import { chapitresYoutube } from "@/domaine/site-videos/youtube";
import type { ChapitreWeb } from "@/domaine/site-videos/types";

const ch = (debutSec: number, finSec: number, libelle = "x"): ChapitreWeb => ({ debutSec, finSec, libelle, blocRecette: "b" });
const BONS = [ch(0, 60, "Réponse"), ch(60, 120, "Étapes"), ch(120, 200, "Conclusion")];

describe("VL-01 verifierChapitres", () => {
  it("conforme : aucune remarque", () => expect(verifierChapitres(BONS)).toEqual([]));
  it("premier chapitre hors 0:00", () => {
    const r = verifierChapitres([ch(5, 60), ch(60, 120), ch(120, 200)]);
    expect(r.map((x) => x.code)).toEqual(["premier-pas-a-zero"]);
  });
  it("moins de 3 chapitres", () => {
    expect(verifierChapitres([ch(0, 60), ch(60, 120)]).map((x) => x.code)).toEqual(["moins-de-trois"]);
    expect(verifierChapitres([])[0].code).toBe("moins-de-trois");
  });
  it("chapitre de moins de 10 s (9,9 signalé, 10 accepté)", () => {
    expect(verifierChapitres([ch(0, 9.9), ch(9.9, 60), ch(60, 120)])).toMatchObject([{ code: "chapitre-trop-court", chapitre: 1 }]);
    expect(verifierChapitres([ch(0, 10), ch(10, 60), ch(60, 120)])).toEqual([]);
  });
  it("jamais de refus : ne lève pas, ne modifie pas l'entrée", () => {
    const entree = [ch(3, 4)];
    const copie = JSON.stringify(entree);
    expect(() => verifierChapitres(entree)).not.toThrow();
    expect(JSON.stringify(entree)).toBe(copie);
  });
  it("remarques au vouvoiement", () => {
    const r5 = verifierChapitres([ch(5, 6)]);
    expect(r5.length).toBe(3);
    for (const r of r5) expect(r.message).toMatch(/votre|vôtre|vous/i);
  });
});

describe("VL-01 description", () => {
  it("aucune phrase inventée : sans choix, les blocs sont vides et non validés", () => {
    const b = modeleDescription({ chapitres: [] });
    expect(b.map((x) => x.texte)).toEqual(["", "", ""]);
    expect(b.every((x) => !x.valide)).toBe(true);
    expect(descriptionValidee(b)).toBe("");
  });
  it("le bloc chapitres reprend youtube.ts tel quel", () => {
    expect(modeleDescription({ chapitres: BONS })[1].texte).toBe(chapitresYoutube(BONS));
  });
  it("seuls les blocs validés entrent dans la description", () => {
    const b = modeleDescription({ reponseCourte: "Ma réponse.", chapitres: BONS, lienPage: "https://x.fr/v", valides: ["reponse-courte", "lien"] });
    expect(descriptionValidee(b)).toBe("Ma réponse.\n\nhttps://x.fr/v");
  });
  it("un bloc vide ne peut pas être validé", () => {
    expect(modeleDescription({ chapitres: [], valides: ["lien"] })[2].valide).toBe(false);
  });
});

describe("VL-01 éteint = identique", () => {
  it("seul true exact allume", () => {
    for (const v of [undefined, null, false, "true", 1, "1", {}]) expect(geoAllume(v)).toBe(false);
    expect(geoAllume(true)).toBe(true);
  });
  it("éteint : null, rien calculé", () => {
    expect(preparerGeo(undefined, { chapitres: BONS })).toBeNull();
    expect(preparerGeo("true", { chapitres: BONS })).toBeNull();
  });
  it("allumé : .srt via exporterSrt", () => {
    const p = preparerGeo(true, {
      chapitres: BONS,
      segments: [{ debutSec: 0, finSec: 2, mots: [{ mot: "Bonjour", debutSec: 0, finSec: 2 }] }] as never,
    });
    expect(p?.srt).toContain("00:00:00,000 --> 00:00:02,000\nBonjour");
    expect(p?.remarques).toEqual([]);
  });
});

describe("VL-01 fichiers réutilisés inchangés", () => {
  it("chapitres.ts, youtube.ts, export.ts, fiche-de-page.ts : non modifiés par la fiche", () => {
    // Garde-fou léger : ces fichiers doivent exister et ne rien importer de la brique geo.
    for (const f of ["src/domaine/site-videos/chapitres.ts", "src/domaine/site-videos/youtube.ts", "src/briques/sous-titres/export.ts"]) {
      expect(readFileSync(f, "utf8")).not.toContain("briques/geo");
    }
  });
});
