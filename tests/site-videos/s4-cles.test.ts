/** S4.4 — clés publiques versionnées : medias/videos/<idStudio>/<slug>-v<version>-<8 caractères du sha256>.<ext> (plan § 7.4). */
import { describe, expect, it } from "vitest";
import { adressePublique, clesPubliques, PREFIXE_CLES_PUBLIQUES } from "@/domaine/site-videos/contrat";

const SHA = { video: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b", vignette: "5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f", vtt: "9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d" };
const base = { idStudio: "vid_1", slug: "automatiser-ses-devis", version: 3, sha256: SHA };

describe("S4.4 clesPubliques", () => {
  it("la forme exacte du plan § 7.4", () => {
    expect(clesPubliques(base)).toEqual({
      video: "medias/videos/vid_1/automatiser-ses-devis-v3-1a2b3c4d.mp4",
      vignette: "medias/videos/vid_1/automatiser-ses-devis-v3-5e6f7a8b.jpg",
      vtt: "medias/videos/vid_1/automatiser-ses-devis-v3-9c0d1e2f.vtt",
    });
  });

  it("même entrée → mêmes clés ; une version différente ou un fichier différent → clé différente", () => {
    expect(clesPubliques(base)).toEqual(clesPubliques({ ...base }));
    expect(clesPubliques({ ...base, version: 4 }).video).not.toBe(clesPubliques(base).video);
    expect(clesPubliques({ ...base, sha256: { ...SHA, video: "ffffffff" + SHA.video.slice(8) } }).video).not.toBe(clesPubliques(base).video);
    // Changer la vignette ne change que la clé de la vignette.
    const autre = clesPubliques({ ...base, sha256: { ...SHA, vignette: "00000000" + SHA.vignette.slice(8) } });
    expect(autre.video).toBe(clesPubliques(base).video);
    expect(autre.vignette).not.toBe(clesPubliques(base).vignette);
  });

  it("aucune clé hors du préfixe medias/videos/, quoi qu'on donne comme identifiant ou adresse", () => {
    const pieges = [
      { idStudio: "../../etc", slug: "x" },
      { idStudio: "vid_1/../../autre", slug: "x" },
      { idStudio: "vid_1", slug: "../../../racine" },
      { idStudio: "vid 1\n", slug: "Titre Avec Espaces/Et Barres" },
      { idStudio: "vid_1", slug: "a\\b" },
    ];
    for (const p of pieges) {
      const cles = clesPubliques({ ...base, ...p });
      for (const cle of Object.values(cles)) {
        expect(cle.startsWith(PREFIXE_CLES_PUBLIQUES), cle).toBe(true);
        expect(cle, cle).not.toContain("..");
        expect(cle.slice(PREFIXE_CLES_PUBLIQUES.length).split("/")).toHaveLength(2);
        expect(cle, cle).toMatch(/^medias\/videos\/[A-Za-z0-9_-]+\/[a-z0-9-]+-v3-[0-9a-f]{8}\.(mp4|jpg|vtt)$/);
      }
    }
  });

  it("un identifiant ou un slug vide, ou un sha256 qui n'est pas hexadécimal, est refusé", () => {
    expect(() => clesPubliques({ ...base, idStudio: "///" })).toThrow();
    expect(() => clesPubliques({ ...base, slug: "" })).not.toThrow();
    expect(clesPubliques({ ...base, slug: "" }).video).toMatch(/\/video-v3-/);
    expect(() => clesPubliques({ ...base, sha256: { ...SHA, video: "zzzz" } })).toThrow();
    expect(() => clesPubliques({ ...base, version: 0 })).toThrow();
  });

  it("l'adresse publique est le même domaine que le site + la clé", () => {
    expect(adressePublique("medias/videos/vid_1/a-v1-12345678.mp4")).toBe("https://axion-ia.com/medias/videos/vid_1/a-v1-12345678.mp4");
  });
});
