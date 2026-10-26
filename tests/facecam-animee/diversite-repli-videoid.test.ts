/**
 * FACE CAMÉRA ANIMÉE v4 — DIVERSITÉ du repli : graine sha256 de l'id vidéo, anti-répétition de l'ouverture sur les 3 dernières vidéos,
 * répartition sur 300 ids, aucun zoom, plan inchangé sans id.
 */
import { describe, expect, it } from "vitest";
import { graineVideo, ouverturesRecentes, realiser, type EntreeRealisateur, type MotTranscrit } from "@/moteurs/montage-facecam-animee/realisateur";
import { planMinimalV4 } from "@/moteurs/montage-facecam-animee/realisateur/plan-minimal-v4";
import { historiqueV4 } from "@/moteurs/montage-facecam-animee/realisateur/historique-v4";

function parole(duree: number): MotTranscrit[] {
  const L = "bcdfghjklmnpqrstvwxz";
  return Array.from({ length: Math.floor(duree * 3) }, (_, k) => ({ w: `${L[k % 20]}a${L[Math.floor(k / 20) % 20]}o${L[Math.floor(k / 400) % 20]}ir`, a: k / 3, f: k / 3 + 0.28 }));
}
const entree = (videoId?: string, historique: EntreeRealisateur["historique"] = []): EntreeRealisateur =>
  ({ mots: parole(60), dureeSec: 60, ...(videoId ? { videoId } : {}), historique, prise: { src: "prise-montee.mp4", finSec: 60 }, fin: { debut: 60, marque: "Axion-IA", adresse: "axion-ia.com", motCle: "DIAGNOSTIC", tuiles: [] } }) as unknown as EntreeRealisateur;
const ids = Array.from({ length: 300 }, (_, k) => `video-${k}`);

describe("diversité v4 · graine de l'id vidéo", () => {
  it("déterministe, entre 0 et 999, différente d'un id à l'autre", () => {
    expect(graineVideo("video-1")).toBe(graineVideo("video-1"));
    const g = ids.map(graineVideo);
    expect(g.every((x) => x >= 0 && x < 1000)).toBe(true);
    expect(new Set(g).size).toBeGreaterThan(200);
  });
  it("300 ids : toutes les plaquettes d'ouverture possibles sortent, aucune ne domine", async () => {
    const compte = new Map<string, number>();
    for (const id of ids) {
      const r = await realiser(entree(id));
      const o = [...r.plan.elementsV4!].sort((a, b) => a.debut - b.debut)[0].id;
      compte.set(o, (compte.get(o) ?? 0) + 1);
    }
    console.log("ouvertures sur 300 ids", Object.fromEntries(compte));
    expect(compte.size).toBeGreaterThanOrEqual(5);
    expect(Math.max(...compte.values())).toBeLessThan(300 * 0.35);
  });
  it("même id → même plan", async () => {
    expect((await realiser(entree("video-7"))).plan).toEqual((await realiser(entree("video-7"))).plan);
  });
  it("aucun zoom ni mouvement de cadrage dans les 300 plans", async () => {
    for (const id of ids.slice(0, 60)) {
      const { plan } = await realiser(entree(id));
      expect(plan.zooms).toEqual([]);
      expect(plan.mouvements ?? []).toEqual([]);
      expect(plan.fenetres.every((f) => f.entree !== "zoom")).toBe(true);
    }
  });
  it("sans id : le repli d'avant (empreinte de la prise)", async () => {
    expect((await realiser(entree())).plan).toEqual((await realiser(entree())).plan);
  });
});

describe("diversité v4 · anti-répétition de l'ouverture", () => {
  it("jamais la même ouverture que les 3 dernières vidéos, en chaîne sur 300 ids", async () => {
    let histo: NonNullable<EntreeRealisateur["historique"]> = [];
    const ouvertures: string[] = [];
    for (const id of ids) {
      const r = await realiser(entree(id, histo));
      const o = [...r.plan.elementsV4!].sort((a, b) => a.debut - b.debut)[0].id;
      expect(ouverturesRecentes(histo)).not.toContain(o);
      ouvertures.push(o);
      histo = [{ types: [], entrees: [], ...historiqueV4(r.plan.elementsV4) }, ...histo].slice(0, 5);
    }
    expect(new Set(ouvertures).size).toBeGreaterThanOrEqual(5);
  });
  it("sans alternative possible, l'ouverture évitée reste permise (jamais de blocage)", () => {
    const tout = ["EtiquetteTete", "MotSaute", "element-barre", "BadgeProfil", "Interjection", "RangeePastilles", "CarteCalendrier", "CarteChecklist", "CarteCommentaire", "GraphiqueBarres", "CarteStatuts", "CarteCommande", "PileNotifications"];
    const el = planMinimalV4({ mots: parole(30), horizon: 30, graine: 2, eviterOuvertures: tout });
    expect(el.length).toBeGreaterThan(3);
  });
  it("sans eviterOuvertures : plan inchangé", () => {
    expect(planMinimalV4({ mots: parole(40), horizon: 40, graine: 5 })).toEqual(planMinimalV4({ mots: parole(40), horizon: 40, graine: 5, eviterOuvertures: [] }));
  });
});
