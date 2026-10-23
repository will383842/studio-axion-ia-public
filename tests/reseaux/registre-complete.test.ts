/**
 * Registre des réseaux complété (plan « formats par réseau », tâche T1) : zones complémentaires, emplacements, règle
 * de fin. Ajout seul : les valeurs d'avant sont figées par `instantane-tables-formats.test.ts`.
 */
import { describe, expect, it } from "vitest";
import { FORMATS_SORTIE } from "@/moteurs/montage-tableau/formats-sortie";
import { RESEAUX, obtenirReseau } from "@/reseaux";

describe("registre complété · zones complémentaires", () => {
  it("Facebook 4:5 et carré (valeur prudente du tableau), LinkedIn 16:9 (comme YouTube)", () => {
    expect(obtenirReseau("facebook").zonesComplementaires).toEqual({
      "4:5": { haut: 5, droite: 5, bas: 12, gauche: 5 },
      "1:1": { haut: 5, droite: 5, bas: 12, gauche: 5 },
    });
    expect(obtenirReseau("linkedin").zonesComplementaires).toEqual({ "16:9": { haut: 6, droite: 4, bas: 12, gauche: 4 } });
  });

  it("ne double jamais une zone déjà connue, et seulement sur un format accepté par le réseau", () => {
    for (const r of RESEAUX) {
      for (const ratio of Object.keys(r.zonesComplementaires ?? {})) {
        expect(r.zonesProtegees, `${r.id} ${ratio}`).not.toHaveProperty(ratio);
        expect(r.ratios).toContain(ratio);
      }
    }
  });
});

describe("registre complété · emplacements", () => {
  it("chaque emplacement est sur un format accepté par le réseau, sans doublon (emplacement, format)", () => {
    for (const r of RESEAUX) {
      expect(r.emplacements.length, r.id).toBeGreaterThan(0);
      const cles = r.emplacements.map((e) => `${e.id}·${e.ratio}`);
      expect(new Set(cles).size, r.id).toBe(cles.length);
      for (const e of r.emplacements) {
        expect(r.ratios, `${r.id} ${e.id}`).toContain(e.ratio);
        expect(e.libelle.length).toBeGreaterThan(2);
        expect(e.source.length).toBeGreaterThan(2);
      }
    }
  });

  it("les emplacements d'Instagram et de Facebook : Reels, stories, fil", () => {
    const resume = (id: "instagram" | "facebook") => obtenirReseau(id).emplacements.map((e) => [e.id, e.ratio, e.libelle]);
    expect(resume("instagram")).toEqual([
      ["reels", "9:16", "Reels Instagram"],
      ["stories", "9:16", "Stories Instagram et Facebook"],
      ["fil", "4:5", "Fil Instagram"],
    ]);
    expect(resume("facebook")).toEqual([
      ["reels", "9:16", "Reels Facebook"],
      ["stories", "9:16", "Stories Instagram et Facebook"],
      ["fil", "4:5", "Fil Facebook"],
      ["fil", "1:1", "Fil Facebook"],
    ]);
  });

  it("chaque « réseau servi » de la table du tableau a un emplacement de même libellé, même format, même zone", () => {
    const emplacements = RESEAUX.flatMap((r) => r.emplacements);
    for (const f of Object.values(FORMATS_SORTIE)) {
      for (const servi of f.reseaux) {
        const e = emplacements.find((x) => x.libelle === servi.libelle && x.ratio === f.ratio);
        expect(e, `${servi.libelle} en ${f.ratio}`).toBeDefined();
        expect(e!.zone).toEqual(servi.zone);
      }
    }
  });

  it("la zone d'un emplacement n'est jamais moins stricte que la zone protégée du registre pour ce format", () => {
    for (const r of RESEAUX) {
      for (const e of r.emplacements) {
        const z = r.zonesProtegees[e.ratio];
        if (!z || e.id === "stories") continue; // les stories ont leur propre interface (pas de légende de Reel)
        expect(e.zone.haut, `${r.id} ${e.id}`).toBeGreaterThanOrEqual(z.haut);
        expect(e.zone.bas).toBeGreaterThanOrEqual(z.bas);
        expect(e.zone.gauche).toBeGreaterThanOrEqual(z.gauche);
        expect(e.zone.droite).toBeGreaterThanOrEqual(z.droite);
      }
    }
  });
});

describe("registre complété · règle de fin", () => {
  it("la fin « Écrivez MOT en commentaire » n'est permise que sur Instagram et Facebook", () => {
    expect(Object.fromEntries(RESEAUX.map((r) => [r.id, r.fin.auMot]))).toEqual({
      linkedin: false,
      instagram: true,
      facebook: true,
      tiktok: false,
      youtube: false,
      "youtube-shorts": false,
    });
  });
});
