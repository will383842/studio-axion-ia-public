import { describe, expect, it } from "vitest";
import { analyserFicheDemoFacecam, analyserFicheTutorielOutil } from "./fiches";

describe("fiche « Tutoriel d'outil » (validation tolérante)", () => {
  it("ne refuse jamais : une entrée vide ou absurde donne des remarques", () => {
    for (const brut of [undefined, null, {}, "n'importe quoi", { titre: 42, scriptColle: [] }]) {
      const r = analyserFicheTutorielOutil(brut);
      expect(r.fiche.voix.fournisseur).toBe("heygen");
      expect(r.fiche.visage).toBe(false);
      expect(r.remarques.length).toBeGreaterThan(0);
    }
  });
  it("un script collé prend le pas sur l'idée, sans remarque bloquante", () => {
    const r = analyserFicheTutorielOutil({ titre: "Notion en 1 minute", scriptColle: "Ouvrez Notion. Cliquez sur Nouveau." });
    expect(r.fiche.source).toBe("script");
    expect(r.remarques).toEqual([]);
  });
  it("une idée seule : le script sera généré puis relu avant validation", () => {
    const r = analyserFicheTutorielOutil({ titre: "Calendly pour débutants" });
    expect(r.fiche.source).toBe("idee");
    expect(r.fiche.scriptAValider).toBe(true);
  });
});

describe("fiche « Démo facecam » (validation tolérante)", () => {
  it("deux vidéos : écran partagé, aucune remarque", () => {
    const r = analyserFicheDemoFacecam({ videoFacecamId: "f1", videoEcranId: "e1" });
    expect(r.fiche.mode).toBe("deux-videos");
    expect(r.remarques).toEqual([]);
  });
  it("une seule vidéo : accepté avec une remarque", () => {
    const r = analyserFicheDemoFacecam({ videoFacecamId: "f1" });
    expect(r.fiche.mode).toBe("une-video");
    expect(r.remarques.length).toBe(1);
  });
  it("aucune vidéo ou données absurdes : jamais de refus", () => {
    for (const brut of [undefined, {}, 12, { videoFacecamId: 3 }]) {
      const r = analyserFicheDemoFacecam(brut);
      expect(r.fiche.motionAutourDeLEcranSeulement).toBe(true);
      expect(r.remarques.length).toBeGreaterThan(0);
    }
  });
});
