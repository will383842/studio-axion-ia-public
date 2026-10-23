/**
 * FACE CAMÉRA ANIMÉE v4 — garde-fou des vidéos d'illustration (18/10/2026, vidéo v-60359dd080b1 : le rendu mourait à 99 % sur
 * `broll/` sans nom de fichier). Une plaquette qui exige des vidéos n'est jamais rendue sans elles : elle est RETIRÉE du plan.
 */
import { describe, expect, it } from "vitest";
import type { ElementV4Plan } from "@/domaine/facecam-animee/plan";
import { besoinVideosV4, plaquettesSansVideo, retirerPlaquettesSansVideo } from "@/moteurs/montage-facecam-animee/videos-v4";

const el = (id: string, debut: number, extra: Partial<ElementV4Plan> = {}): ElementV4Plan => ({ id, debut, fin: debut + 2.5, ...extra });
const plan = (elementsV4: ElementV4Plan[]) => ({ elementsV4 });

describe("vidéos d'illustration v4 · garde-fou", () => {
  it("les fiches qui exigent des vidéos sont reconnues (AvantApres 1, MosaiqueVideos 4 à 6, duel-video 2), les autres non", () => {
    expect(besoinVideosV4("AvantApres")).toEqual([1, 1]);
    expect(besoinVideosV4("MosaiqueVideos")).toEqual([4, 6]);
    expect(besoinVideosV4("duel-video")).toEqual([2, 2]);
    expect(besoinVideosV4("dalle-claquee")).toBeNull();
    expect(besoinVideosV4("inconnue")).toBeNull();
  });

  it("un AvantApres sans medias est détecté puis retiré, avec son rang et sa raison", () => {
    const p = plan([el("dalle-claquee", 1, { mots: ["OUI"] }), el("AvantApres", 5, { recherches: ["homme qui tape à la main"] }), el("dalle-claquee", 10, { mots: ["NON"] })]);
    expect(plaquettesSansVideo(p)).toEqual([1]);
    const r = retirerPlaquettesSansVideo(p);
    expect(r.plan.elementsV4?.map((e) => e.id)).toEqual(["dalle-claquee", "dalle-claquee"]);
    expect(r.retirees).toHaveLength(1);
    expect(r.retirees[0]).toMatchObject({ rang: 1, id: "AvantApres", debut: 5 });
    expect(r.retirees[0].raison).toMatch(/vidéo/);
    // le plan reçu n'est pas modifié
    expect(p.elementsV4).toHaveLength(3);
  });

  it("un medias vide ou des clés vides comptent comme absents", () => {
    expect(plaquettesSansVideo(plan([el("AvantApres", 5, { medias: [] })]))).toEqual([0]);
    expect(plaquettesSansVideo(plan([el("AvantApres", 5, { medias: [""] })]))).toEqual([0]);
  });

  it("un AvantApres avec son media est gardé", () => {
    const p = plan([el("AvantApres", 5, { recherches: ["homme qui tape"], medias: ["broll/v4-0-0.mp4"] })]);
    expect(plaquettesSansVideo(p)).toEqual([]);
    const r = retirerPlaquettesSansVideo(p);
    expect(r.plan.elementsV4).toHaveLength(1);
    expect(r.retirees).toEqual([]);
  });

  it("une mosaïque avec 3 vidéos sur 4 au minimum est retirée ; avec 4 elle est gardée", () => {
    const trois = el("MosaiqueVideos", 8, { recherches: ["a", "b", "c", "d"], medias: ["broll/v4-0-0.mp4", "broll/v4-0-1.mp4", "broll/v4-0-2.mp4"] });
    expect(plaquettesSansVideo(plan([trois]))).toEqual([0]);
    const quatre = el("MosaiqueVideos", 8, { recherches: ["a", "b", "c", "d"], medias: ["broll/v4-0-0.mp4", "broll/v4-0-1.mp4", "broll/v4-0-2.mp4", "broll/v4-0-3.mp4"] });
    expect(plaquettesSansVideo(plan([quatre]))).toEqual([]);
  });

  it("moins de medias que de recherches : la vidéo manquante ferait doubler une autre, donc la plaquette est retirée", () => {
    const duel = el("duel-video", 8, { recherches: ["a", "b"], medias: ["broll/v4-0-0.mp4"] });
    expect(plaquettesSansVideo(plan([duel]))).toEqual([0]);
  });

  it("un plan sans elementsV4 ou sans plaquette à vidéo ne change pas", () => {
    expect(plaquettesSansVideo({})).toEqual([]);
    const r = retirerPlaquettesSansVideo({});
    expect(r.retirees).toEqual([]);
  });
});
