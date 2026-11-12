/** L4-02 : vue unifiée EntreeCalendrier. Dépôts en mémoire (doublures), aucun appel réel, données fictives. */
import { describe, expect, it } from "vitest";
import type { Depot } from "@/domaine/depots";
import { lienMedia, fusionnerEntrees } from "@/domaine/calendrier";
import { listerEntrees, type DepotsCalendrier } from "@/services/calendrier";

function faux<T extends { id: string }>(init: T[] = []): Depot<T> {
  const m = new Map<string, T>(init.map((e) => [e.id, e]));
  return {
    async lister(f?: (e: T) => boolean) { return [...m.values()].filter((e) => !f || f(e)); },
    async obtenir(id: string) { return m.get(id) ?? null; },
  } as unknown as Depot<T>;
}
const creneau = (id: string, extra: Record<string, unknown> = {}) => ({
  id, jourVise: "2026-11-24", heuresParReseau: { instagram: "2026-11-24T09:00:00.000Z" }, compteCible: "compte-1",
  statut: "valide", decalages: 0, ...extra,
});
const pub = (id: string, extra: Record<string, unknown> = {}) => ({
  id, reseau: "instagram", statut: "programmee", via: "manuel", date: "2026-11-24T09:00:00.000Z", texte: "t", ...extra,
});
function depots(o: { creneaux?: unknown[]; publications?: unknown[]; videos?: unknown[]; visuels?: unknown[] }): DepotsCalendrier {
  return {
    creneaux: faux((o.creneaux ?? []) as never[]), publications: faux((o.publications ?? []) as never[]),
    videos: faux((o.videos ?? []) as never[]), visuels: faux((o.visuels ?? []) as never[]),
  } as unknown as DepotsCalendrier;
}
const visuel = { id: "vis_abc", famille: "carrousel", titre: "Trois gestes simples", rendu: { vignetteCle: "vignettes/vis_abc.png" } };
const video = { id: "vid_1", titre: "Ma vidéo d'exemple" };

describe("lienMedia", () => {
  it("visuel → /visuels/<id>, vidéo → /videos/<id>", () => {
    expect(lienMedia("carrousel", "vis_abc")).toBe("/visuels/vis_abc");
    expect(lienMedia("video", "vid_1")).toBe("/videos/vid_1");
  });
  it("jamais /videos/undefined : identifiant absent ou « undefined » → pas de lien", () => {
    expect(lienMedia("video", undefined)).toBeNull();
    expect(lienMedia("video", "undefined")).toBeNull();
    expect(lienMedia("carrousel", "")).toBeNull();
  });
});

describe("listerEntrees", () => {
  it("un créneau à visuelId donne une entrée carrousel : titre, vignette, lien /visuels/…", async () => {
    const e = await listerEntrees(depots({ creneaux: [creneau("c1", { visuelId: "vis_abc" })], visuels: [visuel] }), "2026-11-23", "2026-11-29");
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ famille: "carrousel", origine: "creneau", jour: "2026-11-24", titre: "Trois gestes simples", vignette: "vignettes/vis_abc.png", lien: "/visuels/vis_abc" });
    expect(JSON.stringify(e)).not.toContain("undefined");
  });
  it("un créneau à videoId donne une entrée vidéo avec /videos/<id>", async () => {
    const e = await listerEntrees(depots({ creneaux: [creneau("c2", { videoId: "vid_1" })], videos: [video] }), "2026-11-23", "2026-11-29");
    expect(e[0]).toMatchObject({ famille: "video", titre: "Ma vidéo d'exemple", lien: "/videos/vid_1" });
  });
  it("média introuvable : entrée gardée, sans lien (jamais /videos/undefined)", async () => {
    const e = await listerEntrees(depots({ creneaux: [creneau("c3", { visuelId: "vis_disparu" })] }), "2026-11-23", "2026-11-29");
    expect(e).toHaveLength(1);
    expect(e[0].lien).toBeNull();
    expect(e[0].vignette).toBeNull();
  });
  it("créneau sans média : entrée sans lien", async () => {
    const e = await listerEntrees(depots({ creneaux: [creneau("c4")] }), "2026-11-23", "2026-11-29");
    expect(e[0].lien).toBeNull();
  });
  it("non-doublon : le créneau déjà couvert par une publication (même visuel, même réseau, même jour de Paris) n'apparaît pas deux fois", async () => {
    const e = await listerEntrees(depots({
      creneaux: [creneau("c5", { visuelId: "vis_abc" })], publications: [pub("p1", { visuelId: "vis_abc" })], visuels: [visuel],
    }), "2026-11-23", "2026-11-29");
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ origine: "publication", lien: "/visuels/vis_abc", titre: "Trois gestes simples" });
  });
  it("un autre réseau ou un autre jour ne masque pas le créneau", async () => {
    const e = await listerEntrees(depots({
      creneaux: [creneau("c6", { visuelId: "vis_abc" })],
      publications: [pub("p2", { visuelId: "vis_abc", reseau: "linkedin" }), pub("p3", { visuelId: "vis_abc", date: "2026-11-25T09:00:00.000Z" })],
      visuels: [visuel],
    }), "2026-11-23", "2026-11-29");
    expect(e.map((x) => x.origine).sort()).toEqual(["creneau", "publication", "publication"]);
  });
  it("jour de Paris : publication à 23:30 UTC = lendemain à Paris", async () => {
    const e = await listerEntrees(depots({ publications: [pub("p4", { videoId: "vid_1", date: "2026-11-24T23:30:00.000Z" })], videos: [video] }), "2026-11-23", "2026-11-29");
    expect(e[0].jour).toBe("2026-11-25");
  });
  it("hors période et créneau archivé exclus ; tri par jour", async () => {
    const e = await listerEntrees(depots({
      creneaux: [creneau("c7", { jourVise: "2026-12-30" }), creneau("c8", { statut: "archive" }), creneau("c9", { jourVise: "2026-11-26" }), creneau("c10", { jourVise: "2026-11-24" })],
    }), "2026-11-23", "2026-11-29");
    expect(e.map((x) => x.cle)).toEqual(["creneau:c10", "creneau:c9"]);
  });
});

describe("fusionnerEntrees (pur)", () => {
  it("sans publication, rend les entrées de créneau telles quelles", () => {
    const c = { cle: "creneau:x", jour: "2026-11-24", famille: "carrousel" as const, origine: "creneau" as const, titre: "t", vignette: null, lien: null, reseaux: ["instagram"], mediaId: "vis_abc", statut: "valide" };
    expect(fusionnerEntrees([], [c])).toEqual([c]);
  });
});
