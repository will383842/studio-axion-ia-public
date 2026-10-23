/**
 * FACE CAMÉRA ANIMÉE v4 — branchement du studio pour les vidéos d'illustration (18/10/2026) : l'outil `videos`, et la demande de rendu qui
 * porte une entrée signée par fichier (« broll:v4-<rang>-<k>.mp4 »). Doubles seulement : aucun réseau, aucun rendu réel.
 */
import { describe, expect, it, vi } from "vitest";
import type { PlanFacecamAnimee } from "@/domaine/facecam-animee/plan";
import type { DemandeRendu } from "@/fournisseurs/types";
import { demandeRenduV4, outilsFacecamAnimee } from "@/services/facecam-animee";

const PLAN = {
  version: "facecam-animee/1",
  charte: "x",
  duree: 30,
  fps: 30,
  largeur: 1080,
  hauteur: 1920,
  prise: { src: "autre.mp4", finSec: 30 },
  groupes: [],
  cartes: [],
  fenetres: [],
  calques: [],
  zooms: [],
  fin: { debut: 30, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] },
  sons: [{ nom: "musique" }],
  elementsV4: [{ id: "duel-video", debut: 4, fin: 6.5, recherches: ["a", "b"], medias: ["broll/v4-0-0.mp4", "broll/v4-0-1.mp4"] }],
} as unknown as PlanFacecamAnimee;

describe("vidéos d'illustration v4 · demande de rendu", () => {
  const base = { idRendu: "fa4-ver-1", prise: "https://stockage.invalid/prise", plan: PLAN, gardes: [{ debutSec: 0, finSec: 30 }], sortie: { urlDepot: "https://s/d", cle: "c.mp4" }, vignette: { urlDepot: "https://s/v", cle: "c.jpg" } };

  it("une entrée signée par fichier, « broll:<nom> », à côté de la prise", () => {
    const d = demandeRenduV4({ ...base, videos: [{ nom: "v4-0-0.mp4", url: "https://signe.invalid/0" }, { nom: "v4-0-1.mp4", url: "https://signe.invalid/1" }] });
    expect(d.entrees).toEqual({ prise: "https://stockage.invalid/prise", "broll:v4-0-0.mp4": "https://signe.invalid/0", "broll:v4-0-1.mp4": "https://signe.invalid/1" });
    expect(d.parametres.plan.sons).toEqual([]);
  });

  it("sans vidéo d'illustration, la demande est celle d'avant (tolérant : un ancien rendu n'y change rien)", () => {
    expect(demandeRenduV4(base).entrees).toEqual({ prise: "https://stockage.invalid/prise" });
  });
});

describe("vidéos d'illustration v4 · outils du studio", () => {
  const signer = { lecture: async (cle: string) => `https://lecture.invalid/${cle}`, depot: async (cle: string) => `https://depot.invalid/${cle}` };

  it("l'outil `videos` est celui de la chaîne : le double injecté reçoit la vidéo, le plan et les mots", async () => {
    const videos = vi.fn(async (d: { plan: PlanFacecamAnimee }) => ({ plan: d.plan, fichiers: [], manques: [], depenseUsd: 0 }));
    const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, signer, rendu: { soumettre: vi.fn(), etat: vi.fn() }, videos });
    await outils.videos!({ videoId: "v-1", plan: PLAN, mots: [] });
    expect(videos).toHaveBeenCalledWith({ videoId: "v-1", plan: PLAN, mots: [] });
  });

  it("clés Pexels / Pixabay absentes : aucune recherche, aucun réseau, manque dit en français, le plan est rendu tel quel", async () => {
    const avant = { p: process.env.PEXELS_API_KEY, x: process.env.PIXABAY_API_KEY };
    delete process.env.PEXELS_API_KEY;
    delete process.env.PIXABAY_API_KEY;
    const piege = vi.fn(() => {
      throw new Error("réseau interdit");
    });
    vi.stubGlobal("fetch", piege);
    try {
      const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, signer, rendu: { soumettre: vi.fn(), etat: vi.fn() } });
      const r = await outils.videos!({ videoId: "v-1", plan: PLAN, mots: [] });
      expect(r.plan).toBe(PLAN);
      expect(r.fichiers).toEqual([]);
      expect(r.manques[0]).toMatch(/pas reliées/);
      expect(piege).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (avant.p !== undefined) process.env.PEXELS_API_KEY = avant.p;
      if (avant.x !== undefined) process.env.PIXABAY_API_KEY = avant.x;
    }
  });

  it("le rendu envoie les vidéos d'illustration signées (lecture) au service de rendu", async () => {
    const demandes: DemandeRendu[] = [];
    const rendu = {
      soumettre: vi.fn(async (d: DemandeRendu) => {
        demandes.push(d);
        return { idRendu: d.idRendu };
      }),
      etat: vi.fn(async () => ({ statut: "inconnu" as const })),
    };
    const outils = await outilsFacecamAnimee({ videoId: "v-1", travailId: "t-1", production: false, signer, rendu: rendu as never });
    await expect(
      outils.rendre({ idRendu: "fa4-ver-1", priseCle: "prise.mov", plan: PLAN, gardes: [{ debutSec: 0, finSec: 30 }], videos: [{ nom: "v4-0-0.mp4", cle: "studio/dev/facecam-animee/v-1/videos/v4-0-0.mp4" }] }),
    ).rejects.toMatchObject({ name: "EnCoursChaineV4" });
    expect(demandes).toHaveLength(1);
    expect(demandes[0].entrees["broll:v4-0-0.mp4"]).toBe("https://lecture.invalid/studio/dev/facecam-animee/v-1/videos/v4-0-0.mp4");
    expect(demandes[0].entrees.prise).toBe("https://lecture.invalid/prise.mov");
  });
});
